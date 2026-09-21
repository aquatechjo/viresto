import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription.js";
import {
  BillingInterval,
  SubscriptionStatus,
  TenantStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";
import {
  getBillingPlanConfig,
  syncTenantSubscriptionMirror,
} from "@/lib/subscription-consistency";

export function mapPolarStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "paused":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELLED;
    case "incomplete_expired":
      return SubscriptionStatus.EXPIRED;
    case "incomplete":
    case "unpaid":
    default:
      return SubscriptionStatus.UNPAID;
  }
}

function resolveTenantId(subscription: PolarSubscription): string | null {
  const externalId = subscription.customer?.externalId;
  if (externalId) return externalId;

  const metadataTenantId = subscription.metadata?.tenantId;
  return typeof metadataTenantId === "string" ? metadataTenantId : null;
}

export async function syncSubscriptionFromPolar(
  subscription: PolarSubscription,
) {
  const tenantId = resolveTenantId(subscription);

  if (!tenantId) {
    console.error(
      "[POLAR_SYNC] Subscription has no external tenant id",
      subscription.id,
    );
    return null;
  }

  const plan = await prisma.billingPlan.findFirst({
    where: {
      OR: [
        { polarMonthlyProductId: subscription.productId },
        { polarYearlyProductId: subscription.productId },
      ],
    },
  });

  if (!plan) {
    console.error(
      "[POLAR_SYNC] No BillingPlan matches Polar product",
      subscription.productId,
    );
    return null;
  }

  const interval =
    plan.polarMonthlyProductId === subscription.productId
      ? BillingInterval.MONTHLY
      : BillingInterval.YEARLY;

  const billingPlanConfig = getBillingPlanConfig(plan.code, interval);
  const status = mapPolarStatus(subscription.status);
  const isEntitled =
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.TRIALING;

  return prisma.$transaction(async (tx) => {
    await lockTenantMutation(tx, tenantId);

    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      console.error(
        "[POLAR_SYNC] Tenant not found for external id",
        tenantId,
      );
      return null;
    }

    const record = await tx.subscription.upsert({
      where: { polarSubscriptionId: subscription.id },
      create: {
        tenantId,
        planId: plan.id,
        status,
        interval,
        currency: subscription.currency?.toUpperCase() || plan.currency,
        amount: subscription.amount ?? billingPlanConfig?.amount ?? 0,
        trialEndsAt: subscription.trialEnd ?? null,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelledAt: subscription.canceledAt ?? null,
        polarSubscriptionId: subscription.id,
        polarCustomerId: subscription.customerId,
      },
      update: {
        planId: plan.id,
        status,
        interval,
        currency: subscription.currency?.toUpperCase() || plan.currency,
        amount: subscription.amount ?? billingPlanConfig?.amount ?? 0,
        trialEndsAt: subscription.trialEnd ?? null,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelledAt: subscription.canceledAt ?? null,
        polarCustomerId: subscription.customerId,
      },
    });

    if (isEntitled) {
      await syncTenantSubscriptionMirror(tx, {
        tenantId,
        planCode: plan.code,
        status: TenantStatus.ACTIVE,
        trialEndsAt: subscription.trialEnd ?? null,
      });
    }

    await tx.activity.create({
      data: {
        tenantId,
        type: "BILLING_PLAN_CHANGED",
        title: "تحديث الاشتراك عبر Polar",
        message: `الحالة: ${status} — الخطة: ${plan.name}`,
        entityType: "Subscription",
        entityId: subscription.id,
      },
    });

    return record;
  });
}
