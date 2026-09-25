import assert from "node:assert/strict";
import test from "node:test";
import { isMachineAuthenticatedPath } from "../../src/lib/request-path-policy";

test("machine-authenticated handlers bypass the user session check", () => {
  assert.equal(isMachineAuthenticatedPath("/api/health"), true);
  assert.equal(isMachineAuthenticatedPath("/api/cron/prune-activity"), true);
  assert.equal(
    isMachineAuthenticatedPath("/api/cron/generate-notifications"),
    true,
  );
  assert.equal(
    isMachineAuthenticatedPath("/api/billing/webhooks/polar"),
    true,
  );
});

test("machine-authenticated path matching stays exact", () => {
  assert.equal(isMachineAuthenticatedPath("/api/health/details"), false);
  assert.equal(isMachineAuthenticatedPath("/api/perf/db"), false);
  assert.equal(isMachineAuthenticatedPath("/api/cron"), false);
  assert.equal(isMachineAuthenticatedPath("/api/billing/checkout"), false);
  assert.equal(isMachineAuthenticatedPath("/api/billing/webhooks"), false);
});

test("a locked office keeps only account, billing and the settings read", async () => {
  const { isSubscriptionExemptPath } = await import(
    "../../src/lib/request-path-policy"
  );

  assert.equal(isSubscriptionExemptPath("/api/auth/logout", "POST"), true);
  assert.equal(isSubscriptionExemptPath("/api/billing/checkout", "POST"), true);
  assert.equal(isSubscriptionExemptPath("/api/settings", "GET"), true);
  assert.equal(isSubscriptionExemptPath("/api/settings", "PATCH"), false);
  assert.equal(isSubscriptionExemptPath("/api/settings/ai", "GET"), false);
  assert.equal(isSubscriptionExemptPath("/api/billingx", "GET"), false);
  assert.equal(isSubscriptionExemptPath("/api/authx", "GET"), false);
  assert.equal(isSubscriptionExemptPath("/api/cases", "GET"), false);
});
