import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// The subscriptions page offers a cycle only when its Polar product passes
// the checkout's product check; the answer is cached briefly per instance.

mock.module("@/lib/polar", { namedExports: { getPolarClient: () => { throw new Error("no client in tests"); } } });

let mod: typeof import("../../src/lib/billing/product-availability");
before(async () => {
  mod = await import("../../src/lib/billing/product-availability");
});
const isCycleOfferable: typeof mod.isCycleOfferable = (...args) => mod.isCycleOfferable(...args);
const clearOfferableCache = () => mod?.clearOfferableCache();
const OFFERABLE_OK_TTL_MS = 5 * 60_000;
const OFFERABLE_FAIL_TTL_MS = 60_000;

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "pro_yearly",
    name: "Viresto - Pro Yearly",
    isArchived: false,
    isRecurring: true,
    recurringInterval: "year",
    recurringIntervalCount: 1,
    trialInterval: null,
    trialIntervalCount: null,
    prices: [{ amountType: "fixed", priceAmount: 59000, priceCurrency: "usd", isArchived: false }],
    ...overrides,
  };
}

let clock = 1_000_000;
const now = () => clock;

function polarReturning(value: unknown | (() => Promise<unknown>)) {
  const get = mock.fn(async () => (typeof value === "function" ? (value as () => Promise<unknown>)() : value));
  return { polar: { products: { get } }, get };
}

beforeEach(() => {
  clearOfferableCache();
  clock = 1_000_000;
});

test("offerable: a correct yearly product (year x1, $590) is offered", async () => {
  const { polar } = polarReturning(product());
  assert.equal(await isCycleOfferable("PRO", "yearly", "pro_yearly", { polar, now }), true);
});

test("offerable: a 'yearly' product that recurs monthly, or charges another price, is hidden", async () => {
  assert.equal(
    await isCycleOfferable("PRO", "yearly", "a", { polar: polarReturning(product({ recurringInterval: "month" })).polar, now }),
    false,
  );
  assert.equal(
    await isCycleOfferable("PRO", "yearly", "b", {
      polar: polarReturning(product({ prices: [{ amountType: "fixed", priceAmount: 440000, priceCurrency: "usd", isArchived: false }] })).polar,
      now,
    }),
    false,
  );
});

test("offerable: Polar unreachable, no product id, or an unknown plan hides the cycle", async () => {
  const down = polarReturning(() => Promise.reject(new Error("down"))).polar;
  assert.equal(await isCycleOfferable("PRO", "yearly", "pro_yearly", { polar: down, now }), false);
  assert.equal(await isCycleOfferable("PRO", "yearly", null, { polar: down, now }), false);
  assert.equal(await isCycleOfferable("NOPE", "yearly", "x", { polar: down, now }), false);
});

test("offerable: a pass is cached for 5 minutes, then read again", async () => {
  const { polar, get } = polarReturning(product());
  await isCycleOfferable("PRO", "yearly", "pro_yearly", { polar, now });
  clock += OFFERABLE_OK_TTL_MS - 1;
  await isCycleOfferable("PRO", "yearly", "pro_yearly", { polar, now });
  assert.equal(get.mock.callCount(), 1);
  clock += 2;
  await isCycleOfferable("PRO", "yearly", "pro_yearly", { polar, now });
  assert.equal(get.mock.callCount(), 2);
});

test("offerable: a failure is cached only 1 minute, so a fixed product shows up soon", async () => {
  let current = product({ recurringInterval: "month" });
  const { polar, get } = polarReturning(() => Promise.resolve(current));
  assert.equal(await isCycleOfferable("PRO", "yearly", "pro_yearly", { polar, now }), false);
  current = product();
  clock += OFFERABLE_FAIL_TTL_MS - 1;
  assert.equal(await isCycleOfferable("PRO", "yearly", "pro_yearly", { polar, now }), false);
  clock += 2;
  assert.equal(await isCycleOfferable("PRO", "yearly", "pro_yearly", { polar, now }), true);
  assert.equal(get.mock.callCount(), 2);
});

test("offerable: concurrent page loads share one Polar read", async () => {
  const { polar, get } = polarReturning(product());
  const results = await Promise.all([1, 2, 3].map(() => isCycleOfferable("PRO", "yearly", "pro_yearly", { polar, now })));
  assert.deepEqual(results, [true, true, true]);
  assert.equal(get.mock.callCount(), 1);
});

test("offerable: the cache lifetimes are 5 minutes for a pass and 1 for a failure", () => {
  assert.equal(mod.OFFERABLE_OK_TTL_MS, OFFERABLE_OK_TTL_MS);
  assert.equal(mod.OFFERABLE_FAIL_TTL_MS, OFFERABLE_FAIL_TTL_MS);
});
