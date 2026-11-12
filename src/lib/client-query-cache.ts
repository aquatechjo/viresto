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
    staleCache.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
  for (const key of staleCache.keys()) {
    if (key.startsWith(prefix)) {
      staleCache.delete(key);
    }
  }
}

/*
 * Stale-while-revalidate for the pages' own lists. The last OK body of each
 * GET URL is kept in this tab's memory (never in storage), so coming back
 * to a page, or to a filter, shows it at once while the request runs.
 *
 * Scope: one browser tab, one session. Every session change (login,
 * logout, demo enter/exit/reset, demo ended) is a full page load, which
 * starts this module, and so this cache, empty.
 */

/** A body older than this is not shown; the page waits for the request. */
export const STALE_MAX_AGE_MS = 10 * 60_000;
/** Most recently used URLs kept; the oldest is dropped past this. */
export const STALE_MAX_ENTRIES = 60;

const staleCache = new Map<string, { body: unknown; storedAt: number }>();

/** The last OK body of `url`, if any and not older than STALE_MAX_AGE_MS. */
export function readStaleJson<T = unknown>(
  url: string,
  now: number = Date.now(),
): T | undefined {
  const entry = staleCache.get(url);
  if (!entry) return undefined;
  if (now - entry.storedAt > STALE_MAX_AGE_MS) {
    staleCache.delete(url);
    return undefined;
  }
  return entry.body as T;
}

/** Keep `body` as the last OK answer of `url`. */
export function rememberStaleJson(
  url: string,
  body: unknown,
  now: number = Date.now(),
) {
  staleCache.delete(url); // re-insert: Map order is the recency order
  staleCache.set(url, { body, storedAt: now });
  while (staleCache.size > STALE_MAX_ENTRIES) {
    const oldest = staleCache.keys().next().value;
    if (oldest === undefined) break;
    staleCache.delete(oldest);
  }
}

/**
 * GET `url` and parse its JSON body. With `onStale`, a body this URL gave
 * earlier is passed to it first, synchronously, before the request goes
 * out. An OK fresh body replaces the remembered one. Only the page's load
 * effect (page opened, filter or page changed) should pass `onStale`: a
 * reload after a save already shows that body, and may have changed it on
 * purpose.
 */
export async function fetchJsonWithStale<T = unknown>(
  url: string,
  init: RequestInit = {},
  onStale?: (body: T) => void,
): Promise<{ response: Response; body: T }> {
  if (onStale) {
    const stale = readStaleJson<T>(url);
    if (stale !== undefined) onStale(stale);
  }

  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T;
  if (response.ok) rememberStaleJson(url, body);
  return { response, body };
}
