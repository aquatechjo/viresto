import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Runs the real POST handler of src/app/api/billing/checkout/confirm with
// auth, CSRF, the Polar client, and the sync helpers mocked. Proves the
// instant unlock syncs only when every server-side check passes.

const TENANT = "tenant-1";

const requireRoleMock = mock.fn(async () => ({
  error: null,
  user: { userId: "user-1", tenantId: TENANT, role: "ADMIN" },
}));

let checkout: Record<string, unknown>;
let subscription: Record<string, unknown>;

const checkoutsGet = mock.fn(async () => checkout);
const subscriptionsGet = mock.fn(async () => subscription);
const syncMock = mock.fn(async () => ({
  ok: true,
  tenantId: TENANT,
  status: "ACTIVE",
  entitled: true,
  tenantSource: "metadata",
}));

mock.module("@/lib/api-auth", { namedExports: { requireRole: requireRoleMock } });
mock.module("@/lib/csrf", { namedExports: { verifySameOrigin: () => null } });
mock.module("@/lib/polar", {
  namedExports: {
    getPolarClient: () => ({
      checkouts: { get: checkoutsGet },
      subscriptions: { get: subscriptionsGet },
    }),
  },
});
mock.module("@/lib/polar-subscription-sync", {
  namedExports: {
    syncSubscriptionFromPolar: syncMock,
    findBillingPlanForPolarProduct: async (productId: string) =>
      productId === "prod_pro_monthly" ? { id: "plan-pro" } : null,
  },
});

let POST: (typeof import("../../src/app/api/billing/checkout/confirm/route"))["POST"];

before(async () => {
  ({ POST } = await import("../../src/app/api/billing/checkout/confirm/route"));
});

beforeEach(() => {
  checkout = {
    id: "chk_1",
    status: "succeeded",
    productId: "prod_pro_monthly",
    subscriptionId: "sub_1",
    metadata: { tenantId: TENANT },
  };
  subscription = {
    id: "sub_1",
    productId: "prod_pro_monthly",
    checkoutId: "chk_1",
    metadata: { tenantId: TENANT },
  };
  checkoutsGet.mock.resetCalls();
  subscriptionsGet.mock.resetCalls();
  syncMock.mock.resetCalls();
});

async function confirm(checkoutId: unknown = "chk_1") {
  const res = await POST(
    new NextRequest("http://localhost/api/billing/checkout/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkoutId }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

test("instant unlock: a succeeded checkout for this office syncs immediately", async () => {
  const { status, body } = await confirm();

  assert.equal(status, 200);
  assert.deepEqual(body.data, { synced: true, entitled: true });
  assert.equal(syncMock.mock.callCount(), 1);
});

test("instant unlock: 'confirmed' status is also accepted", async () => {
  checkout.status = "confirmed";
  const { body } = await confirm();
  assert.equal(body.data.synced, true);
});

for (const [name, mutate, reason] of [
  ["an open (unpaid) checkout", () => (checkout.status = "open"), "checkout_not_paid"],
  ["a failed checkout", () => (checkout.status = "failed"), "checkout_not_paid"],
  [
    "a checkout for another office",
    () => (checkout.metadata = { tenantId: "tenant-2" }),
    "tenant_mismatch",
  ],
  ["a checkout without tenant metadata", () => (checkout.metadata = {}), "tenant_mismatch"],
  [
    "a foreign product",
    () => (checkout.productId = "prod_other_app"),
    "unknown_product",
  ],
  [
    "a checkout whose subscription does not exist yet",
    () => (checkout.subscriptionId = null),
    "subscription_pending",
  ],
  [
    "a subscription from a different checkout",
    () => (subscription.checkoutId = "chk_other"),
    "subscription_mismatch",
  ],
  [
    "a subscription whose metadata names another office",
    () => (subscription.metadata = { tenantId: "tenant-2" }),
    "subscription_mismatch",
  ],
] as const) {
  test(`instant unlock: ${name} is not synced (waits for the webhook)`, async () => {
    mutate();
    const { status, body } = await confirm();

    assert.equal(status, 200);
    assert.deepEqual(body.data, { synced: false, reason });
    assert.equal(syncMock.mock.callCount(), 0);
  });
}

test("instant unlock: a malformed checkout id never reaches Polar", async () => {
  const { body } = await confirm("../../orders/x");
  assert.equal(body.data.reason, "invalid_checkout_id");
  assert.equal(checkoutsGet.mock.callCount(), 0);
});

test("instant unlock: a Polar API error just means wait for the webhook", async () => {
  checkoutsGet.mock.mockImplementationOnce(async () => {
    throw new Error("404");
  });
  const { body } = await confirm();
  assert.deepEqual(body.data, { synced: false, reason: "checkout_unavailable" });
});
