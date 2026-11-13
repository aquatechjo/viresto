import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  cacheScopeOf,
  clearCacheScope,
  getCacheScope,
  setCacheScope,
} from "../../src/lib/client-cache-scope";
import {
  fetchJsonCached,
  fetchJsonWithStale,
  invalidateClientQueryCache,
  readStaleJson,
  rememberStaleJson,
} from "../../src/lib/client-query-cache";
import { getCurrentUser, invalidateCurrentUser } from "../../src/lib/client-session";

// Client caches are namespaced by the signed-in user and office: an entry
// can never be served to another user or office, including from another
// tab of the same browser (localStorage and the session cookie are shared
// by all tabs; one store here stands for both tabs).

const storage = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
};

let fetchCount = 0;
let me: { status: number; body: unknown } = { status: 401, body: {} };
let onFetch: (() => void) | null = null;

globalThis.fetch = (async (url: string) => {
  fetchCount++;
  if (url === "/api/auth/me") return new Response(JSON.stringify(me.body), { status: me.status });
  onFetch?.();
  return new Response(JSON.stringify({ from: url, n: fetchCount }), { status: 200 });
}) as typeof fetch;

const A = "user-a:office-1";
const B = "user-b:office-2";

beforeEach(() => {
  storage.clear();
  invalidateClientQueryCache();
  invalidateCurrentUser();
  fetchCount = 0;
  onFetch = null;
});

test("the scope is user id + office id; without both it is unknown", () => {
  assert.equal(cacheScopeOf({ id: "u1", tenant: { id: "t1" } }), "u1:t1");
  assert.equal(cacheScopeOf({ id: "u1", tenant: null }), null);
  assert.equal(cacheScopeOf({ id: "", tenant: { id: "t1" } }), null);
  assert.equal(cacheScopeOf(null), null);
});

test("stale cache: user A's entry is never served after the browser switches to user B (other tab)", () => {
  setCacheScope(A);
  rememberStaleJson("/api/invoices?page=1", { owner: "A" });
  assert.deepEqual(readStaleJson("/api/invoices?page=1"), { owner: "A" });

  setCacheScope(B); // user B signed in, in another tab
  assert.equal(readStaleJson("/api/invoices?page=1"), undefined);

  rememberStaleJson("/api/invoices?page=1", { owner: "B" });
  assert.deepEqual(readStaleJson("/api/invoices?page=1"), { owner: "B" });

  setCacheScope(A); // and A's own entry is still A's
  assert.deepEqual(readStaleJson("/api/invoices?page=1"), { owner: "A" });
});

test("same user, other office (e.g. demo sandbox): not served either", () => {
  setCacheScope("user-a:office-1");
  rememberStaleJson("/api/cases", { office: 1 });
  setCacheScope("user-a:office-2");
  assert.equal(readStaleJson("/api/cases"), undefined);
});

test("no known scope (signed out, session just changed, storage blocked): nothing served or kept", async () => {
  setCacheScope(A);
  rememberStaleJson("/api/x", "a");
  clearCacheScope();
  assert.equal(getCacheScope(), null);
  assert.equal(readStaleJson("/api/x"), undefined);

  const seen: unknown[] = [];
  await fetchJsonWithStale("/api/x", {}, (s) => seen.push(s));
  assert.deepEqual(seen, []);
  setCacheScope(A);
  assert.equal(readStaleJson("/api/x"), "a"); // the no-scope answer was not kept
});

test("a session change while the request runs: its answer is not kept under the old scope", async () => {
  setCacheScope(A);
  onFetch = () => setCacheScope(B);
  await fetchJsonWithStale("/api/x");
  setCacheScope(A);
  assert.equal(readStaleJson("/api/x"), undefined);
  setCacheScope(B);
  assert.equal(readStaleJson("/api/x"), undefined);
});

test("TTL cache (fetchJsonCached) is namespaced too", async () => {
  setCacheScope(A);
  const a1 = await fetchJsonCached<{ n: number }>("/api/team?mode=assignees");
  const a2 = await fetchJsonCached<{ n: number }>("/api/team?mode=assignees");
  assert.equal(a1.n, a2.n); // served from cache for A

  setCacheScope(B);
  const b1 = await fetchJsonCached<{ n: number }>("/api/team?mode=assignees");
  assert.notEqual(b1.n, a1.n); // B gets its own request

  clearCacheScope();
  const none1 = await fetchJsonCached<{ n: number }>("/api/team?mode=assignees");
  const none2 = await fetchJsonCached<{ n: number }>("/api/team?mode=assignees");
  assert.notEqual(none1.n, none2.n); // no scope: no caching
});

test("a fresh /api/auth/me sets the scope; a signed-out answer and sign-out clear it", async () => {
  me = { status: 200, body: { success: true, data: { id: "u9", tenant: { id: "t9" } } } };
  await getCurrentUser();
  assert.equal(getCacheScope(), "u9:t9");

  invalidateCurrentUser(); // every sign-out path calls this
  assert.equal(getCacheScope(), null);

  setCacheScope("u9:t9");
  me = { status: 401, body: { success: false } };
  await getCurrentUser();
  assert.equal(getCacheScope(), null);
});
