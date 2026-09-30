import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import { getPolarClient } from "@/lib/polar";
import {
  POLAR_LOG_PREFIX,
  findBillingPlanForPolarProduct,
  syncSubscriptionFromPolar,
  type PolarSyncResult,
} from "@/lib/polar-subscription-sync";
import { markWebhookProcessed, wasWebhookProcessed } from "@/lib/webhook-dedupe";

export const runtime = "nodejs";

// Every non-success path logs exactly one searchable line:
//   [polar-webhook] <reason> key=value ...
// with ids only: never the payload, headers, or secret.
function logFailure(reason: string, details: Record<string, unknown> = {}) {
  const fields = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");

  console.warn(`${POLAR_LOG_PREFIX} ${reason}${fields ? ` ${fields}` : ""}`);
}

function json(status: number, body: Record<string, unknown> = {}) {
  return NextResponse.json({ success: status < 400, ...body }, { status });
}

function reportSync(
  result: PolarSyncResult,
  context: {
    event: string;
    webhook_id: string | null;
    sub: string;
    product: string | null;
  },
) {
  if (!result.ok) {
    // Ignored, not retried: a 4xx/5xx would make Polar redeliver an event
    // that can never succeed (another app's product, unknown office).
    logFailure(result.reason, context);
  }
}

// Thrown when Polar's API cannot be reached, so the delivery answers 5xx and
// Polar retries it later (it is not marked as processed).
class PolarFetchError extends Error {
  constructor(readonly causeName: string) {
    super("Polar subscription fetch failed");
    this.name = "PolarFetchError";
  }
}

/**
 * Syncs one subscription as Polar holds it *now*, fetched from the API.
 * Webhook payloads are never synced directly: delivery is at-least-once and
 * unordered, so a payload can be older than the subscription's real state
 * (a delayed "active" after "revoked", or for a subscription that has since
 * been replaced). The product is checked first, from the payload, so
 * subscriptions of the other app sharing this Polar org are never fetched.
 */
async function syncCurrentSubscription(
  subscriptionId: string,
  payloadProductId: string | null | undefined,
  context: { event: string; webhook_id: string | null; order?: string },
) {
  const plan = await findBillingPlanForPolarProduct(payloadProductId);

  if (!plan) {
    logFailure("unknown_product", {
      ...context,
      sub: subscriptionId,
      product: payloadProductId,
    });
    return;
  }

  let subscription;

  try {
    subscription = await getPolarClient().subscriptions.get({ id: subscriptionId });
  } catch (error) {
    // statusCode too: instanceof alone fails if two builds of the SDK
    // (ESM/CJS) end up loaded side by side.
    if (
      error instanceof ResourceNotFound ||
      (error as { statusCode?: unknown } | null)?.statusCode === 404
    ) {
      // Deleted on Polar's side: nothing to sync, and retrying cannot help.
      logFailure("subscription_not_found", { ...context, sub: subscriptionId });
      return;
    }

    throw new PolarFetchError(error instanceof Error ? error.name : "unknown");
  }

  const result = await syncSubscriptionFromPolar(subscription);
  reportSync(result, {
    event: context.event,
    webhook_id: context.webhook_id,
    sub: subscription.id,
    product: subscription.productId,
  });
}

export async function POST(req: NextRequest) {
  // Exactly as Polar shows it (e.g. "polar_whs_..."), trimmed only because
  // a pasted env var can pick up a trailing newline; real secrets never
  // contain whitespace. validateEvent handles the encoding itself.
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET?.trim();
  const webhookId = req.headers.get("webhook-id");

  if (!webhookSecret) {
    logFailure("secret_missing", { webhook_id: webhookId });
    return json(500);
  }

  // Raw body, untouched: the signature covers these exact bytes.
  const body = await req.text();
  const headers = Object.fromEntries(req.headers);

  let event;

  try {
    event = validateEvent(body, headers, webhookSecret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      logFailure("signature_invalid", {
        webhook_id: webhookId,
        has_signature: Boolean(req.headers.get("webhook-signature")),
        has_timestamp: Boolean(req.headers.get("webhook-timestamp")),
      });
      return json(403);
    }

    // The signature was valid, but this SDK version can't parse the event
    // (e.g. an event type newer than the SDK). Acknowledge so Polar stops
    // retrying; nothing we handle is affected.
    if (error instanceof SDKValidationError) {
      logFailure("unparseable_event", { webhook_id: webhookId });
      return json(200, { ignored: true });
    }

    logFailure("verification_error", {
      webhook_id: webhookId,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }

  // The signature covers webhook-id, so it cannot be forged to skip events.
  if (webhookId && (await wasWebhookProcessed("polar", webhookId))) {
    return json(200, { duplicate: true });
  }

  const context = { event: event.type, webhook_id: webhookId };

  try {
    switch (event.type) {
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
      case "subscription.canceled":
      case "subscription.uncanceled":
      case "subscription.revoked":
      case "subscription.past_due":
        await syncCurrentSubscription(event.data.id, event.data.productId, context);
        break;

      case "order.paid": {
        const order = event.data;
        if (!order.subscriptionId) break;

        await syncCurrentSubscription(order.subscriptionId, order.productId, {
          ...context,
          order: order.id,
        });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    if (error instanceof PolarFetchError) {
      logFailure("polar_fetch_failed", { ...context, error: error.causeName });
      return json(500);
    }

    logFailure("sync_failed", {
      ...context,
      // Name/code only: Prisma messages can echo query arguments.
      error: error instanceof Error ? error.name : "unknown",
      code: (error as { code?: unknown } | null)?.code as string | undefined,
    });
    return json(500);
  }

  if (webhookId) {
    try {
      await markWebhookProcessed("polar", webhookId, event.type);
    } catch (error) {
      // The event itself was handled; a redelivery would only repeat an
      // idempotent sync from Polar's current state.
      logFailure("dedupe_mark_failed", {
        ...context,
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  return json(200);
}
