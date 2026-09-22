import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { Webhook } from "standardwebhooks";

// This suite exercises the real POST handler from
// src/app/api/billing/webhooks/polar/route.ts. Signature verification is
// NOT mocked: payloads below are signed with the actual `standardwebhooks`
// Webhook class (the same one @polar-sh/sdk/webhooks uses internally), and
// event payloads are validated against the SDK's real zod schemas via the
// real `validateEvent`. Only the DB-sync helper and the Polar API client
// are mocked, so no network/DB calls happen.

const TEST_SECRET = "w".repeat(32);
process.env.POLAR_WEBHOOK_SECRET = TEST_SECRET;

const subscriptionsGetMock = mock.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>(
  async () => fetchedSubscriptionFixture(),
);
const getPolarClientMock = mock.fn(() => ({
  subscriptions: { get: subscriptionsGetMock },
}));
const syncSubscriptionFromPolarMock = mock.fn<
  (...args: unknown[]) => Promise<Record<string, unknown>>
>(async () => ({ id: "synced" }));

mock.module("@/lib/polar", {
  namedExports: { getPolarClient: getPolarClientMock },
});
mock.module("@/lib/polar-subscription-sync", {
  namedExports: { syncSubscriptionFromPolar: syncSubscriptionFromPolarMock },
});

let POST: (typeof import("../../src/app/api/billing/webhooks/polar/route"))["POST"];

before(async () => {
  ({ POST } = await import("../../src/app/api/billing/webhooks/polar/route"));
});

beforeEach(() => {
  subscriptionsGetMock.mock.resetCalls();
  getPolarClientMock.mock.resetCalls();
  syncSubscriptionFromPolarMock.mock.resetCalls();
  subscriptionsGetMock.mock.mockImplementation(async () => fetchedSubscriptionFixture());
  syncSubscriptionFromPolarMock.mock.mockImplementation(async () => ({ id: "synced" }));
});

function sign(body: string, secret = TEST_SECRET, msgId = "msg_test_1", timestamp = new Date()) {
  const base64Secret = Buffer.from(secret, "utf-8").toString("base64");
  const webhook = new Webhook(base64Secret);
  return {
    "webhook-id": msgId,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": webhook.sign(msgId, timestamp, body),
  };
}

function makeRequest(payload: unknown, headers?: Record<string, string>) {
  const body = JSON.stringify(payload);
  return new NextRequest("http://localhost/api/billing/webhooks/polar", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...(headers ?? sign(body)) },
  });
}

// --- Fixtures, hand-verified against the installed @polar-sh/sdk zod
// schemas (WebhookSubscriptionCreatedPayload$inboundSchema /
// WebhookOrderPaidPayload$inboundSchema) so validateEvent() accepts them
// for real, exactly as Polar's servers would send them. ---

function subscriptionCustomerFixture() {
  const now = new Date().toISOString();
  return {
    id: "cust_1",
    created_at: now,
    modified_at: null,
    metadata: {},
    external_id: "tenant-1",
    email: "test@example.com",
    email_verified: true,
    type: "individual",
    name: null,
    billing_name: null,
    billing_address: null,
    tax_id: null,
    locale: null,
    organization_id: "org_1",
    deleted_at: null,
    avatar_url: null,
  };
}

function productFixture() {
  const now = new Date().toISOString();
  return {
    id: "prod_1",
    created_at: now,
    modified_at: null,
    trial_interval: null,
    trial_interval_count: null,
    name: "Pro Monthly",
    description: null,
    visibility: "public",
    recurring_interval: "month",
    recurring_interval_count: 1,
    meter_interval: null,
    meter_interval_count: null,
    is_recurring: true,
    is_archived: false,
    organization_id: "org_1",
    metadata: {},
    prices: [],
    benefits: [],
    medias: [],
    attached_custom_fields: [],
  };
}

function subscriptionDataFixture(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    created_at: now,
    modified_at: null,
    id: "sub_1",
    amount: 2900,
    currency: "usd",
    recurring_interval: "month",
    recurring_interval_count: 1,
    status: "active",
    current_period_start: now,
    current_period_end: now,
    current_meter_period_start: null,
    current_meter_period_end: null,
    trial_start: null,
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    started_at: now,
    ends_at: null,
    ended_at: null,
    pause_at_period_end: false,
    paused_at: null,
    resumes_at: null,
    customer_id: "cust_1",
    product_id: "prod_1",
    discount_id: null,
    checkout_id: null,
    customer_cancellation_reason: null,
    customer_cancellation_comment: null,
    metadata: { tenantId: "tenant-1" },
    customer: subscriptionCustomerFixture(),
    product: productFixture(),
    discount: null,
    prices: [],
    meters: [],
    pending_update: null,
    ...overrides,
  };
}

function subscriptionEventPayload(type: string) {
  return {
    type,
    timestamp: new Date().toISOString(),
    data: subscriptionDataFixture(),
  };
}

function orderPayload(type: "order.paid" | "order.created") {
  const now = new Date().toISOString();
  return {
    type,
    timestamp: now,
    data: {
      id: "order_1",
      created_at: now,
      modified_at: null,
      status: "paid",
      paid: true,
      subtotal_amount: 2900,
      discount_amount: 0,
      net_amount: 2900,
      tax_amount: 0,
      total_amount: 2900,
      applied_balance_amount: 0,
      due_amount: 0,
      refunded_amount: 0,
      refunded_tax_amount: 0,
      currency: "usd",
      billing_reason: "subscription_cycle",
      billing_name: null,
      billing_address: null,
      invoice_number: null,
      is_invoice_generated: false,
      receipt_number: null,
      customer_id: "cust_1",
      product_id: "prod_1",
      discount_id: null,
      subscription_id: "sub_1",
      checkout_id: null,
      metadata: {},
      platform_fee_amount: 0,
      platform_fee_currency: null,
      customer: subscriptionCustomerFixture(),
      product: null,
      discount: null,
      subscription: null,
      items: [],
      description: "Subscription renewal",
      refundable_amount: 2900,
      refundable_tax_amount: 0,
    },
  };
}

function fetchedSubscriptionFixture() {
  return { id: "sub_1", productId: "prod_1", status: "active" };
}

test("webhook: rejects a request missing the signature headers", async () => {
  const res = await POST(makeRequest(subscriptionEventPayload("subscription.created"), {}));
  assert.equal(res.status, 403);
  assert.equal(syncSubscriptionFromPolarMock.mock.callCount(), 0);
});

test("webhook: rejects a request signed with the wrong secret", async () => {
  const payload = subscriptionEventPayload("subscription.created");
  const body = JSON.stringify(payload);
  const wrongHeaders = sign(body, "x".repeat(32));

  const res = await POST(makeRequest(payload, wrongHeaders));
  assert.equal(res.status, 403);
  assert.equal(syncSubscriptionFromPolarMock.mock.callCount(), 0);
});

for (const type of [
  "subscription.created",
  "subscription.active",
  "subscription.updated",
  "subscription.canceled",
]) {
  test(`webhook: a correctly signed ${type} event passes verification and syncs the subscription`, async () => {
    const payload = subscriptionEventPayload(type);
    const res = await POST(makeRequest(payload));

    assert.equal(res.status, 200);
    assert.equal(syncSubscriptionFromPolarMock.mock.callCount(), 1);
    assert.equal(
      (syncSubscriptionFromPolarMock.mock.calls[0].arguments[0] as { id: string }).id,
      "sub_1",
    );
  });
}

test("webhook: order.paid fetches the full subscription via the Polar API before syncing", async () => {
  const res = await POST(makeRequest(orderPayload("order.paid")));
  const json = await res.json();

  assert.equal(res.status, 200);
  assert.equal(json.success, true);
  assert.equal(subscriptionsGetMock.mock.callCount(), 1);
  assert.deepEqual(subscriptionsGetMock.mock.calls[0].arguments[0], { id: "sub_1" });
  assert.equal(syncSubscriptionFromPolarMock.mock.callCount(), 1);
  // Must sync the object returned by subscriptions.get(), not the raw order payload.
  assert.deepEqual(
    syncSubscriptionFromPolarMock.mock.calls[0].arguments[0],
    fetchedSubscriptionFixture(),
  );
});

test("webhook: an unhandled event type (order.created) is accepted but never syncs", async () => {
  const res = await POST(makeRequest(orderPayload("order.created")));

  assert.equal(res.status, 200);
  assert.equal(syncSubscriptionFromPolarMock.mock.callCount(), 0);
  assert.equal(subscriptionsGetMock.mock.callCount(), 0);
});

test("webhook: a downstream sync failure returns 500 instead of crashing", async () => {
  syncSubscriptionFromPolarMock.mock.mockImplementation(async () => {
    throw new Error("db unavailable");
  });

  const res = await POST(makeRequest(subscriptionEventPayload("subscription.created")));
  assert.equal(res.status, 500);
});
