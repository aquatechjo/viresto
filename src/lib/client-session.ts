"use client";

export type CurrentUserRole = "ADMIN" | "LAWYER" | "STAFF";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: CurrentUserRole;
  isSystemAdmin: boolean;
  twoFactorEnabled?: boolean;
  tenant?: {
    id: string;
    name: string;
    slug?: string;
    plan?: string;
    status?: string;
    isSuspended?: boolean;
    trialEndsAt?: string | null;
  } | null;
}

export interface CurrentUserResult {
  ok: boolean;
  status: number;
  user: CurrentUser | null;
}

const CACHE_TTL_MS = 10_000;

let cachedResult: {
  value: CurrentUserResult;
  expiresAt: number;
} | null = null;

let requestInFlight: Promise<CurrentUserResult> | null = null;

async function requestCurrentUser(): Promise<CurrentUserResult> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });

  const body = await response.json().catch(() => null);
  const user =
    response.ok && body?.success && body?.data
      ? (body.data as CurrentUser)
      : null;

  return {
    ok: Boolean(user),
    status: response.status,
    user,
  };
}

export function getCurrentUser(): Promise<CurrentUserResult> {
  const now = Date.now();

  if (cachedResult && cachedResult.expiresAt > now) {
    return Promise.resolve(cachedResult.value);
  }

  if (requestInFlight) {
    return requestInFlight;
  }

  requestInFlight = requestCurrentUser()
    .then((result) => {
      cachedResult = {
        value: result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };

      return result;
    })
    .finally(() => {
      requestInFlight = null;
    });

  return requestInFlight;
}

export function invalidateCurrentUser() {
  cachedResult = null;
}
