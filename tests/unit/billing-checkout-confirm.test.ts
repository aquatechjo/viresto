import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Runs the real POST handler of src/app/api/billing/checkout/confirm with
// auth, CSRF, the Polar client, and the sync helpers mocked. Proves the
// instant unlock syncs only when every server-side check passes.

const TENANT = "tenant-1";

const requirePermissionMock = mock.fn(async () => ({
  error: null,
  user: { userId: "user-1", tenantId: TENANT, role: "ADMIN" },
}));

let checkout: Record<string, unknown>;
let subscription: Record<string, unknown>;

const checkoutsGet = mock.fn(async () => checkout);
const subscriptionsGet = mock.fn(async () => subscription);
// The customer's subscriptions to the checkout's product, as Polar lists them.
let listed: Record<string, unknown>[];
const subscriptionsList = mock.fn(async (_query: unknown) => ({ result: { items: listed } }));
const syncMock = mock.fn(async () => ({
  ok: true,
  tenantId: TENANT,
  status: "ACTIVE",
  entitled: true,
  tenantSource: "metadata",
}));

// Rows already in our DB, by Polar subscription id (the webhook got there first).
const syncedRows = new Map<string, string>();
const isSyncedMock = mock.fn(
  async (subscriptionId: string, tenantId: string) => syncedRows.get(subscriptionId) === tenantId,
);

mock.module("@/lib/api-auth", { namedExports: { requirePermission: requirePermissionMock } });
mock.module("@/lib/csrf", { namedExports: { verifySameOrigin: () => null } });
mock.module("@/lib/polar", {
  namedExports: {
    getPolarClient: () => ({
      checkouts: { get: checkoutsGet },
      subscriptions: { get: subscriptionsGet, list: subscriptionsList },
    }),
  },
});
mock.module("@/lib/polar-subscription-sync", {
  namedExports: {
    syncSubscriptionFromPolar: syncMock,
    isPolarSubscriptionSyncedForTenant: isSyncedMock,
    findBillingPlanForPolarProduct: async (productId: string) =>
      productId === "prod_pro_monthly" ? { id: "plan-pro" } : null,
  },
});

let POST: (typeof import("../../src/app/api/billing/checkout/confirm/route"))["POST"];

before(async () => {
  ({ POST } = await import("../../src/app/api/billing/checkout/confirm/route"));
});

beforeEach(() => {
  // A first purchase, as Polar returns it: subscriptionId stays null (it
  // is only set when a checkout updates an existing subscription).
  checkout = {
    id: "chk_1",
    status: "succeeded",
    productId: "prod_pro_monthly",
    subscriptionId: null,
    customerId: "cust_1",
    metadata: { tenantId: TENANT },
  };
  subscription = {
    id: "sub_1",
    productId: "prod_pro_monthly",
    checkoutId: "chk_1",
    metadata: { tenantId: TENANT },
  };
  listed = [subscription, { id: "sub_old", productId: "prod_pro_monthly", checkoutId: "chk_old" }];
  checkoutsGet.mock.resetCalls();
  subscriptionsList.mock.resetCalls();
  subscriptionsGet.mock.resetCalls();
  syncMock.mock.resetCalls();
  syncedRows.clear();
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
    () => (listed = [{ id: "sub_old", productId: "prod_pro_monthly", checkoutId: "chk_old" }]),
    "subscription_pending",
  ],
  [
    "a checkout without a customer yet",
    () => (checkout.customerId = null),
    "subscription_pending",
  ],
  [
    "a subscription from a different checkout",
    () => {
      // A checkout that names its subscription: checked, not trusted.
      checkout.subscriptionId = "sub_1";
      subscription.checkoutId = "chk_other";
    },
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

test("instant unlock: the webhook already synced it, so nothing is synced twice", async () => {
  syncedRows.set("sub_1", TENANT);
  const { status, body } = await confirm();

  assert.equal(status, 200);
  assert.deepEqual(body.data, { synced: true, entitled: true });
  assert.equal(syncMock.mock.callCount(), 0);
  assert.equal(subscriptionsGet.mock.callCount(), 0);
});

test("instant unlock: repeated polls after the first sync do not sync again", async () => {
  syncMock.mock.mockImplementationOnce(async () => {
    syncedRows.set("sub_1", TENANT);
    return { ok: true, tenantId: TENANT, status: "ACTIVE", entitled: true, tenantSource: "metadata" };
  });

  for (let i = 0; i < 3; i += 1) {
    const { body } = await confirm();
    assert.equal(body.data.synced, true);
  }
  assert.equal(syncMock.mock.callCount(), 1);
});

test("instant unlock: a synced row for another office does not count", async () => {
  syncedRows.set("sub_1", "tenant-2");
  const { body } = await confirm();
  // Falls through to the full checks and sync for this office.
  assert.equal(body.data.synced, true);
  assert.equal(syncMock.mock.callCount(), 1);
});

test("instant unlock: a first purchase finds its subscription by checkout among the customer's", async () => {
  const { body } = await confirm();

  assert.deepEqual(body.data, { synced: true, entitled: true });
  assert.deepEqual(subscriptionsList.mock.calls[0].arguments[0], {
    customerId: "cust_1",
    productId: "prod_pro_monthly",
    limit: 20,
  });
  assert.equal(subscriptionsGet.mock.callCount(), 0);
  assert.equal((syncMock.mock.calls[0].arguments as unknown[])[0], subscription);
});

test("instant unlock: a checkout that updates a subscription fetches that one directly", async () => {
  checkout.subscriptionId = "sub_1";
  const { body } = await confirm();

  assert.equal(body.data.synced, true);
  assert.equal(subscriptionsGet.mock.callCount(), 1);
  assert.equal(subscriptionsList.mock.callCount(), 0);
});

test("instant unlock: a Polar error while listing just means wait", async () => {
  subscriptionsList.mock.mockImplementationOnce(async () => {
    throw new Error("503");
  });
  const { body } = await confirm();
  assert.deepEqual(body.data, { synced: false, reason: "subscription_pending" });
});
