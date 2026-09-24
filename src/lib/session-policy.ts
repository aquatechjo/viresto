// Single source of truth for session timing, shared by the server
// (api-auth) and the client idle guard (SessionGuard).
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
// How long before the idle logout the client shows the "stay signed in"
// warning.
export const SESSION_IDLE_WARNING_MS = 60 * 1000;
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

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
