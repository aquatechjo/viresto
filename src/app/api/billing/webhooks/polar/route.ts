import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { getPolarClient } from "@/lib/polar";
import { syncSubscriptionFromPolar } from "@/lib/polar-subscription-sync";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[POLAR_WEBHOOK] POLAR_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ success: false }, { status: 500 });
  }

  const body = await req.text();
  const headers = Object.fromEntries(req.headers);

  let event;

  try {
    event = validateEvent(body, headers, webhookSecret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ success: false }, { status: 403 });
    }

    throw error;
  }

  try {
    switch (event.type) {
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
      case "subscription.canceled":
        await syncSubscriptionFromPolar(event.data);
        break;

      case "order.paid": {
        const subscriptionId = event.data.subscriptionId;
        if (subscriptionId) {
          const polar = getPolarClient();
          const subscription = await polar.subscriptions.get({
            id: subscriptionId,
          });
          await syncSubscriptionFromPolar(subscription);
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("[POLAR_WEBHOOK] Failed to process event", event.type, error);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
