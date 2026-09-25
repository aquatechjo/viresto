import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror.js";
import { getPolarClient } from "@/lib/polar";
import {
  POLAR_LOG_PREFIX,
  findBillingPlanForPolarProduct,
  syncSubscriptionFromPolar,
  type PolarSyncResult,
} from "@/lib/polar-subscription-sync";

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

  const context = { event: event.type, webhook_id: webhookId };

  try {
    switch (event.type) {
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
      case "subscription.canceled":
      case "subscription.uncanceled":
      case "subscription.revoked":
      case "subscription.past_due": {
        const result = await syncSubscriptionFromPolar(event.data);
        reportSync(result, {
          ...context,
          sub: event.data.id,
          product: event.data.productId,
        });
        break;
      }

      case "order.paid": {
        const order = event.data;
        if (!order.subscriptionId) break;

        // Check the product before calling Polar's API: orders for the
        // other app on this org must be ignored, not fetched.
        const plan = await findBillingPlanForPolarProduct(order.productId);
        if (!plan) {
          logFailure("unknown_product", {
            event: event.type,
            webhook_id: webhookId,
            order: order.id,
            product: order.productId,
          });
          break;
        }

        const subscription = await getPolarClient().subscriptions.get({
          id: order.subscriptionId,
        });
        const result = await syncSubscriptionFromPolar(subscription);
        reportSync(result, {
          ...context,
          sub: subscription.id,
          product: subscription.productId,
        });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    logFailure("sync_failed", {
      event: event.type,
      webhook_id: webhookId,
      // Name/code only: Prisma messages can echo query arguments.
      error: error instanceof Error ? error.name : "unknown",
      code: (error as { code?: unknown } | null)?.code as string | undefined,
    });
    return json(500);
  }

  return json(200);
}
