"use client";

export type TenantAccessEntitlements = {
  teamManagement: boolean;
  advancedReports: boolean;
  fullExport: boolean;
};

export type TenantAccessPayload = {
  canWrite?: boolean;
  message?: string | null;
  billing?: {
    blockReason?: string | null;
    subscriptionStatus?: string | null;
  } | null;
  entitlements?: TenantAccessEntitlements | null;
};

const ACCESS_CACHE_TTL_MS = 30_000;

let cachedAccess: {
  payload: TenantAccessPayload;
  expiresAt: number;
} | null = null;

let accessRequestInFlight: Promise<TenantAccessPayload | null> | null = null;

export function getCachedTenantWriteAccess() {
  if (!cachedAccess || cachedAccess.expiresAt <= Date.now()) {
    return null;
  }

  return cachedAccess.payload;
}

export async function requestTenantWriteAccess(
  force = false,
): Promise<TenantAccessPayload | null> {
  if (!force) {
    const cached = getCachedTenantWriteAccess();

    if (cached) {
      return cached;
    }

    if (accessRequestInFlight) {
      return accessRequestInFlight;
    }
  }

  const requestPromise: Promise<TenantAccessPayload | null> = fetch(
    "/api/billing/access",
    {
      cache: "no-store",
      credentials: "include",
    },
  )
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        return null;
      }

      const payload = (data.data ?? {}) as TenantAccessPayload;

      cachedAccess = {
        payload,
        expiresAt: Date.now() + ACCESS_CACHE_TTL_MS,
      };

      return payload;
    })
    .catch(() => null);

  accessRequestInFlight = requestPromise;

  return requestPromise.finally(() => {
    if (accessRequestInFlight === requestPromise) {
      accessRequestInFlight = null;
    }
  });
}

export function invalidateTenantWriteAccessCache() {
  cachedAccess = null;
}
