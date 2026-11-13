import { test } from "node:test";
import assert from "node:assert/strict";
import { planYearlyProductUpdate, type PlanRow } from "../../src/lib/yearly-product-update";
import type { PolarProductLike } from "../../src/lib/polar-product-check";

// scripts/update-polar-yearly-products.ts: map by name AND price, never by
// order; refuse on any doubt.

const PLANS: PlanRow[] = [
  { code: "BASIC", name: "Basic", priceYearly: 29000, polarMonthlyProductId: "basic-m", polarYearlyProductId: "basic-y-old" },
  { code: "PRO", name: "Pro", priceYearly: 59000, polarMonthlyProductId: "pro-m", polarYearlyProductId: "pro-y-old" },
  { code: "BUSINESS", name: "Business", priceYearly: 119000, polarMonthlyProductId: "biz-m", polarYearlyProductId: "biz-y-old" },
];

function product(id: string, name: string, cents: number, overrides: Partial<PolarProductLike> = {}): PolarProductLike {
  return {
    id,
    name,
    isArchived: false,
    isRecurring: true,
    recurringInterval: "year",
    recurringIntervalCount: 1,
    trialInterval: null,
    trialIntervalCount: null,
    prices: [{ amountType: "fixed", priceAmount: cents, priceCurrency: "usd", isArchived: false }],
    ...overrides,
  };
}

const BASIC = product("new-0", "Viresto - Basic Yearly", 29000);
const PRO = product("new-1", "Viresto - Pro Yearly", 59000);
const BIZ = product("new-2", "Viresto - Business Yearly", 119000);
// Deliberately not in plan order.
const GOOD = [BIZ, BASIC, PRO];

function run(products = GOOD, yearlySubscriptions: Parameters<typeof planYearlyProductUpdate>[0]["yearlySubscriptions"] = []) {
  return planYearlyProductUpdate({ products, plans: PLANS, yearlySubscriptions, now: new Date("2026-11-13T12:00:00Z") });
}

test("maps each product to its plan by name and price, whatever the order; shows the old id", () => {
  const result = run();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const byCode = Object.fromEntries(result.assignments.map((a) => [a.code, a]));
  assert.equal(byCode.BASIC.productId, "new-0");
  assert.equal(byCode.PRO.productId, "new-1");
  assert.equal(byCode.BUSINESS.productId, "new-2");
  assert.equal(byCode.PRO.before, "pro-y-old");
});

test("interval month (the sandbox defect), a trial, a wrong price or archived: refused", () => {
  const broken: Array<[PolarProductLike, RegExp]> = [
    [product("new-1", "Viresto - Pro Yearly", 59000, { recurringInterval: "month" }), /interval is "month"/],
    [product("new-1", "Viresto - Pro Yearly", 59000, { trialInterval: "day", trialIntervalCount: 7 }), /trial/],
    [product("new-1", "Viresto - Pro Yearly", 59000, { isArchived: true }), /archived/],
  ];
  for (const [bad, expected] of broken) {
    const result = run([BIZ, BASIC, bad]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.problems.some((p) => expected.test(p)), result.problems.join("; "));
  }
});

test("name and price disagree (e.g. 'Pro Yearly' at Basic's price): refused, not guessed", () => {
  const result = run([BIZ, product("new-1", "Viresto - Pro Yearly", 29000), BASIC]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.problems.some((p) => /name says PRO but the price/.test(p)), result.problems.join("; "));
});

test("two products for one plan, a missing plan, a name that is not yearly: refused", () => {
  const twice = run([PRO, BIZ, product("new-9", "Viresto - Pro Yearly", 59000)]);
  assert.equal(twice.ok, false);
  if (!twice.ok) {
    assert.ok(twice.problems.some((p) => /second product for PRO/.test(p)));
    assert.ok(twice.problems.some((p) => /no product for BASIC/.test(p)));
  }

  const notYearly = run([BIZ, BASIC, product("new-1", "Viresto - Pro Monthly", 59000)]);
  assert.equal(notYearly.ok, false);

  const two = run([BIZ, BASIC]);
  assert.equal(two.ok, false);
});

test("'Pro' does not match inside another word ('Professional Basic' is not Pro)", () => {
  const result = run([product("new-5", "Viresto - Professional Basic Yearly", 29000), BASIC, BIZ]);
  assert.equal(result.ok, false); // two BASIC products, no PRO
  if (!result.ok) assert.ok(result.problems.some((p) => /no product for PRO/.test(p)));
});

test("a monthly product id given as yearly: refused", () => {
  const result = run([BIZ, BASIC, product("pro-m", "Viresto - Pro Yearly", 59000)]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.problems.some((p) => /PRO's monthly product/.test(p)));
});

test("a running YEARLY subscription (may be on an old yearly product) blocks the write", () => {
  const live = run(GOOD, [{ id: "s1", tenantId: "t1", status: "ACTIVE", currentPeriodEnd: new Date("2027-01-01Z") }]);
  assert.equal(live.ok, false);

  const cancelledButPaidUp = run(GOOD, [{ id: "s2", tenantId: "t1", status: "CANCELLED", currentPeriodEnd: new Date("2026-12-01Z") }]);
  assert.equal(cancelledButPaidUp.ok, false);

  const ended = run(GOOD, [{ id: "s3", tenantId: "t1", status: "EXPIRED", currentPeriodEnd: new Date("2026-10-01Z") }]);
  assert.equal(ended.ok, true);
});

test("production rows with the old JOD prices (fils) still map: the price matched is the configured USD one", () => {
  // Old JOD yearly prices in fils (275/440/880 JOD, the pre-USD config);
  // production rows hold JOD fils (Pro monthly 40000 seen 2026-11-13).
  const legacy: PlanRow[] = PLANS.map((plan, i) => ({ ...plan, priceYearly: [275000, 440000, 880000][i] }));
  const result = planYearlyProductUpdate({ products: GOOD, plans: legacy, yearlySubscriptions: [], now: new Date("2026-11-13T12:00:00Z") });
  assert.equal(result.ok, true, result.ok ? "" : result.problems.join("; "));
  if (!result.ok) return;
  assert.deepEqual(
    Object.fromEntries(result.assignments.map((a) => [a.code, a.productId])),
    { BASIC: "new-0", PRO: "new-1", BUSINESS: "new-2" },
  );

  // A product at the row's JOD figure is refused, not matched.
  const atRowPrice = planYearlyProductUpdate({
    products: [product("x", "Viresto - Pro Yearly", 440000), BASIC, BIZ],
    plans: legacy,
    yearlySubscriptions: [],
    now: new Date("2026-11-13T12:00:00Z"),
  });
  assert.equal(atRowPrice.ok, false);
});
