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
    isMachineAuthenticatedPath("/api/cron/reconcile-billing"),
    true,
  );
  assert.equal(
    isMachineAuthenticatedPath("/api/billing/webhooks/polar"),
    true,
  );
});

test("machine-authenticated path matching stays exact", () => {
  assert.equal(isMachineAuthenticatedPath("/api/health/details"), false);
  assert.equal(isMachineAuthenticatedPath("/api/cases"), false);
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
  assert.equal(isSubscriptionExemptPath("/api/data-requests/export", "GET"), true);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/export", "POST"), false);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/deletion", "POST"), true);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/deletion", "GET"), false);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/other", "GET"), false);
  assert.equal(isSubscriptionExemptPath("/api/data-requests", "GET"), false);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/documents", "GET"), true);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/documents", "POST"), false);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/documents/abc123", "GET"), true);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/documents/abc123", "DELETE"), false);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/documents/abc123/x", "GET"), false);
  assert.equal(isSubscriptionExemptPath("/api/data-requests/documents/", "GET"), false);
  assert.equal(isSubscriptionExemptPath("/api/documents/abc123", "GET"), false);
});

test("a demo office cannot reach billing, account security, invitations or data requests", async () => {
  const { isDemoBlockedPath } = await import("../../src/lib/request-path-policy");

  for (const [path, method] of [
    ["/api/billing", "GET"],
    ["/api/billing/checkout", "POST"],
    ["/api/billing/checkout/confirm", "POST"],
    ["/api/billing/portal", "POST"],
    ["/api/data-requests/export", "GET"],
    ["/api/data-requests/deletion", "POST"],
    ["/api/settings/ai", "PATCH"],
    ["/api/team", "POST"],
    ["/api/team/invitations/abc", "POST"],
    ["/api/auth/2fa/setup", "POST"],
    ["/api/auth/session/revoke-others", "POST"],
    ["/api/auth/change-email", "POST"],
    ["/api/auth/update-profile", "PATCH"],
  ]) {
    assert.equal(isDemoBlockedPath(path, method), true, `${method} ${path}`);
  }
});

test("a demo office keeps every working feature and the access read", async () => {
  const { isDemoBlockedPath } = await import("../../src/lib/request-path-policy");

  for (const [path, method] of [
    ["/api/billing/access", "GET"],
    ["/api/clients", "POST"],
    ["/api/cases/abc", "PATCH"],
    ["/api/invoices", "POST"],
    ["/api/payments/abc", "DELETE"],
    ["/api/documents", "POST"],
    ["/api/upload/sign", "POST"],
    ["/api/ai/chat", "POST"],
    ["/api/team", "GET"],
    ["/api/settings", "GET"],
    ["/api/settings/ai", "GET"],
    ["/api/auth/me", "GET"],
    ["/api/auth/session/activity", "POST"],
    ["/api/auth/logout", "POST"],
  ]) {
    assert.equal(isDemoBlockedPath(path, method), false, `${method} ${path}`);
  }
});
