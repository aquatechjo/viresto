import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { getEffectiveSubscriptionStatus } from "@/lib/billing-limits";

function getUsagePercent(used: number, limit: number | null) {
  if (!limit || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

function getTrialDaysLeft(trialEndsAt?: Date | null) {
  if (!trialEndsAt) return null;

  const now = new Date();
  const diff = trialEndsAt.getTime() - now.getTime();

  if (diff <= 0) return 0;

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getSubscriptionTone(status?: string | null, isSuspended?: boolean) {
  if (isSuspended) return "danger";

  switch (status) {
    case "ACTIVE":
      return "success";
    case "TRIALING":
      return "warning";
    case "PAST_DUE":
    case "UNPAID":
    case "EXPIRED":
      return "danger";
    case "CANCELLED":
      return "muted";
    default:
      return "muted";
  }
}

function getSubscriptionLabel(status?: string | null) {
  switch (status) {
    case "ACTIVE":
      return "نشط";
    case "TRIALING":
      return "تجربة";
    case "PAST_DUE":
      return "متأخر الدفع";
    case "CANCELLED":
      return "ملغي";
    case "EXPIRED":
      return "منتهي";
    case "UNPAID":
      return "غير مدفوع";
    default:
      return "غير محدد";
  }
}

function formatAmount(amount: number, currency: string) {
  return {
    raw: amount,
    value: amount / 1000,
    currency,
    formatted: `${(amount / 1000).toFixed(2)} ${currency}`,
  };
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.user.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        isSuspended: true,
        maxUsers: true,
        trialEndsAt: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            clients: true,
            cases: true,
            documents: true,
            payments: true,
            invoices: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            interval: true,
            currency: true,
            amount: true,
            provider: true,
            providerCustomerId: true,
            providerSubscriptionId: true,
            providerAgreementId: true,
            trialEndsAt: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            cancelledAt: true,
            createdAt: true,
            updatedAt: true,
            plan: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                currency: true,
                priceMonthly: true,
                priceYearly: true,
                maxUsers: true,
                maxClients: true,
                maxCases: true,
                maxDocuments: true,
                maxStorageMb: true,
                aiEnabled: true,
                sortOrder: true,
                isActive: true,
              },
            },
            payments: {
              orderBy: { createdAt: "desc" },
              take: 10,
              select: {
                id: true,
                provider: true,
                providerChargeId: true,
                providerInvoiceId: true,
                amount: true,
                currency: true,
                status: true,
                paidAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      return err("المكتب غير موجود", 404);
    }

    const plans = await prisma.billingPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        currency: true,
        priceMonthly: true,
        priceYearly: true,
        maxUsers: true,
        maxClients: true,
        maxCases: true,
        maxDocuments: true,
        maxStorageMb: true,
        aiEnabled: true,
        sortOrder: true,
      },
    });

    type TenantSubscription = NonNullable<
      typeof tenant
    >["subscriptions"][number];

    const subscription: TenantSubscription | null =
      tenant.subscriptions.length > 0 ? tenant.subscriptions[0] : null;
    const currentPlan =
      subscription?.plan ??
      plans.find((plan) => plan.code === "PRO") ??
      plans[0] ??
      null;

    if (!currentPlan) {
      return err("لم يتم العثور على خطط الاشتراك", 500);
    }

    const effectiveLimits = {
      users: currentPlan.maxUsers,
      clients: currentPlan.maxClients,
      cases: currentPlan.maxCases,
      documents: currentPlan.maxDocuments,
      storageMb: currentPlan.maxStorageMb,
      aiEnabled: currentPlan.aiEnabled,
    };

    const usage = {
      users: {
        used: tenant._count.users,
        limit: effectiveLimits.users,
        percent: getUsagePercent(tenant._count.users, effectiveLimits.users),
      },
      clients: {
        used: tenant._count.clients,
        limit: effectiveLimits.clients,
        percent: getUsagePercent(
          tenant._count.clients,
          effectiveLimits.clients,
        ),
      },
      cases: {
        used: tenant._count.cases,
        limit: effectiveLimits.cases,
        percent: getUsagePercent(tenant._count.cases, effectiveLimits.cases),
      },
      documents: {
        used: tenant._count.documents,
        limit: effectiveLimits.documents,
        percent: getUsagePercent(
          tenant._count.documents,
          effectiveLimits.documents,
        ),
      },
      payments: {
        used: tenant._count.payments,
        limit: null,
        percent: null,
      },
      invoices: {
        used: tenant._count.invoices,
        limit: null,
        percent: null,
      },
    };

    const warnings = Object.entries(usage)
      .filter(
        ([, item]) => typeof item.percent === "number" && item.percent >= 80,
      )
      .map(([key, item]) => ({ key, percent: item.percent }));

    const subscriptionStatus = subscription
      ? getEffectiveSubscriptionStatus(
          subscription.status,
          subscription.currentPeriodEnd,
        )
      : "MISSING";
    const subscriptionTrialEndsAt =
      subscription?.trialEndsAt ?? tenant.trialEndsAt;
    const subscriptionCurrentPeriodEnd =
      subscription?.currentPeriodEnd ?? subscriptionTrialEndsAt;

    return ok({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,

        // legacy fields مؤقتاً حتى لا تنكسر الصفحة القديمة
        plan: tenant.plan,
        status: tenant.status,
        maxUsers: tenant.maxUsers,
        trialEndsAt: subscriptionTrialEndsAt,
        trialDaysLeft: getTrialDaysLeft(subscriptionTrialEndsAt),

        // billing-aware fields
        subscriptionStatus,
        statusLabel: getSubscriptionLabel(subscriptionStatus),
        statusTone: getSubscriptionTone(subscriptionStatus, tenant.isSuspended),
        isSuspended: tenant.isSuspended,
        createdAt: tenant.createdAt,
      },

      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            statusLabel: getSubscriptionLabel(subscription.status),
            statusTone: getSubscriptionTone(
              subscription.status,
              tenant.isSuspended,
            ),
            interval: subscription.interval,
            provider: subscription.provider,
            providerCustomerId: subscription.providerCustomerId,
            providerSubscriptionId: subscription.providerSubscriptionId,
            providerAgreementId: subscription.providerAgreementId,
            amount: formatAmount(subscription.amount, subscription.currency),
            currency: subscription.currency,
            trialEndsAt: subscription.trialEndsAt,
            trialDaysLeft: getTrialDaysLeft(subscription.trialEndsAt),
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            cancelledAt: subscription.cancelledAt,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt,
            payments: subscription.payments.map((payment) => ({
              ...payment,
              amount: formatAmount(payment.amount, payment.currency),
            })),
            plan: {
              id: currentPlan.id,
              code: currentPlan.code,
              name: currentPlan.name,
              description: currentPlan.description,
              currency: currentPlan.currency,
              priceMonthly: formatAmount(
                currentPlan.priceMonthly,
                currentPlan.currency,
              ),
              priceYearly: formatAmount(
                currentPlan.priceYearly,
                currentPlan.currency,
              ),
              limits: effectiveLimits,
              aiEnabled: currentPlan.aiEnabled,
            },
          }
        : null,

      currentPlan: {
        id: currentPlan.id,
        code: currentPlan.code,
        name: currentPlan.name,
        description: currentPlan.description,
        currency: currentPlan.currency,
        priceMonthly: formatAmount(
          currentPlan.priceMonthly,
          currentPlan.currency,
        ),
        priceYearly: formatAmount(
          currentPlan.priceYearly,
          currentPlan.currency,
        ),
        limits: effectiveLimits,
        aiEnabled: currentPlan.aiEnabled,
      },

      usage,
      warnings,

      availablePlans: plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        currency: plan.currency,
        priceMonthly: formatAmount(plan.priceMonthly, plan.currency),
        priceYearly: formatAmount(plan.priceYearly, plan.currency),
        limits: {
          users: plan.maxUsers,
          clients: plan.maxClients,
          cases: plan.maxCases,
          documents: plan.maxDocuments,
          storageMb: plan.maxStorageMb,
          aiEnabled: plan.aiEnabled,
        },
        aiEnabled: plan.aiEnabled,
        sortOrder: plan.sortOrder,
        isCurrent: plan.id === currentPlan.id,
      })),

      period: {
        currentPeriodStart: subscription?.currentPeriodStart ?? null,
        currentPeriodEnd: subscriptionCurrentPeriodEnd ?? null,
        trialEndsAt: subscriptionTrialEndsAt ?? null,
      },
    });
  });
}
