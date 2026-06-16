import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

type TapWebhookPayload = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  metadata?: {
    tenantId?: string;
    userId?: string;
    planCode?: string;
    interval?: string;
  };
  customer?: {
    id?: string;
  };
  reference?: Record<string, unknown>;
  response?: {
    code?: string;
    message?: string;
  };
};

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function normalizeInterval(value: unknown) {
  return value === "YEARLY" ? "YEARLY" : "MONTHLY";
}

function isSuccessfulTapStatus(status?: string) {
  return ["CAPTURED", "PAID", "SUCCESS"].includes(
    String(status || "").toUpperCase(),
  );
}

function amountToFils(amount: unknown) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000);
}

export async function POST(req: NextRequest) {
  if (process.env.BILLING_ENABLED !== "true") {
    return ok({
      received: true,
      processed: false,
      activated: false,
      ignored: true,
      reason: "billing_disabled",
    });
  }

  const payload = (await req
    .json()
    .catch(() => null)) as TapWebhookPayload | null;

  if (!payload) {
    return err("Invalid webhook payload", 400);
  }

  const providerEventId = payload.id;

  if (!providerEventId) {
    return err("Missing Tap charge id", 400);
  }

  const existingEvent = await prisma.paymentWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: "TAP",
        providerEventId,
      },
    },
    select: {
      id: true,
      processed: true,
    },
  });

  if (existingEvent?.processed) {
    return ok({
      received: true,
      duplicate: true,
    });
  }

  const event =
    existingEvent ||
    (await prisma.paymentWebhookEvent.create({
      data: {
        provider: "TAP",
        providerEventId,
        eventType: payload.status || "UNKNOWN",
        payload: payload as any,
      },
      select: {
        id: true,
        processed: true,
      },
    }));

  try {
    const status = String(payload.status || "").toUpperCase();
    const metadata = payload.metadata || {};

    const tenantId = metadata.tenantId;
    const userId = metadata.userId || null;
    const planCode = String(metadata.planCode || "")
      .trim()
      .toUpperCase();
    const interval = normalizeInterval(metadata.interval);

    if (!tenantId || !planCode) {
      throw new Error("Missing tenantId or planCode in Tap metadata");
    }

    const plan = await prisma.billingPlan.findFirst({
      where: {
        code: planCode,
        isActive: true,
      },
    });

    if (!plan) {
      throw new Error(`Billing plan not found: ${planCode}`);
    }

    const now = new Date();
    if (payload.amount === undefined) {
      throw new Error("Missing Tap payment amount");
    }

    const amount = amountToFils(payload.amount);

    const currentPeriodEnd =
      interval === "YEARLY" ? addMonths(now, 12) : addMonths(now, 1);

    if (!isSuccessfulTapStatus(status)) {
      await prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processedAt: now,
          error: `Tap status is not successful: ${status}`,
        },
      });

      return ok({
        received: true,
        processed: true,
        activated: false,
        status,
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const activeSubscription = subscription
      ? await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            planId: plan.id,
            provider: "TAP",
            providerCustomerId: payload.customer?.id || null,
            providerSubscriptionId: providerEventId,
            status: "ACTIVE",
            interval,
            currency: payload.currency || plan.currency,
            amount,
            trialEndsAt: null,
            currentPeriodStart: now,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
            cancelledAt: null,
          },
        })
      : await prisma.subscription.create({
          data: {
            tenantId,
            planId: plan.id,
            provider: "TAP",
            providerCustomerId: payload.customer?.id || null,
            providerSubscriptionId: providerEventId,
            status: "ACTIVE",
            interval,
            currency: payload.currency || plan.currency,
            amount,
            currentPeriodStart: now,
            currentPeriodEnd,
          },
        });

    const existingPayment = await prisma.subscriptionPayment.findFirst({
      where: {
        provider: "TAP",
        providerChargeId: providerEventId,
      },
      select: {
        id: true,
      },
    });

    if (!existingPayment) {
      await prisma.subscriptionPayment.create({
        data: {
          tenantId,
          subscriptionId: activeSubscription.id,
          provider: "TAP",
          providerChargeId: providerEventId,
          amount,
          currency: payload.currency || plan.currency,
          status,
          paidAt: now,
          raw: payload as any,
        },
      });
    }

    await prisma.activity.create({
      data: {
        tenantId,
        actorId: userId,
        type: "SUBSCRIPTION_PAYMENT_SUCCEEDED",
        title: "تم تفعيل الاشتراك",
        message: `تم تفعيل خطة ${plan.name} عبر Tap`,
        entityType: "Subscription",
        entityId: activeSubscription.id,
      },
    });

    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        processed: true,
        processedAt: now,
        error: null,
      },
    });

    return ok({
      received: true,
      processed: true,
      activated: true,
      status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";

    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        processed: false,
        error: message,
      },
    });

    return err(message, 500);
  }
}
