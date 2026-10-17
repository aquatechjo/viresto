import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription.js";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPolarClient } from "@/lib/polar";
import { mapPolarStatus, syncSubscriptionFromPolar } from "@/lib/polar-subscription-sync";
import { reportBillingIssue } from "@/lib/monitoring";

// Daily safety net behind the Polar webhooks (AUDIT_REPORT.md H2). Webhooks
// can be lost for longer than the 48 h renewal grace (a rotated secret, a
// bad deploy, an outage), and then a paying office locks, or a cancelled
// one keeps access. This compares our rows with Polar's current state and
// re-syncs any drift through the same code path as the webhooks.
//
// Every run logs one summary line, and one line per drift or failure:
//   [polar-reconcile] <event> key=value ...   (ids only)

export const RECONCILE_LOG_PREFIX = "[polar-reconcile]";

const POLAR_LIVE_STATUSES = ["active", "trialing", "past_due"] as const;

const DB_LIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];

const PAGE_SIZE = 100;
// 100 pages × 100 = 10,000 live subscriptions per run.
const MAX_PAGES = 100;

type PolarClient = Pick<ReturnType<typeof getPolarClient>, "subscriptions">;

export type ReconcileSummary = {
  checked: number;
  drifted: number;
  fixed: number;
  failed: number;
  notFound: number;
};

type DbRow = {
  polarSubscriptionId: string | null;
  tenantId: string;
  status: SubscriptionStatus;
  planId: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

function log(event: string, fields: Record<string, unknown> = {}) {
  const line = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  const message = `${RECONCILE_LOG_PREFIX} ${event}${line ? ` ${line}` : ""}`;

  if (event === "done" || event === "skipped") {
    console.info(message);
    return;
  }

  console.warn(message);
  // Any drift means a webhook was lost: worth knowing even when fixed.
  reportBillingIssue(
    "polar-reconcile",
    event === "drift" ? `drift_${String(fields.reason)}` : event,
    event === "drift" || event === "not_found" ? "warning" : "error",
    fields,
  );
}

/** Why our row no longer matches Polar, or null when it does. */
export function driftReason(
  row: DbRow | undefined,
  polar: PolarSubscription,
  planIdForProduct: Map<string, string>,
) {
  if (!row) return "missing";
  if (row.status !== mapPolarStatus(polar.status)) return "status";
  if (row.planId !== planIdForProduct.get(polar.productId)) return "plan";
  if (row.cancelAtPeriodEnd !== polar.cancelAtPeriodEnd) return "cancel_at_period_end";

  const ourEnd = row.currentPeriodEnd?.getTime() ?? null;
  const theirEnd = polar.currentPeriodEnd?.getTime() ?? null;
  if (ourEnd !== theirEnd) return "period";

  return null;
}

async function listLivePolarSubscriptions(polar: PolarClient, productIds: string[]) {
  const live = new Map<string, PolarSubscription>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await polar.subscriptions.list({
      productId: productIds,
      status: [...POLAR_LIVE_STATUSES],
      limit: PAGE_SIZE,
      page,
    });

    for (const item of response.result.items) live.set(item.id, item);

    const maxPage = response.result.pagination?.maxPage ?? page;
    if (page >= maxPage || response.result.items.length === 0) break;
  }

  return live;
}

function isNotFound(error: unknown) {
  return (
    error instanceof ResourceNotFound ||
    (error as { statusCode?: unknown } | null)?.statusCode === 404
  );
}

async function resync(subscription: PolarSubscription, summary: ReconcileSummary) {
  const result = await syncSubscriptionFromPolar(subscription);

  if (result.ok) {
    summary.fixed++;
    return;
  }

  summary.failed++;
  log("sync_refused", { sub: subscription.id, reason: result.reason });
}

export async function reconcilePolarSubscriptions(
  polar: PolarClient = getPolarClient(),
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { checked: 0, drifted: 0, fixed: 0, failed: 0, notFound: 0 };

  const plans = await prisma.billingPlan.findMany({
    select: { id: true, polarMonthlyProductId: true, polarYearlyProductId: true },
  });
  const planIdForProduct = new Map<string, string>();
  for (const plan of plans) {
    if (plan.polarMonthlyProductId) planIdForProduct.set(plan.polarMonthlyProductId, plan.id);
    if (plan.polarYearlyProductId) planIdForProduct.set(plan.polarYearlyProductId, plan.id);
  }

  const productIds = [...planIdForProduct.keys()];
  if (productIds.length === 0) {
    log("skipped", { reason: "no_products" });
    return summary;
  }

  // Polar's live subscriptions to our products, and our rows that are live
  // or that Polar knows about: together, every office that should be paid.
  const livePolar = await listLivePolarSubscriptions(polar, productIds);

  const rows = await prisma.subscription.findMany({
    where: {
      polarSubscriptionId: { not: null },
      OR: [
        { status: { in: DB_LIVE_STATUSES } },
        { polarSubscriptionId: { in: [...livePolar.keys()] } },
      ],
    },
    select: {
      polarSubscriptionId: true,
      tenantId: true,
      status: true,
      planId: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });
  const rowBySubscription = new Map(rows.map((row) => [row.polarSubscriptionId!, row]));

  // 1. Live in Polar: our row is missing (a lost purchase webhook) or stale
  //    (a lost renewal, plan change, cancel or uncancel).
  for (const subscription of livePolar.values()) {
    summary.checked++;
    const row = rowBySubscription.get(subscription.id);
    const reason = driftReason(row, subscription, planIdForProduct);
    if (!reason) continue;

    summary.drifted++;
    log("drift", { sub: subscription.id, tenant: row?.tenantId, reason });

    try {
      await resync(subscription, summary);
    } catch (error) {
      summary.failed++;
      log("sync_failed", { sub: subscription.id, error: error instanceof Error ? error.name : "unknown" });
    }
  }

  // 2. Live in our DB but no longer live in Polar (a lost cancel, revoke or
  //    expiry): fetch its current state and sync it.
  for (const row of rows) {
    const subscriptionId = row.polarSubscriptionId!;
    if (livePolar.has(subscriptionId) || !DB_LIVE_STATUSES.includes(row.status)) continue;

    summary.checked++;
    summary.drifted++;
    log("drift", { sub: subscriptionId, tenant: row.tenantId, reason: "ended_in_polar" });

    try {
      const current = await polar.subscriptions.get({ id: subscriptionId });
      await resync(current, summary);
    } catch (error) {
      if (isNotFound(error)) {
        summary.notFound++;
        log("not_found", { sub: subscriptionId, tenant: row.tenantId });
        continue;
      }

      summary.failed++;
      log("sync_failed", { sub: subscriptionId, error: error instanceof Error ? error.name : "unknown" });
    }
  }

  log("done", { ...summary });
  return summary;
}
