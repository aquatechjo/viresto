import { NextRequest } from "next/server";
import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription.js";
import { ok } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { getPolarClient } from "@/lib/polar";
import {
  findBillingPlanForPolarProduct,
  isPolarSubscriptionSyncedForTenant,
  syncSubscriptionFromPolar,
} from "@/lib/polar-subscription-sync";

// Instant unlock when the admin lands back from Polar checkout
// (?checkout_id={CHECKOUT_ID}), instead of waiting for the webhook.
// Server-side only, and it syncs only when every check passes:
//   - the checkout is succeeded/confirmed,
//   - its metadata.tenantId is the logged-in user's office,
//   - its product is one of our BillingPlan products,
//   - the subscription it created is the same purchase (same checkout,
//     same product, same tenant in metadata). A first purchase is found
//     among the customer's subscriptions by its checkoutId: the checkout
//     itself never points to it.
// Any failed check returns synced:false and the webhook remains the path.

const PAID_CHECKOUT_STATUSES = new Set(["succeeded", "confirmed"]);
const CHECKOUT_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

type NotSyncedReason =
  | "invalid_checkout_id"
  | "checkout_unavailable"
  | "checkout_not_paid"
  | "tenant_mismatch"
  | "unknown_product"
  | "subscription_pending"
  | "subscription_mismatch"
  | "sync_rejected";

function notSynced(reason: NotSyncedReason, checkoutId?: string) {
  // Expected outcomes (e.g. still processing), so a plain info line:
  // ids only, no payload.
  console.info(
    `[polar-checkout] not_synced reason=${reason}${checkoutId ? ` checkout=${checkoutId}` : ""}`,
  );
  return ok({ synced: false, reason });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const body = await req.json().catch(() => null);
    const checkoutId = typeof body?.checkoutId === "string" ? body.checkoutId : "";

    if (!CHECKOUT_ID_PATTERN.test(checkoutId)) {
      return notSynced("invalid_checkout_id");
    }

    const polar = getPolarClient();

    let checkout;
    try {
      checkout = await polar.checkouts.get({ id: checkoutId });
    } catch {
      return notSynced("checkout_unavailable", checkoutId);
    }

    if (!PAID_CHECKOUT_STATUSES.has(checkout.status)) {
      return notSynced("checkout_not_paid", checkoutId);
    }

    if (checkout.metadata?.tenantId !== auth.user.tenantId) {
      return notSynced("tenant_mismatch", checkoutId);
    }

    if (!(await findBillingPlanForPolarProduct(checkout.productId))) {
      return notSynced("unknown_product", checkoutId);
    }

    // Checkout.subscriptionId is only set when a checkout updates an existing
    // subscription; a first purchase leaves it null for good (seen on the
    // 2026-10-28 production purchase). Find the subscription this checkout
    // created among the customer's subscriptions to this product instead.
    let subscription: PolarSubscription | null = null;
    try {
      if (checkout.subscriptionId) {
        subscription = await polar.subscriptions.get({ id: checkout.subscriptionId });
      } else if (checkout.customerId) {
        const page = await polar.subscriptions.list({
          customerId: checkout.customerId,
          productId: checkout.productId,
          limit: 20,
        });
        subscription =
          page.result.items.find((item) => item.checkoutId === checkout.id) ?? null;
      }
    } catch {
      return notSynced("subscription_pending", checkoutId);
    }

    // Polar creates the subscription a moment after the payment.
    if (!subscription) {
      return notSynced("subscription_pending", checkoutId);
    }

    // The webhook (or an earlier poll of this route) already synced it:
    // report success without a second sync.
    if (await isPolarSubscriptionSyncedForTenant(subscription.id, auth.user.tenantId)) {
      return ok({ synced: true, entitled: true });
    }

    if (
      subscription.productId !== checkout.productId ||
      (subscription.checkoutId && subscription.checkoutId !== checkout.id) ||
      subscription.metadata?.tenantId !== auth.user.tenantId
    ) {
      return notSynced("subscription_mismatch", checkoutId);
    }

    const result = await syncSubscriptionFromPolar(subscription);

    if (!result.ok || result.tenantId !== auth.user.tenantId) {
      return notSynced("sync_rejected", checkoutId);
    }

    return ok({ synced: true, entitled: result.entitled });
  });
}
