import assert from "node:assert/strict";
import test from "node:test";
import { BillingInterval } from "@prisma/client";
import {
  addBillingPeriod,
  parseBillingInterval,
} from "../../src/lib/subscription-consistency";

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
