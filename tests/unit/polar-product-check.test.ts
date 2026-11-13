import { test } from "node:test";
import assert from "node:assert/strict";
import { polarProductProblems, type PolarProductLike } from "../../src/lib/polar-product-check";

function product(overrides: Partial<PolarProductLike> = {}): PolarProductLike {
  return {
    id: "p1",
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

const YEARLY = { cycle: "yearly" as const, amountCents: 59000, requireNoTrial: true };

test("a correct yearly product has no problems", () => {
  assert.deepEqual(polarProductProblems(product(), YEARLY), []);
});

test("the 2026-11-13 sandbox defect: a 'Yearly' product recurring every month is caught", () => {
  const problems = polarProductProblems(product({ recurringInterval: "month" }), YEARLY);
  assert.deepEqual(problems, ['interval is "month", expected "year"']);
});

test("monthly cycle expects interval month", () => {
  const monthly = { cycle: "monthly" as const, amountCents: 5900, requireNoTrial: true };
  const ok = product({
    recurringInterval: "month",
    prices: [{ amountType: "fixed", priceAmount: 5900, priceCurrency: "usd", isArchived: false }],
  });
  assert.deepEqual(polarProductProblems(ok, monthly), []);
  assert.equal(polarProductProblems({ ...ok, recurringInterval: "year" }, monthly).length, 1);
});

test("price, currency, type, archived, interval count, not recurring are each reported", () => {
  const cases: Array<[Partial<PolarProductLike>, RegExp]> = [
    [{ prices: [{ amountType: "fixed", priceAmount: 5900, priceCurrency: "usd" }] }, /price is 5900/],
    [{ prices: [{ amountType: "fixed", priceAmount: 59000, priceCurrency: "eur" }] }, /currency/],
    [{ prices: [{ amountType: "custom", priceAmount: 59000, priceCurrency: "usd" }] }, /price type/],
    [{ prices: [] }, /0 active prices/],
    [{ isArchived: true }, /archived/],
    [{ recurringIntervalCount: 2 }, /interval count is 2/],
    [{ isRecurring: false, recurringInterval: null }, /not recurring/],
  ];
  for (const [overrides, expected] of cases) {
    const problems = polarProductProblems(product(overrides), YEARLY);
    assert.ok(problems.some((p) => expected.test(p)), `${JSON.stringify(overrides)} -> ${problems}`);
  }
});

test("an archived price does not count; two active prices are a problem", () => {
  const withArchived = product({
    prices: [
      { amountType: "fixed", priceAmount: 1, priceCurrency: "usd", isArchived: true },
      { amountType: "fixed", priceAmount: 59000, priceCurrency: "usd", isArchived: false },
    ],
  });
  assert.deepEqual(polarProductProblems(withArchived, YEARLY), []);
  const two = product({
    prices: [
      { amountType: "fixed", priceAmount: 59000, priceCurrency: "usd" },
      { amountType: "fixed", priceAmount: 59000, priceCurrency: "usd" },
    ],
  });
  assert.deepEqual(polarProductProblems(two, YEARLY), ["2 active prices, expected 1"]);
});

test("a trial is a problem only when requireNoTrial is set", () => {
  const withTrial = product({ trialInterval: "day", trialIntervalCount: 14 });
  assert.equal(polarProductProblems(withTrial, YEARLY).length, 1);
  assert.deepEqual(polarProductProblems(withTrial, { ...YEARLY, requireNoTrial: false }), []);
});
