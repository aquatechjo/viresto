import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  billingView,
  onSubscriptionChanged,
  requestCheckout,
  trialProgress,
  waitForActivation,
} from "../../src/lib/billing/checkout-flow";
import {
  fetchJsonCached,
  invalidateClientQueryCache,
  readStaleJson,
  rememberStaleJson,
} from "../../src/lib/client-query-cache";
import { setCacheScope } from "../../src/lib/client-cache-scope";

const storage = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
};

beforeEach(() => {
  storage.clear();
  invalidateClientQueryCache();
});

function respond(status: number, body: unknown) {
  return async () => new Response(JSON.stringify(body), { status });
}

// --- polling ---------------------------------------------------------------

function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

test("polling: stops as soon as the server reports the subscription active", async () => {
  const c = clock();
  const answers = ["pending", "pending", "active"] as const;
  let calls = 0;
  const outcome = await waitForActivation({ check: async () => answers[calls++], ...c });
  assert.equal(outcome, "active");
  assert.equal(calls, 3);
});

test("polling: after ~30s without activation it is a timeout, not an error", async () => {
  const c = clock();
  let calls = 0;
  const outcome = await waitForActivation({
    check: async () => {
      calls++;
      return "pending";
    },
    timeoutMs: 30_000,
    intervalMs: 2_000,
    ...c,
  });
  assert.equal(outcome, "timeout");
  assert.ok(c.now() <= 30_000, `waited ${c.now()}ms`);
  assert.equal(calls, 16); // t = 0, 2, ..., 30 s
});

test("polling: a failing check (network) counts as pending; demo session and abort end it", async () => {
  const c = clock();
  let calls = 0;
  const outcome = await waitForActivation({
    check: async () => {
      calls++;
      if (calls < 3) throw new Error("offline");
      return "active";
    },
    ...c,
  });
  assert.equal(outcome, "active");

  assert.equal(await waitForActivation({ check: async () => "in_demo", ...clock() }), "in_demo");

  const controller = new AbortController();
  controller.abort();
  assert.equal(await waitForActivation({ check: async () => "pending", signal: controller.signal, ...clock() }), "aborted");
});

// --- starting a checkout -------------------------------------------------------

test("checkout start: the embedded URL and checkout id", async () => {
  const sent: RequestInit[] = [];
  const result = await requestCheckout("PRO", "monthly", async (_url, init) => {
    sent.push(init!);
    return new Response(JSON.stringify({ success: true, data: { mode: "checkout", url: "https://sandbox.polar.sh/checkout/x", checkoutId: "co_1" } }), { status: 200 });
  });
  assert.deepEqual(result, { kind: "checkout", url: "https://sandbox.polar.sh/checkout/x", checkoutId: "co_1" });
  assert.deepEqual(JSON.parse(String(sent[0].body)), { planId: "PRO", billingCycle: "monthly" });
});

test("checkout start: plan changed in place, past-due -> portal, 401, product refused, network down", async () => {
  assert.equal((await requestCheckout("PRO", "monthly", respond(200, { success: true, data: { mode: "updated" } }))).kind, "updated");
  assert.equal((await requestCheckout("PRO", "monthly", respond(409, { success: false, details: { action: "portal" } }))).kind, "portal");
  assert.equal((await requestCheckout("PRO", "monthly", respond(401, {}))).kind, "unauthorized");
  assert.deepEqual(
    await requestCheckout("PRO", "yearly", respond(503, { success: false, message: "غير متاحة", details: { code: "PLAN_PRODUCT_UNAVAILABLE" } })),
    { kind: "error", message: "غير متاحة", code: "PLAN_PRODUCT_UNAVAILABLE" },
  );
  assert.deepEqual(
    await requestCheckout("PRO", "monthly", async () => {
      throw new TypeError("Failed to fetch");
    }),
    { kind: "error", message: null, code: "NETWORK" },
  );
});

// --- cache invalidation after activation ----------------------------------------

test("after activation: this user's and office's cached data is dropped, others' kept, access refreshed", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ n: Math.random() }), { status: 200 })) as typeof fetch;

  setCacheScope("other-user:office-9");
  rememberStaleJson("/api/dashboard-stats", { plan: "other" });

  setCacheScope("u1:office-1");
  rememberStaleJson("/api/dashboard-stats", { plan: "TRIAL" });
  rememberStaleJson("/api/team", { seats: 5 });
  const before = await fetchJsonCached<{ n: number }>("/api/team?mode=assignees");

  let refreshed = 0;
  await onSubscriptionChanged(async () => {
    refreshed++;
  });

  assert.equal(refreshed, 1);
  assert.equal(readStaleJson("/api/dashboard-stats"), undefined);
  assert.equal(readStaleJson("/api/team"), undefined);
  const after = await fetchJsonCached<{ n: number }>("/api/team?mode=assignees");
  assert.notEqual(after.n, before.n); // fetched again, not served from cache

  setCacheScope("other-user:office-9");
  assert.deepEqual(readStaleJson("/api/dashboard-stats"), { plan: "other" });
});

// --- page state -------------------------------------------------------------

test("trial progress: days left and the share of the 14 days passed", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  assert.deepEqual(trialProgress("2026-11-23T12:00:00Z", 14, now), { daysLeft: 10, elapsed: 4 / 14 });
  assert.deepEqual(trialProgress("2026-11-13T11:00:00Z", 14, now), { daysLeft: 0, elapsed: 1 });
  assert.equal(trialProgress(null, 14, now), null);
});

test("page state: trial, active, past due (even while still paid), expired", () => {
  assert.equal(billingView({ accessState: "TRIAL" }), "trial");
  assert.equal(billingView({ accessState: "PAID", subscriptionStatus: "ACTIVE" }), "active");
  assert.equal(billingView({ accessState: "PAID", subscriptionStatus: "PAST_DUE" }), "past_due");
  assert.equal(billingView({ accessState: "LOCKED", paymentFailed: true }), "past_due");
  assert.equal(billingView({ accessState: "LOCKED", subscriptionStatus: "EXPIRED" }), "expired");
});

// --- embed that never loads ---------------------------------------------------

import { loadWithin, removeEmbedLeftovers } from "../../src/lib/billing/checkout-flow";

test("embed load: resolves with the embed when it loads, null when it never does", async () => {
  assert.equal(await loadWithin(Promise.resolve("embed"), 1000), "embed");
  assert.equal(await loadWithin(new Promise(() => {}), 20), null);
});

test("embed cleanup: removes this checkout's iframe, the spinner overlay and the scroll lock only", () => {
  const removed: string[] = [];
  const el = (name: string, src?: string, parent?: { remove: () => void }) => ({
    getAttribute: (key: string) => (key === "src" ? src ?? null : null),
    parentElement: parent ?? null,
    remove: () => removed.push(name),
  });
  const overlay = { remove: () => removed.push("overlay") };
  const classes = new Set(["polar-no-scroll", "other"]);
  const doc = {
    querySelectorAll: (selector: string) =>
      selector === "iframe"
        ? [el("checkout-frame", "https://sandbox.polar.sh/checkout/polar_c_1?embed=true"), el("other-frame", "https://youtube.com/x")]
        : [el("spinner", undefined, overlay)],
    body: { classList: { remove: (c: string) => classes.delete(c) } },
  } as unknown as Document;

  removeEmbedLeftovers("https://sandbox.polar.sh/checkout/polar_c_1", doc);
  assert.deepEqual(removed.sort(), ["checkout-frame", "overlay"]);
  assert.deepEqual([...classes], ["other"]);
});
