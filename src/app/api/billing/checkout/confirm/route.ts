import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { getPolarClient } from "@/lib/polar";
import {
  findBillingPlanForPolarProduct,
  syncSubscriptionFromPolar,
} from "@/lib/polar-subscription-sync";

// Instant unlock when the admin lands back from Polar checkout
// (?checkout_id={CHECKOUT_ID}), instead of waiting for the webhook.
// Server-side only, and it syncs only when every check passes:
//   - the checkout is succeeded/confirmed,
//   - its metadata.tenantId is the logged-in user's office,
//   - its product is one of our BillingPlan products,
//   - the subscription it created is the same purchase (same checkout,
//     same product, same tenant in metadata).
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

    // "confirmed" can arrive before Polar has created the subscription.
    if (!checkout.subscriptionId) {
      return notSynced("subscription_pending", checkoutId);
    }

    let subscription;
    try {
      subscription = await polar.subscriptions.get({ id: checkout.subscriptionId });
    } catch {
      return notSynced("subscription_pending", checkoutId);
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
