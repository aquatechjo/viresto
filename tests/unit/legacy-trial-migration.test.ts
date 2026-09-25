import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyLegacyTenant,
  type LegacySubscriptionRow,
  type LegacyTenantRow,
} from "../../src/lib/legacy-trial-migration";

const DAY = 24 * 60 * 60 * 1000;

function row(overrides: Partial<LegacySubscriptionRow> = {}): LegacySubscriptionRow {
  return {
    id: "s",
    status: "TRIALING",
    amount: 0,
    polarSubscriptionId: null,
    trialStartsAt: null,
    trialEndsAt: new Date(Date.now() - 30 * DAY),
    currentPeriodEnd: new Date(Date.now() - 30 * DAY),
    createdAt: new Date(Date.now() - 37 * DAY),
    ...overrides,
  };
}

function tenant(subscriptions: LegacySubscriptionRow[], overrides: Partial<LegacyTenantRow> = {}): LegacyTenantRow {
  return {
    id: "t",
    name: "Office",
    status: "TRIAL",
    isSuspended: false,
    createdAt: new Date(),
    subscriptions,
    ...overrides,
  };
}

test("(a) the old 7-day signup trial, expired or not, gets migrated", () => {
  assert.equal(classifyLegacyTenant(tenant([row()])), "A_LEGACY_TRIAL");
  assert.equal(
    classifyLegacyTenant(tenant([row({ status: "EXPIRED" })])),
    "A_LEGACY_TRIAL",
  );
  assert.equal(classifyLegacyTenant(tenant([])), "A_LEGACY_TRIAL");
});

test("(b) an admin-granted subscription is listed, never migrated", () => {
  assert.equal(
    classifyLegacyTenant(
      tenant([row({ status: "ACTIVE", amount: 5900, trialEndsAt: null }), row()]),
    ),
    "B_ADMIN_GRANTED",
  );
});

test("(c) any Polar subscription leaves the office untouched", () => {
  assert.equal(
    classifyLegacyTenant(tenant([row({ polarSubscriptionId: "polar_1", status: "ACTIVE" }), row()])),
    "C_POLAR",
  );
});

test("offices already on the new explicit trial, and suspended offices, are skipped", () => {
  assert.equal(
    classifyLegacyTenant(tenant([row({ trialStartsAt: new Date() })])),
    "SKIP_NEW_TRIAL",
  );
  assert.equal(
    classifyLegacyTenant(tenant([row()], { isSuspended: true })),
    "SKIP_SUSPENDED",
  );
});
