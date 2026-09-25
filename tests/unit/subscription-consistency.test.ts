import assert from "node:assert/strict";
import test from "node:test";
import { BillingInterval } from "@prisma/client";
import {
  PLANS,
  currencyMinorUnits,
  formatYearlySavings,
  getYearlySavingsMonths,
} from "../../src/config/plans";
import {
  addBillingPeriod,
  getBillingPlanConfig,
  parseBillingInterval,
} from "../../src/lib/subscription-consistency";

test("plan prices match the Polar USD products", () => {
  const prices = Object.fromEntries(
    PLANS.map((plan) => [plan.code, [plan.priceUsd, plan.priceYearlyUsd]]),
  );

  assert.deepEqual(prices, {
    BASIC: [29, 290],
    PRO: [59, 590],
    BUSINESS: [119, 1190],
  });

  for (const plan of PLANS) {
    assert.equal(getYearlySavingsMonths(plan), 2);
    assert.equal(formatYearlySavings(plan, "en"), "save two months");
    assert.equal(formatYearlySavings(plan, "ar"), "وفّر قيمة شهرين");
  }
});

test("billing plan config records USD amounts in cents", () => {
  assert.deepEqual(
    [
      getBillingPlanConfig("pro", BillingInterval.MONTHLY)?.currency,
      getBillingPlanConfig("pro", BillingInterval.MONTHLY)?.amount,
      getBillingPlanConfig("BUSINESS", BillingInterval.YEARLY)?.amount,
    ],
    ["USD", 5900, 119000],
  );
  assert.equal(currencyMinorUnits("USD"), 100);
  assert.equal(currencyMinorUnits("jod"), 1000);
});

test("parseBillingInterval rejects missing or malformed intervals", () => {
  assert.equal(
    parseBillingInterval(BillingInterval.MONTHLY),
    BillingInterval.MONTHLY,
  );
  assert.equal(
    parseBillingInterval(BillingInterval.YEARLY),
    BillingInterval.YEARLY,
  );
  assert.equal(parseBillingInterval("monthly"), null);
  assert.equal(parseBillingInterval("WEEKLY"), null);
  assert.equal(parseBillingInterval(null), null);
});

test("addBillingPeriod clamps month-end without mutating the source date", () => {
  const start = new Date("2024-01-31T18:45:30.000Z");
  const end = addBillingPeriod(start, BillingInterval.MONTHLY);

  assert.equal(start.toISOString(), "2024-01-31T18:45:30.000Z");
  assert.equal(end.toISOString(), "2024-02-29T18:45:30.000Z");
});

test("addBillingPeriod handles a leap-day yearly subscription", () => {
  const end = addBillingPeriod(
    new Date("2024-02-29T07:15:00.000Z"),
    BillingInterval.YEARLY,
  );

  assert.equal(end.toISOString(), "2025-02-28T07:15:00.000Z");
});
