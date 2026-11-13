import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  STALE_MAX_AGE_MS,
  STALE_MAX_ENTRIES,
  fetchJsonWithStale,
  invalidateClientQueryCache,
  readStaleJson,
  rememberStaleJson,
} from "../../src/lib/client-query-cache";
import { setCacheScope } from "../../src/lib/client-cache-scope";

// The pages' stale-while-revalidate cache (speed item 2). Every entry is
// under the signed-in user and office; see client-cache-scope.test.ts for
// the scope itself.

// localStorage, shared by every tab in a browser (one store here).
const storage = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
};

const calls: string[] = [];
let nextStatus = 200;
let nextBody: unknown = {};

globalThis.fetch = (async (url: string) => {
  calls.push(`fetch ${url}`);
  return new Response(JSON.stringify(nextBody), { status: nextStatus });
}) as typeof fetch;

beforeEach(() => {
  invalidateClientQueryCache();
  storage.clear();
  setCacheScope("user-a:office-1");
  calls.length = 0;
  nextStatus = 200;
  nextBody = {};
});

test("first visit: nothing stale is shown, the fresh body is returned and remembered", async () => {
  nextBody = { data: [1] };
  const seen: unknown[] = [];
  const { response, body } = await fetchJsonWithStale("/api/x", {}, (s) => seen.push(s));
  assert.equal(response.status, 200);
  assert.deepEqual(body, { data: [1] });
  assert.deepEqual(seen, []);
  assert.deepEqual(readStaleJson("/api/x"), { data: [1] });
});

test("coming back: the remembered body is shown before the request goes out, then the fresh one is returned", async () => {
  rememberStaleJson("/api/x", { data: ["old"] });
  nextBody = { data: ["new"] };
  const { body } = await fetchJsonWithStale("/api/x", {}, (stale) => {
    calls.push(`stale ${JSON.stringify(stale)}`);
  });
  assert.deepEqual(calls, ['stale {"data":["old"]}', "fetch /api/x"]);
  assert.deepEqual(body, { data: ["new"] });
  assert.deepEqual(readStaleJson("/api/x"), { data: ["new"] });
});

test("without onStale (a reload after a save) the remembered body is not shown", async () => {
  rememberStaleJson("/api/x", { data: ["old"] });
  await fetchJsonWithStale("/api/x");
  assert.deepEqual(calls, ["fetch /api/x"]);
});

test("an error answer is returned but not remembered; the last good body stays", async () => {
  rememberStaleJson("/api/x", { data: ["good"] });
  nextStatus = 500;
  nextBody = { message: "boom" };
  const { response } = await fetchJsonWithStale("/api/x");
  assert.equal(response.ok, false);
  assert.deepEqual(readStaleJson("/api/x"), { data: ["good"] });

  nextStatus = 401;
  await fetchJsonWithStale("/api/y");
  assert.equal(readStaleJson("/api/y"), undefined);
});

test("each URL (filter, page) is its own entry", async () => {
  rememberStaleJson("/api/x?page=1", "p1");
  rememberStaleJson("/api/x?page=2", "p2");
  assert.equal(readStaleJson("/api/x?page=1"), "p1");
  assert.equal(readStaleJson("/api/x?page=2"), "p2");
  assert.equal(readStaleJson("/api/x?page=3"), undefined);
});

test(`a body older than ${STALE_MAX_AGE_MS / 60000} minutes is not shown`, () => {
  const t0 = 1_000_000;
  rememberStaleJson("/api/x", "v", t0);
  assert.equal(readStaleJson("/api/x", t0 + STALE_MAX_AGE_MS), "v");
  assert.equal(readStaleJson("/api/x", t0 + STALE_MAX_AGE_MS + 1), undefined);
});

test(`only the ${STALE_MAX_ENTRIES} most recently used URLs are kept`, () => {
  for (let i = 0; i < STALE_MAX_ENTRIES; i++) rememberStaleJson(`/api/${i}`, i);
  rememberStaleJson("/api/0", "touched"); // most recent again
  rememberStaleJson("/api/new", "n");
  assert.equal(readStaleJson("/api/1"), undefined); // the oldest went
  assert.equal(readStaleJson("/api/0"), "touched");
  assert.equal(readStaleJson("/api/new"), "n");
});

test("invalidateClientQueryCache clears it, all or by prefix", () => {
  rememberStaleJson("/api/invoices?page=1", 1);
  rememberStaleJson("/api/cases?page=1", 2);
  invalidateClientQueryCache("/api/invoices");
  assert.equal(readStaleJson("/api/invoices?page=1"), undefined);
  assert.equal(readStaleJson("/api/cases?page=1"), 2);
  invalidateClientQueryCache();
  assert.equal(readStaleJson("/api/cases?page=1"), undefined);
});
