// Single source of truth for session timing, shared by the server
// (api-auth) and the client idle guard (SessionGuard).
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
// How long before the idle logout the client shows the "stay signed in"
// warning.
export const SESSION_IDLE_WARNING_MS = 60 * 1000;
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;
// Hard cap on a session's lifetime regardless of activity. Also used as the
// JWT/cookie lifetime in auth.ts.
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

const ACTIVITY_REQUEST_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Whether an authenticated request counts as user activity for the idle
 * timeout. Only writes do (plus the dedicated /api/auth/session/activity
 * ping, which updates lastActivityAt itself). Background reads such as the
 * notification poll must not keep an unattended session alive.
 */
export function isActivityRequestMethod(method?: string | null) {
  return ACTIVITY_REQUEST_METHODS.has((method ?? "").toUpperCase());
}

type SessionTokenIdentity = {
  userId: string;
  tenantId: string;
  sessionId?: string;
};

type PersistedSession = {
  userId: string;
  tenantId: string;
  isActive: boolean;
};

type SessionUser = {
  tenantId: string;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  tenant: {
    isSuspended: boolean;
    status: string;
  };
};

export function hasUsableSessionId(
  tokenUser: SessionTokenIdentity,
): tokenUser is SessionTokenIdentity & { sessionId: string } {
  return (
    typeof tokenUser.sessionId === "string" &&
    tokenUser.sessionId.trim().length > 0
  );
}

export function sessionMatchesToken<T extends PersistedSession>(
  session: T | null | undefined,
  tokenUser: SessionTokenIdentity,
): session is T {
  return Boolean(
    session &&
      hasUsableSessionId(tokenUser) &&
      session.isActive &&
      session.userId === tokenUser.userId &&
      session.tenantId === tokenUser.tenantId,
  );
}

export function sessionExpired(
  lastActivityAt?: Date | null,
  nowMs = Date.now(),
) {
  if (!lastActivityAt) return true;

  const lastActivityMs = lastActivityAt.getTime();

  if (!Number.isFinite(lastActivityMs)) return true;

  return nowMs - lastActivityMs > SESSION_IDLE_TIMEOUT_MS;
}

export function sessionAbsoluteExpired(
  createdAt?: Date | null,
  nowMs = Date.now(),
) {
  if (!createdAt) return true;

  const createdAtMs = createdAt.getTime();

  if (!Number.isFinite(createdAtMs)) return true;

  return nowMs - createdAtMs > SESSION_ABSOLUTE_TIMEOUT_MS;
}

export function shouldTouchSession(
  lastActivityAt?: Date | null,
  nowMs = Date.now(),
) {
  if (!lastActivityAt) return true;

  const lastActivityMs = lastActivityAt.getTime();

  if (!Number.isFinite(lastActivityMs)) return true;

  return nowMs - lastActivityMs > SESSION_TOUCH_INTERVAL_MS;
}

export function userCanUseSession<T extends SessionUser>(
  user: T | null | undefined,
  tenantId: string,
): user is T {
  return Boolean(
    user &&
      user.tenantId === tenantId &&
      user.isActive &&
      user.emailVerifiedAt &&
      !user.tenant.isSuspended &&
      user.tenant.status !== "SUSPENDED",
  );
}
