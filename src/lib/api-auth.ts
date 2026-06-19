import { NextRequest } from "next/server";
import { err } from "@/lib/api-response";
import { COOKIE, verifyToken } from "@/lib/auth";
import type { UserRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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
  if (!tokenUser.sessionId) {
    return {
      error: err("جلسة غير صالحة. يرجى تسجيل الدخول مجددًا.", 401),
      user: null,
    };
  }

  const dbUser = await prisma.user.findFirst({
    where: {
      id: tokenUser.userId,
      tenantId: tokenUser.tenantId,
      isActive: true,
      emailVerifiedAt: {
        not: null,
      },
      tenant: {
        isSuspended: false,
        status: {
          not: "SUSPENDED",
        },
      },
      sessions: {
        some: {
          id: tokenUser.sessionId,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      email: true,
      role: true,
      isSystemAdmin: true,
    },
  });

  if (!dbUser) {
    return {
      error: err(
        "انتهت الجلسة أو لم تعد صالحة. يرجى تسجيل الدخول مجددًا.",
        401,
      ),
      user: null,
    };
  }

  return {
    error: null,
    user: {
      userId: dbUser.id,
      tenantId: dbUser.tenantId,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      isSystemAdmin: dbUser.isSystemAdmin,
      sessionId: tokenUser.sessionId,
    },
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
