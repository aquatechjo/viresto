"use client";

/*
 * Whose data the client caches hold (src/lib/client-query-cache.ts).
 *
 * Every cache key starts with "<userId>:<officeId>". The scope is kept in
 * localStorage, which every tab of the browser shares, so when another
 * tab signs in as someone else (the session cookie is shared too), this
 * tab stops matching its old entries at once. Only the ids are stored,
 * never cached data.
 *
 * Written only from the server's answer about the current cookie (a fresh
 * /api/auth/me), and cleared the moment a session changes (sign-in,
 * sign-out, demo enter/exit/reset/ended), so between the change and the
 * new session's /me answer no cache entry is served at all.
 */

const SCOPE_KEY = "viresto_cache_scope";

/** "<userId>:<officeId>", or null when unknown (nothing cached is served). */
export function cacheScopeOf(
  user: { id?: string | null; tenant?: { id?: string | null } | null } | null | undefined,
): string | null {
  const userId = user?.id;
  const officeId = user?.tenant?.id;
  return userId && officeId ? `${userId}:${officeId}` : null;
}

export function setCacheScope(scope: string | null) {
  try {
    if (scope) window.localStorage.setItem(SCOPE_KEY, scope);
    else window.localStorage.removeItem(SCOPE_KEY);
  } catch {
    // Storage blocked: getCacheScope returns null, so nothing is cached.
  }
}

/** The current scope; null when unknown or storage is blocked. */
export function getCacheScope(): string | null {
  try {
    return window.localStorage.getItem(SCOPE_KEY) || null;
  } catch {
    return null;
  }
}

/** Call when the session changes: no cache entry is served until /me answers. */
export function clearCacheScope() {
  setCacheScope(null);
}
