import { test } from "node:test";
import assert from "node:assert/strict";
import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription.js";
import { driftReason } from "../../src/lib/polar-reconcile";

// Which differences between our row and Polar's current state make the
// daily reconciliation re-sync an office (AUDIT_REPORT.md H2).

const periodEnd = new Date("2026-11-17T00:00:00.000Z");
const plans = new Map([
  ["prod_pro_m", "plan_pro"],
  ["prod_basic_m", "plan_basic"],
]);

function polar(overrides: Partial<PolarSubscription> = {}) {
  return {
    id: "sub_1",
    status: "active",
    productId: "prod_pro_m",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: periodEnd,
    ...overrides,
  } as PolarSubscription;
}

const row = {
  polarSubscriptionId: "sub_1",
  tenantId: "tenant_1",
  status: "ACTIVE" as const,
  planId: "plan_pro",
  currentPeriodEnd: new Date(periodEnd),
  cancelAtPeriodEnd: false,
};

test("in sync: no drift", () => {
  assert.equal(driftReason(row, polar(), plans), null);
});

test("each kind of drift is named", () => {
  assert.equal(driftReason(undefined, polar(), plans), "missing");
  assert.equal(driftReason(row, polar({ status: "past_due" }), plans), "status");
  assert.equal(driftReason(row, polar({ productId: "prod_basic_m" }), plans), "plan");
  assert.equal(driftReason(row, polar({ cancelAtPeriodEnd: true }), plans), "cancel_at_period_end");
  assert.equal(
    driftReason(row, polar({ currentPeriodEnd: new Date("2026-12-17T00:00:00.000Z") }), plans),
    "period",
  );
});
