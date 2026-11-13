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
  assert.deepEqual(result, { kind: "checkout", url: "https://sandbox.polar.sh/checkout/x", checkoutId: "co_1", embedOrigin: null });
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

// --- embed: loaded / refused / timeout -----------------------------------------

import {
  EMBED_MAX_WAIT_MS,
  openEmbedWithin,
  removeEmbedLeftovers,
  reportEmbedOutcome,
} from "../../src/lib/billing/checkout-flow";
import {
  embedOutcomeLogLine,
  embedOutcomeReport,
  parseEmbedOutcomeReport,
} from "../../src/lib/billing/embed-outcome";

const CHECKOUT = "https://sandbox.polar.sh/checkout/polar_c_1";
const PAGE_ORIGIN = "https://www.virestojo.com";

/**
 * A page with what @polar-sh/checkout/embed's create() appends (the iframe
 * and the spinner overlay), and a window that receives postMessages.
 */
function embedPage(options: { visibility?: "visible" | "hidden" } = {}) {
  const removed: string[] = [];
  class FakeFrame extends EventTarget {
    style: Record<string, string> = {};
    getAttribute(key: string) {
      return key === "src" ? `${CHECKOUT}?embed=true&embed_origin=https%3A%2F%2Fwww.virestojo.com` : null;
    }
    remove() {
      removed.push("frame");
    }
  }
  const frame = new FakeFrame();
  const overlay = { style: {} as Record<string, string>, remove: () => removed.push("overlay") };
  const spinner = { parentElement: overlay };
  const classes = new Set(["polar-no-scroll"]);
  const docEvents = new EventTarget();
  const docState = { visibilityState: options.visibility ?? "visible" };
  const doc = {
    querySelectorAll: (selector: string) => (selector === "iframe" ? (removed.includes("frame") ? [] : [frame]) : [spinner]),
    body: { classList: { remove: (c: string) => classes.delete(c) } },
    addEventListener: docEvents.addEventListener.bind(docEvents),
    removeEventListener: docEvents.removeEventListener.bind(docEvents),
    get visibilityState() {
      return docState.visibilityState;
    },
  } as unknown as Document;
  const winEvents = new EventTarget();
  const win = {
    location: { origin: PAGE_ORIGIN },
    addEventListener: winEvents.addEventListener.bind(winEvents),
    removeEventListener: winEvents.removeEventListener.bind(winEvents),
  };
  const polarMessage = (event: string, origin = "https://sandbox.polar.sh") => {
    const message = new Event("message");
    Object.assign(message, { origin, data: { type: "POLAR_CHECKOUT", event } });
    winEvents.dispatchEvent(message);
  };
  const cspViolation = (blockedURI: string, effectiveDirective = "frame-src") => {
    const v = new Event("securitypolicyviolation");
    Object.assign(v, { blockedURI, effectiveDirective, violatedDirective: effectiveDirective });
    docEvents.dispatchEvent(v);
  };
  const setVisibility = (state: "visible" | "hidden") => {
    docState.visibilityState = state;
    docEvents.dispatchEvent(new Event("visibilitychange"));
  };
  return { doc, win, frame, overlay, removed, classes, polarMessage, cspViolation, setVisibility };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
const never = () => new Promise<never>(() => {});

test("embed open: waits ~12s before giving up on silence (a slow load is not a refusal)", () => {
  assert.equal(EMBED_MAX_WAIT_MS, 12_000);
});

test("embed path 'embedded': hidden while loading, shown once Polar says loaded, even after a slow load", async () => {
  const page = embedPage();
  const load = deferred<string>();
  const opening = openEmbedWithin({ create: () => load.promise, checkoutUrl: CHECKOUT, embedOrigin: PAGE_ORIGIN, doc: page.doc, win: page.win, maxWaitMs: 1000 });
  assert.equal(page.frame.style.visibility, "hidden");
  assert.equal(page.overlay.style.display, "none");

  // The frame's own load event (fired for a blocked frame too) proves
  // nothing: still waiting well after it.
  page.frame.dispatchEvent(new Event("load"));
  await tick(60);
  assert.deepEqual(page.removed, []);

  load.resolve("embed");
  const result = await opening;
  assert.equal(result.kind, "loaded");
  assert.equal(result.kind === "loaded" && result.embed, "embed");
  assert.ok(result.elapsedMs >= 50);
  assert.equal(page.frame.style.visibility, "");
  assert.deepEqual(page.removed, []);
});

test("embed path 'embedded': any Polar message before the deadline keeps it waiting past it", async () => {
  const page = embedPage();
  const load = deferred<string>();
  const opening = openEmbedWithin({ create: () => load.promise, checkoutUrl: CHECKOUT, doc: page.doc, win: page.win, maxWaitMs: 30 });
  page.polarMessage("confirmed");
  await tick(80);
  assert.deepEqual(page.removed, []);
  load.resolve("embed");
  assert.equal((await opening).kind, "loaded");
});

test("embed: a message from another origin is not a sign of life", async () => {
  const page = embedPage();
  const opening = openEmbedWithin({ create: never, checkoutUrl: CHECKOUT, doc: page.doc, win: page.win, maxWaitMs: 30 });
  page.polarMessage("loaded", "https://evil.example");
  const result = await opening;
  assert.equal(result.kind === "refused" && result.reason, "timeout");
});

test("embed path 'fallback-refused': a checkout created for another origin is refused before embedding", async () => {
  const page = embedPage();
  let created = false;
  const result = await openEmbedWithin({
    create: () => {
      created = true;
      return never();
    },
    checkoutUrl: CHECKOUT,
    embedOrigin: "https://virestojo.com",
    doc: page.doc,
    win: page.win,
  });
  assert.deepEqual(result, { kind: "refused", reason: "origin-mismatch", elapsedMs: 0 });
  assert.equal(created, false);
});

test("embed path 'fallback-refused': our CSP blocking the checkout frame is refused at once", async () => {
  const page = embedPage();
  const opening = openEmbedWithin({ create: never, checkoutUrl: CHECKOUT, doc: page.doc, win: page.win, maxWaitMs: 5000 });
  // Other frames, or other directives, are not this checkout being refused.
  page.cspViolation("https://youtube.com/embed/x");
  page.cspViolation("https://sandbox.polar.sh/checkout/polar_c_1", "img-src");
  await tick(10);
  assert.deepEqual(page.removed, []);
  page.cspViolation("https://sandbox.polar.sh");
  const result = await opening;
  assert.equal(result.kind === "refused" && result.reason, "csp");
  assert.deepEqual(page.removed.sort(), ["frame", "overlay"]);
  assert.deepEqual([...page.classes], []);
});

test("embed path 'fallback-refused': an iframe error is refused at once", async () => {
  const page = embedPage();
  const opening = openEmbedWithin({ create: never, checkoutUrl: CHECKOUT, doc: page.doc, win: page.win, maxWaitMs: 5000 });
  page.frame.dispatchEvent(new Event("error"));
  const result = await opening;
  assert.equal(result.kind === "refused" && result.reason, "frame-error");
  assert.deepEqual(page.removed.sort(), ["frame", "overlay"]);
});

test("embed path 'fallback-timeout': nothing at all by the deadline on a visible page", async () => {
  const page = embedPage();
  const opening = openEmbedWithin({ create: never, checkoutUrl: CHECKOUT, doc: page.doc, win: page.win, maxWaitMs: 40 });
  page.frame.dispatchEvent(new Event("load"));
  const result = await opening;
  assert.equal(result.kind === "refused" && result.reason, "timeout");
  assert.ok(result.elapsedMs >= 35);
  assert.deepEqual(page.removed.sort(), ["frame", "overlay"]);
});

test("embed path 'fallback-timeout': a hidden tab is decided only once it is visible again", async () => {
  const page = embedPage({ visibility: "hidden" });
  const opening = openEmbedWithin({ create: never, checkoutUrl: CHECKOUT, doc: page.doc, win: page.win, maxWaitMs: 20 });
  await tick(60);
  assert.deepEqual(page.removed, []);
  page.setVisibility("visible");
  const result = await opening;
  assert.equal(result.kind === "refused" && result.reason, "timeout");
});

test("embed: loaded while the tab was hidden wins over the deferred timeout", async () => {
  const page = embedPage({ visibility: "hidden" });
  const load = deferred<string>();
  const opening = openEmbedWithin({ create: () => load.promise, checkoutUrl: CHECKOUT, doc: page.doc, win: page.win, maxWaitMs: 20 });
  await tick(40);
  load.resolve("embed");
  assert.equal((await opening).kind, "loaded");
  page.setVisibility("visible");
  await tick(10);
  assert.deepEqual(page.removed, []);
});

test("embed: create() failing rejects and cleans up", async () => {
  const page = embedPage();
  const opening = openEmbedWithin({ create: () => Promise.reject(new Error("boom")), checkoutUrl: CHECKOUT, doc: page.doc, win: page.win, maxWaitMs: 1000 });
  await assert.rejects(opening, /boom/);
  assert.deepEqual(page.removed.sort(), ["frame", "overlay"]);
});

test("embed outcome: each path maps to its log outcome, with the elapsed ms", () => {
  assert.deepEqual(embedOutcomeReport({ kind: "loaded" }, 3456.4), { outcome: "embedded", reason: "loaded", elapsedMs: 3456 });
  assert.deepEqual(embedOutcomeReport({ kind: "refused", reason: "csp" }, 12), { outcome: "fallback-refused", reason: "csp", elapsedMs: 12 });
  assert.deepEqual(embedOutcomeReport({ kind: "refused", reason: "origin-mismatch" }, 0), { outcome: "fallback-refused", reason: "origin-mismatch", elapsedMs: 0 });
  assert.deepEqual(embedOutcomeReport({ kind: "refused", reason: "frame-error" }, 5), { outcome: "fallback-refused", reason: "frame-error", elapsedMs: 5 });
  assert.deepEqual(embedOutcomeReport({ kind: "refused", reason: "timeout" }, 12001), { outcome: "fallback-timeout", reason: "timeout", elapsedMs: 12001 });
  assert.equal(
    embedOutcomeLogLine({ outcome: "fallback-timeout", reason: "timeout", elapsedMs: 12001 }, "tenant-1"),
    "[polar-checkout] embed_outcome=fallback-timeout reason=timeout elapsed_ms=12001 tenant=tenant-1",
  );
});

test("embed outcome: the server accepts only our own words and a sane number", () => {
  assert.deepEqual(parseEmbedOutcomeReport({ outcome: "embedded", reason: "loaded", elapsedMs: 900 }), { outcome: "embedded", reason: "loaded", elapsedMs: 900 });
  assert.equal(parseEmbedOutcomeReport({ outcome: "embedded", reason: "timeout", elapsedMs: 1 }), null);
  assert.equal(parseEmbedOutcomeReport({ outcome: "hacked\nline", reason: "loaded", elapsedMs: 1 }), null);
  assert.equal(parseEmbedOutcomeReport({ outcome: "embedded", reason: "loaded", elapsedMs: -1 }), null);
  assert.equal(parseEmbedOutcomeReport({ outcome: "embedded", reason: "loaded", elapsedMs: "5" }), null);
  assert.equal(parseEmbedOutcomeReport(null), null);
  assert.equal(parseEmbedOutcomeReport({ outcome: "embedded", reason: "loaded", elapsedMs: 1e12 })?.elapsedMs, 600_000);
});

test("embed outcome: reported with keepalive (survives leaving for the checkout page), never throws", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  reportEmbedOutcome({ kind: "refused", reason: "timeout" }, 12000, async (url, init) => {
    calls.push({ url, init });
    return new Response("{}");
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/billing/checkout/embed-outcome");
  assert.equal(calls[0].init?.keepalive, true);
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { outcome: "fallback-timeout", reason: "timeout", elapsedMs: 12000 });
  reportEmbedOutcome({ kind: "loaded" }, 1, () => Promise.reject(new Error("offline")));
  reportEmbedOutcome({ kind: "loaded" }, 1, () => {
    throw new Error("sync");
  });
  await tick(5);
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
