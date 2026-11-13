"use client";

import { getCacheScope } from "@/lib/client-cache-scope";

/*
 * Every key of both caches below is "<userId>:<officeId>|<url>"
 * (client-cache-scope.ts). An entry stored for one user and office is
 * never served to another, even in another tab of the same browser. With
 * no known scope nothing is cached or served.
 */

const SEPARATOR = "|";

/** The cache key of `url` under `scope`. */
export function scopedCacheKey(scope: string, url: string) {
  return `${scope}${SEPARATOR}${url}`;
}

function urlOfKey(key: string) {
  return key.slice(key.indexOf(SEPARATOR) + 1);
}

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const requestsInFlight = new Map<string, Promise<unknown>>();

async function getJsonOrThrow(url: string) {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }

  return body;
}

export async function fetchJsonCached<T>(
  url: string,
  ttlMs = 30_000,
): Promise<T> {
  const scope = getCacheScope();

  // Unknown user or office: no caching.
  if (!scope) return (await getJsonOrThrow(url)) as T;

  const key = scopedCacheKey(scope, url);
  const now = Date.now();
  const cached = responseCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const inFlight = requestsInFlight.get(key);

  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const request = getJsonOrThrow(url)
    .then((body) => {
      // Kept only if the session did not change while the request ran.
      if (getCacheScope() === scope) {
        responseCache.set(key, {
          value: body,
          expiresAt: Date.now() + ttlMs,
        });
      }

      return body;
    })
    .finally(() => {
      requestsInFlight.delete(key);
    });

  requestsInFlight.set(key, request);

  return request as Promise<T>;
}

/** Clears both caches, for every scope; with `prefix`, only those URLs. */
export function invalidateClientQueryCache(prefix?: string) {
  if (!prefix) {
    responseCache.clear();
    staleCache.clear();
    return;
  }

  for (const cache of [responseCache, staleCache] as Map<string, unknown>[]) {
    for (const key of cache.keys()) {
      if (urlOfKey(key).startsWith(prefix)) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Clears both caches for the signed-in user and office only (other scopes
 * in this tab are left alone). Call after anything that changes what the
 * office pays for: a subscription activated, a plan change, a cancel.
 */
export function invalidateCurrentScopeCache(scope: string | null = getCacheScope()) {
  if (!scope) return;
  const prefix = `${scope}${SEPARATOR}`;
  for (const cache of [responseCache, staleCache] as Map<string, unknown>[]) {
    for (const key of [...cache.keys()]) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  }
}

/*
 * Stale-while-revalidate for the pages' own lists. The last OK body of each
 * GET URL is kept in this tab's memory (never in storage), so coming back
 * to a page, or to a filter, shows it at once while the request runs.
 */

/** A body older than this is not shown; the page waits for the request. */
export const STALE_MAX_AGE_MS = 10 * 60_000;
/** Most recently used URLs kept; the oldest is dropped past this. */
export const STALE_MAX_ENTRIES = 60;

const staleCache = new Map<string, { body: unknown; storedAt: number }>();

/**
 * The last OK body of `url` for the current user and office, if any and
 * not older than STALE_MAX_AGE_MS.
 */
export function readStaleJson<T = unknown>(
  url: string,
  now: number = Date.now(),
): T | undefined {
  const scope = getCacheScope();
  if (!scope) return undefined;
  const key = scopedCacheKey(scope, url);
  const entry = staleCache.get(key);
  if (!entry) return undefined;
  if (now - entry.storedAt > STALE_MAX_AGE_MS) {
    staleCache.delete(key);
    return undefined;
  }
  return entry.body as T;
}

/**
 * Keep `body` as the last OK answer of `url` for `scope` (by default the
 * current one). Nothing is kept without a scope.
 */
export function rememberStaleJson(
  url: string,
  body: unknown,
  now: number = Date.now(),
  scope: string | null = getCacheScope(),
) {
  if (!scope) return;
  const key = scopedCacheKey(scope, url);
  staleCache.delete(key); // re-insert: Map order is the recency order
  staleCache.set(key, { body, storedAt: now });
  while (staleCache.size > STALE_MAX_ENTRIES) {
    const oldest = staleCache.keys().next().value;
    if (oldest === undefined) break;
    staleCache.delete(oldest);
  }
}

/**
 * GET `url` and parse its JSON body. With `onStale`, a body this URL gave
 * the current user and office earlier is passed to it first,
 * synchronously, before the request goes out. An OK fresh body replaces
 * the remembered one, unless the session changed while the request ran.
 * Only the page's load effect (page opened, filter or page changed) should
 * pass `onStale`: a reload after a save already shows that body, and may
 * have changed it on purpose.
 */
export async function fetchJsonWithStale<T = unknown>(
  url: string,
  init: RequestInit = {},
  onStale?: (body: T) => void,
): Promise<{ response: Response; body: T }> {
  const scope = getCacheScope();

  if (onStale) {
    const stale = readStaleJson<T>(url);
    if (stale !== undefined) onStale(stale);
  }

  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T;
  if (response.ok && scope && getCacheScope() === scope) {
    rememberStaleJson(url, body, Date.now(), scope);
  }
  return { response, body };
}
