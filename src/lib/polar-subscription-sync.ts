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
import { invalidateAuthCacheForTenant } from "@/lib/api-auth";
import { isPaidSubscriptionEntitled } from "@/lib/tenant-access";
import { getTenantAccess } from "@/lib/tenant-access-server";

export const POLAR_LOG_PREFIX = "[polar-webhook]";

/**
 * Polar statuses → ours. "active" and "trialing" are entitled; "past_due"
 * keeps access for 7 days (tenant-access.ts); "canceled" is what Polar
 * reports once a subscription has actually ended or been revoked. A
 * subscription set to cancel at period end stays "active" with
 * cancel_at_period_end=true until then.
 */
export function mapPolarStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELLED;
    case "paused":
    case "incomplete_expired":
      return SubscriptionStatus.EXPIRED;
    case "incomplete":
    case "unpaid":
    default:
      return SubscriptionStatus.UNPAID;
  }
}

export type PolarTenantResolution =
  | {
      ok: true;
      tenantId: string;
      source: "metadata" | "existing_subscription" | "external_id";
      mismatch: { externalId: string } | null;
    }
  | {
      ok: false;
      reason: "tenant_missing" | "tenant_conflict";
      existingTenantId?: string;
    };

/**
 * Which office a Polar subscription belongs to.
 *
 * metadata.tenantId is set by our own checkout for this exact purchase, so
 * it wins. customer.external_id is NOT reliable: Polar keys customers by
 * email and keeps the external_id from the first time it saw that email
 * (an earlier office, an earlier attempt, or the other app sharing this
 * Polar org), so it is only a fallback. If our DB already links this
 * Polar subscription to a different office than metadata names, refuse
 * rather than move a paid subscription between offices.
 */
export function resolvePolarTenant(input: {
  metadataTenantId: string | null;
  externalId: string | null;
  existingTenantId: string | null;
}): PolarTenantResolution {
  const { metadataTenantId, externalId, existingTenantId } = input;

  if (metadataTenantId) {
    if (existingTenantId && existingTenantId !== metadataTenantId) {
      return { ok: false, reason: "tenant_conflict", existingTenantId };
    }

    return {
      ok: true,
      tenantId: metadataTenantId,
      source: "metadata",
      mismatch:
        externalId && externalId !== metadataTenantId ? { externalId } : null,
    };
  }

  if (existingTenantId) {
    return {
      ok: true,
      tenantId: existingTenantId,
      source: "existing_subscription",
      mismatch:
        externalId && externalId !== existingTenantId ? { externalId } : null,
    };
  }

  if (externalId) {
    return { ok: true, tenantId: externalId, source: "external_id", mismatch: null };
  }

  return { ok: false, reason: "tenant_missing" };
}

export async function findBillingPlanForPolarProduct(
  productId: string | null | undefined,
) {
  if (!productId) return null;

  return prisma.billingPlan.findFirst({
    where: {
      OR: [
        { polarMonthlyProductId: productId },
        { polarYearlyProductId: productId },
      ],
    },
  });
}

export type PolarSyncFailureReason =
  | "unknown_product"
  | "tenant_missing"
  | "tenant_conflict"
  | "tenant_not_found";

export type PolarSyncResult =
  | {
      ok: true;
      tenantId: string;
      status: SubscriptionStatus;
      entitled: boolean;
      tenantSource: "metadata" | "existing_subscription" | "external_id";
    }
  | { ok: false; reason: PolarSyncFailureReason };

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function syncSubscriptionFromPolar(
  subscription: PolarSubscription,
): Promise<PolarSyncResult> {
  // Products outside our 6 BillingPlan products belong to the other app on
  // this Polar org. Never touch an office for them.
  const plan = await findBillingPlanForPolarProduct(subscription.productId);

  if (!plan) {
    return { ok: false, reason: "unknown_product" };
  }

  const existing = await prisma.subscription.findUnique({
    where: { polarSubscriptionId: subscription.id },
    select: { tenantId: true, status: true, pastDueSince: true },
  });

  const resolution = resolvePolarTenant({
    metadataTenantId: stringOrNull(subscription.metadata?.tenantId),
    externalId: stringOrNull(subscription.customer?.externalId),
    existingTenantId: existing?.tenantId ?? null,
  });

  if (!resolution.ok) {
    return { ok: false, reason: resolution.reason };
  }

  const { tenantId } = resolution;

  if (resolution.mismatch) {
    // Expected when the Polar customer (keyed by email) was first created
    // for another office. We trust `resolution.source`, never external_id.
    console.warn(
      `${POLAR_LOG_PREFIX} tenant_mismatch sub=${subscription.id} tenant=${tenantId} source=${resolution.source} external_id=${resolution.mismatch.externalId}`,
    );
  }

  const interval =
    plan.polarMonthlyProductId === subscription.productId
      ? BillingInterval.MONTHLY
      : BillingInterval.YEARLY;

  const billingPlanConfig = getBillingPlanConfig(plan.code, interval);
  const status = mapPolarStatus(subscription.status);
  const now = new Date();

  // Start the 7-day past_due clock once, and keep it across the repeated
  // webhooks Polar sends while it retries the card.
  const pastDueSince =
    status === SubscriptionStatus.PAST_DUE
      ? existing?.status === SubscriptionStatus.PAST_DUE && existing.pastDueSince
        ? existing.pastDueSince
        : now
      : null;

  const fields = {
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
    pastDueSince,
    polarCustomerId: subscription.customerId,
  };

  const result = await prisma.$transaction(async (tx) => {
    await lockTenantMutation(tx, tenantId);

    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) return null;

    const record = await tx.subscription.upsert({
      where: { polarSubscriptionId: subscription.id },
      create: {
        tenantId,
        polarSubscriptionId: subscription.id,
        ...fields,
      },
      update: fields,
    });

    const entitled = isPaidSubscriptionEntitled(record, now);

    if (entitled) {
      // Paying ends the free in-app trial immediately; the paid period is
      // Polar's, starting at purchase. Trial dates stay on the row as
      // history, and the row is never deleted.
      await tx.subscription.updateMany({
        where: {
          tenantId,
          polarSubscriptionId: null,
          status: SubscriptionStatus.TRIALING,
        },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: now,
          currentPeriodEnd: now,
        },
      });

      await syncTenantSubscriptionMirror(tx, {
        tenantId,
        planCode: plan.code,
        status: TenantStatus.ACTIVE,
        trialEndsAt: null,
      });
    } else {
      const access = await getTenantAccess(tenantId, tx);

      if (access.state === "LOCKED") {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { status: TenantStatus.EXPIRED },
        });
      }
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

    return { entitled };
  });

  if (!result) {
    return { ok: false, reason: "tenant_not_found" };
  }

  // Unlock (or lock) on the very next request instead of after the cache TTL.
  invalidateAuthCacheForTenant(tenantId);

  return {
    ok: true,
    tenantId,
    status,
    entitled: result.entitled,
    tenantSource: resolution.source,
  };
}
