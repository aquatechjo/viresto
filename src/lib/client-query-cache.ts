"use client";

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const requestsInFlight = new Map<string, Promise<unknown>>();

export async function fetchJsonCached<T>(
  url: string,
  ttlMs = 30_000,
): Promise<T> {
  const now = Date.now();
  const cached = responseCache.get(url);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const inFlight = requestsInFlight.get(url);

  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const request = fetch(url, {
    method: "GET",
    credentials: "include",
  })
    .then(async (response) => {
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(`GET ${url} failed with status ${response.status}`);
      }

      responseCache.set(url, {
        value: body,
        expiresAt: Date.now() + ttlMs,
      });

      return body;
    })
    .finally(() => {
      requestsInFlight.delete(url);
    });

  requestsInFlight.set(url, request);

  return request as Promise<T>;
}

export function invalidateClientQueryCache(prefix?: string) {
  if (!prefix) {
    responseCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}
