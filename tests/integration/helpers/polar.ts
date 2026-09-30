import { NextRequest } from "next/server";
import { Webhook } from "standardwebhooks";

// Polar webhook payloads shaped like the ones Polar sends, accepted by the
// real @polar-sh/sdk validateEvent (same shape as the unit-test fixtures in
// tests/unit/billing-webhook-route.test.ts), and signed for real.

export const TEST_PRODUCTS = {
  BASIC: { monthly: "it_prod_basic_m", yearly: "it_prod_basic_y" },
  PRO: { monthly: "it_prod_pro_m", yearly: "it_prod_pro_y" },
  BUSINESS: { monthly: "it_prod_business_m", yearly: "it_prod_business_y" },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PolarSubscriptionInput = {
  id: string;
  tenantId: string;
  productId?: string;
  status?: string;
  periodStart?: Date;
  periodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
};

function customer(tenantId: string) {
  const now = new Date().toISOString();
  return {
    id: `cust_${tenantId}`,
    created_at: now,
    modified_at: null,
    metadata: {},
    external_id: tenantId,
    email: "billing@example.com",
    email_verified: true,
    type: "individual",
    name: null,
    billing_name: null,
    billing_address: null,
    tax_id: null,
    locale: null,
    organization_id: "org_it",
    deleted_at: null,
    avatar_url: null,
  };
}

function product(productId: string) {
  const now = new Date().toISOString();
  return {
    id: productId,
    created_at: now,
    modified_at: null,
    trial_interval: null,
    trial_interval_count: null,
    name: productId,
    description: null,
    visibility: "public",
    recurring_interval: "month",
    recurring_interval_count: 1,
    meter_interval: null,
    meter_interval_count: null,
    is_recurring: true,
    is_archived: false,
    organization_id: "org_it",
    metadata: {},
    prices: [],
    benefits: [],
    medias: [],
    attached_custom_fields: [],
  };
}

export function polarSubscriptionEvent(type: string, input: PolarSubscriptionInput) {
  const now = new Date();
  const productId = input.productId ?? TEST_PRODUCTS.PRO.monthly;
  const periodStart = input.periodStart ?? now;
  const periodEnd = input.periodEnd ?? new Date(periodStart.getTime() + 30 * DAY_MS);

  return {
    type,
    timestamp: now.toISOString(),
    data: {
      created_at: now.toISOString(),
      modified_at: null,
      id: input.id,
      amount: 5900,
      currency: "usd",
      recurring_interval: "month",
      recurring_interval_count: 1,
      status: input.status ?? "active",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      current_meter_period_start: null,
      current_meter_period_end: null,
      trial_start: null,
      trial_end: null,
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      canceled_at: null,
      started_at: now.toISOString(),
      ends_at: null,
      ended_at: null,
      pause_at_period_end: false,
      paused_at: null,
      resumes_at: null,
      customer_id: `cust_${input.tenantId}`,
      product_id: productId,
      discount_id: null,
      checkout_id: null,
      customer_cancellation_reason: null,
      customer_cancellation_comment: null,
      metadata: { tenantId: input.tenantId },
      customer: customer(input.tenantId),
      product: product(productId),
      discount: null,
      prices: [],
      meters: [],
      pending_update: null,
    },
  };
}

// --- Fake Polar API ------------------------------------------------------
// What Polar's servers currently hold for each subscription. The webhook
// route re-fetches every subscription before syncing, so a test can make a
// delivered payload disagree with this state (a stale or out-of-order
// event) and check that only this state is ever written.

type PolarSubscriptionData = ReturnType<typeof polarSubscriptionEvent>["data"];

export const polarState = new Map<string, PolarSubscriptionData>();
export const polarGetCalls: string[] = [];
export const polarCheckoutCreates: Array<Record<string, unknown>> = [];
export const polarSubscriptionUpdates: Array<{ id: string; productId: string }> = [];
// Flip to make the fake API unreachable for subscriptions.list.
export const polarFailures = { list: false };

export function setPolarState(input: PolarSubscriptionInput) {
  polarState.set(input.id, polarSubscriptionEvent("state", input).data);
}

export async function createFakePolarClient() {
  const { subscriptionFromJSON } = await import(
    "@polar-sh/sdk/models/components/subscription.js"
  );

  // The SDK's own parser: routes receive exactly the camelCase Subscription
  // object the real client would return.
  function parse(data: PolarSubscriptionData) {
    const parsed = subscriptionFromJSON(JSON.stringify(data));
    if (!parsed.ok) throw parsed.error;
    return parsed.value;
  }

  return {
    subscriptions: {
      async get({ id }: { id: string }) {
        polarGetCalls.push(id);
        const data = polarState.get(id);
        if (!data) throw new Error(`fake Polar: no subscription ${id}`);
        return parse(data);
      },

      async list(request: {
        metadata?: Record<string, unknown>;
        productId?: string[];
        status?: string[];
      }) {
        if (polarFailures.list) throw new TypeError("fetch failed");

        const items = [...polarState.values()]
          .filter(
            (data) =>
              (!request.metadata?.tenantId ||
                data.metadata.tenantId === request.metadata.tenantId) &&
              (!request.productId || request.productId.includes(data.product_id)) &&
              (!request.status || request.status.includes(data.status)),
          )
          .map(parse);

        return { result: { items } };
      },

      async update({
        id,
        subscriptionUpdate,
      }: {
        id: string;
        subscriptionUpdate: { productId: string };
      }) {
        const data = polarState.get(id);
        if (!data) throw new Error(`fake Polar: no subscription ${id}`);
        polarSubscriptionUpdates.push({ id, productId: subscriptionUpdate.productId });
        data.product_id = subscriptionUpdate.productId;
        data.product = product(subscriptionUpdate.productId);
        return parse(data);
      },
    },

    checkouts: {
      async create(request: Record<string, unknown>) {
        polarCheckoutCreates.push(request);
        return { url: `https://polar.test/checkout/${polarCheckoutCreates.length}` };
      },
    },
  };
}

let messageCounter = 0;

export function signedWebhookRequest(payload: unknown, msgId?: string) {
  const secret = process.env.POLAR_WEBHOOK_SECRET!;
  const body = JSON.stringify(payload);
  msgId ??= `msg_it_${Date.now()}_${messageCounter++}`;
  const timestamp = new Date();
  const webhook = new Webhook(Buffer.from(secret, "utf-8").toString("base64"));

  return new NextRequest("http://localhost:3000/api/billing/webhooks/polar", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "webhook-id": msgId,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": webhook.sign(msgId, timestamp, body),
    },
  });
}
