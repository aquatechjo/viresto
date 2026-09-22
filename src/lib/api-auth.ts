import { NextRequest } from "next/server";
import { err } from "@/lib/api-response";
import { COOKIE, verifyToken } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";
import type { UserRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
  hasUsableSessionId,
  sessionExpired,
  sessionMatchesToken,
  shouldTouchSession,
  userCanUseSession,
} from "@/lib/session-policy";

// Short cache to reduce repeated auth DB round-trips within one page load's
// burst of API calls. Every security-sensitive mutation (logout, session
// revoke, password/email change, role/active changes, tenant suspension)
// explicitly invalidates the affected cache entries below — see
// invalidateAuthCacheForSession/ForUser/ForTenant — so this TTL only bounds
// the window for paths that don't call one of those, not the primary
// enforcement mechanism. Override via env for local tuning; set to 0 to
// disable entirely.
// NOTE: this cache is an in-process Map (globalThis-scoped). On a
// multi-instance/serverless deployment, explicit invalidation only clears
// the instance that handled the mutation — other warm instances may still
// serve a stale cached entry for up to AUTH_CACHE_TTL_MS. A distributed,
// versioned cache (e.g. Redis-backed) would close that gap if it matters
// for this deployment target.
const AUTH_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS || 5_000);

export type AuthenticatedUserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isSystemAdmin: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    isSuspended: boolean;
    trialEndsAt: Date | null;
  };
};

export type AuthenticatedUser = {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  isSystemAdmin: boolean;
  sessionId: string;
  profile: AuthenticatedUserProfile;
};

type AuthCacheEntry = {
  expiresAt: number;
  lastActivityAt: number;
  user: AuthenticatedUser;
};

type GlobalWithAuthCache = typeof globalThis & {
  __virestoAuthCache?: Map<string, AuthCacheEntry>;
};

export type SessionValidationResult =
  | {
      ok: true;
      user: AuthenticatedUser;
    }
  | {
      ok: false;
      message: string;
    };

const authCache =
  ((globalThis as GlobalWithAuthCache).__virestoAuthCache ??=
    new Map<string, AuthCacheEntry>());

export function getRequestMeta(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  return {
    ipAddress,
    userAgent,
  };
}

function getCacheKey(sessionId: string, userId: string, tenantId: string) {
  return `${sessionId}:${userId}:${tenantId}`;
}

function getCachedAuth(cacheKey: string) {
  if (AUTH_CACHE_TTL_MS <= 0) return null;

  const cached = authCache.get(cacheKey);
  const now = Date.now();

  if (!cached) return null;

  if (cached.expiresAt <= now) {
    authCache.delete(cacheKey);
    return null;
  }

  if (now - cached.lastActivityAt > SESSION_IDLE_TIMEOUT_MS) {
    authCache.delete(cacheKey);
    return null;
  }

  return cached.user;
}

function setCachedAuth(
  cacheKey: string,
  user: AuthenticatedUser,
  lastActivityAt: Date,
) {
  if (AUTH_CACHE_TTL_MS <= 0) return;

  const now = Date.now();

  authCache.set(cacheKey, {
    user,
    lastActivityAt: lastActivityAt.getTime(),
    expiresAt: now + AUTH_CACHE_TTL_MS,
  });

  // تنظيف بسيط لمنع نمو الذاكرة لو صار عندك جلسات كثيرة.
  if (authCache.size > 1000) {
    for (const [key, value] of authCache.entries()) {
      if (value.expiresAt <= now) {
        authCache.delete(key);
      }
    }
  }
}

/**
 * Call at any point that revokes a single, already-known session (logout,
 * revoking one device from the session list) so the next request for that
 * exact session re-validates from the DB instead of waiting out the TTL.
 */
export function invalidateAuthCacheForSession(
  sessionId: string,
  userId: string,
  tenantId: string,
) {
  authCache.delete(getCacheKey(sessionId, userId, tenantId));
}

/**
 * Call whenever a user's security context changes in a way that isn't
 * scoped to one known session id: password/email change, "sign out other
 * sessions", an admin changing a team member's role/active state or
 * removing them. userId alone is enough to scope this — User.id is
 * globally unique, not composite with tenantId.
 */
export function invalidateAuthCacheForUser(userId: string) {
  for (const [key, entry] of authCache.entries()) {
    if (entry.user.userId === userId) {
      authCache.delete(key);
    }
  }
}

/**
 * Call when an entire tenant's access changes at once (suspending or
 * deleting a tenant), so every cached member of that tenant re-validates
 * on their next request instead of each needing an individual invalidation.
 */
export function invalidateAuthCacheForTenant(tenantId: string) {
  for (const [key, entry] of authCache.entries()) {
    if (entry.user.tenantId === tenantId) {
      authCache.delete(key);
    }
  }
}

export async function validateSessionPayload(
  tokenUser: JWTPayload,
): Promise<SessionValidationResult> {
  if (!hasUsableSessionId(tokenUser)) {
    return {
      ok: false,
      message: "جلسة غير صالحة. يرجى تسجيل الدخول مجددًا.",
    };
  }

  const cacheKey = getCacheKey(
    tokenUser.sessionId,
    tokenUser.userId,
    tokenUser.tenantId,
  );

  const cachedUser = getCachedAuth(cacheKey);

  if (cachedUser) {
    return {
      ok: true,
      user: cachedUser,
    };
  }

  const [session, dbUser] = await Promise.all([
    prisma.session.findUnique({
      where: {
        id: tokenUser.sessionId,
      },
      select: {
        id: true,
        userId: true,
        tenantId: true,
        isActive: true,
        lastActivityAt: true,
      },
    }),

    prisma.user.findUnique({
      where: {
        id: tokenUser.userId,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        isSystemAdmin: true,
        twoFactorEnabled: true,
        createdAt: true,
        isActive: true,
        emailVerifiedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            isSuspended: true,
            status: true,
            trialEndsAt: true,
          },
        },
      },
    }),
  ]);

  const validSession = sessionMatchesToken(session, tokenUser);

  if (!validSession) {
    authCache.delete(cacheKey);

    return {
      ok: false,
      message: "انتهت الجلسة أو لم تعد صالحة. يرجى تسجيل الدخول مجددًا.",
    };
  }

  if (sessionExpired(session.lastActivityAt)) {
    authCache.delete(cacheKey);

    await prisma.session.updateMany({
      where: {
        id: tokenUser.sessionId,
        userId: tokenUser.userId,
        tenantId: tokenUser.tenantId,
      },
      data: {
        isActive: false,
      },
    });

    return {
      ok: false,
      message: "انتهت الجلسة بسبب عدم النشاط. يرجى تسجيل الدخول مجددًا.",
    };
  }

  const validUser = userCanUseSession(dbUser, tokenUser.tenantId);

  if (!validUser) {
    authCache.delete(cacheKey);

    await prisma.session.updateMany({
      where: {
        id: tokenUser.sessionId,
      },
      data: {
        isActive: false,
      },
    });

    return {
      ok: false,
      message: "انتهت الجلسة أو لم تعد صالحة. يرجى تسجيل الدخول مجددًا.",
    };
  }

  let lastActivityAtForCache = session.lastActivityAt;

  if (shouldTouchSession(session.lastActivityAt)) {
    const now = new Date();
    const touchBefore = new Date(Date.now() - SESSION_TOUCH_INTERVAL_MS);

    lastActivityAtForCache = now;

    void prisma.session
      .updateMany({
        where: {
          id: tokenUser.sessionId,
          userId: tokenUser.userId,
          tenantId: tokenUser.tenantId,
          isActive: true,
          lastActivityAt: {
            lt: touchBefore,
          },
        },
        data: {
          lastActivityAt: now,
        },
      })
      .catch((error) => {
        console.error("Failed to touch session", error);
      });
  }

  const user: AuthenticatedUser = {
    userId: dbUser.id,
    tenantId: dbUser.tenantId,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as UserRole,
    isSystemAdmin: dbUser.isSystemAdmin,
    sessionId: tokenUser.sessionId,
    profile: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      isSystemAdmin: dbUser.isSystemAdmin,
      twoFactorEnabled: dbUser.twoFactorEnabled,
      createdAt: dbUser.createdAt,
      tenant: {
        id: dbUser.tenant.id,
        name: dbUser.tenant.name,
        slug: dbUser.tenant.slug,
        plan: dbUser.tenant.plan,
        status: dbUser.tenant.status,
        isSuspended: dbUser.tenant.isSuspended,
        trialEndsAt: dbUser.tenant.trialEndsAt,
      },
    },
  };

  setCachedAuth(cacheKey, user, lastActivityAtForCache);

  return {
    ok: true,
    user,
  };
}

export async function requireAuth(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;

  if (!token) {
    return {
      error: err("غير مصرح", 401),
      user: null,
    };
  }

  const tokenUser = await verifyToken(token);

  if (!tokenUser) {
    return {
      error: err("جلسة غير صالحة", 401),
      user: null,
    };
  }

  const validation = await validateSessionPayload(tokenUser);

  if (!validation.ok) {
    return {
      error: err(validation.message, 401),
      user: null,
    };
  }

  return {
    error: null,
    user: validation.user,
  };
}

export async function requireRole(req: NextRequest, roles: UserRole[]) {
  const auth = await requireAuth(req);

  if (auth.error || !auth.user) {
    return auth;
  }

  if (!roles.includes(auth.user.role as UserRole)) {
    return {
      error: err("لا تملك صلاحية لتنفيذ هذا الإجراء.", 403),
      user: null,
    };
  }

  return {
    error: null,
    user: auth.user,
  };
}
