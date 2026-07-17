import { NextRequest } from "next/server";
import {
  PLANS,
  getDisplayPrice,
  getYearlyPrice,
  type PlanCode,
  type PlanConfig,
} from "@/config/plans";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { getEffectiveSubscriptionStatus } from "@/lib/billing-limits";
import {
  buildPublicManualPaymentSettings,
  MANUAL_PAYMENT_SETTINGS_ID,
} from "@/lib/manual-payment-settings";
import { getAiUsagePeriod } from "@/lib/ai-usage-core";

type DbPlanLike = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number | null;
  maxClients: number | null;
  maxCases: number | null;
  maxDocuments: number | null;
  maxStorageMb: number | null;
  aiEnabled: boolean;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

const VALID_PLAN_CODES = new Set<PlanCode>(["BASIC", "PRO", "BUSINESS"]);

function normalizePlanCode(code?: string | null): PlanCode | null {
  if (!code) return null;

  const normalized = code.toUpperCase() as PlanCode;
  return VALID_PLAN_CODES.has(normalized) ? normalized : null;
}

function getConfiguredPlan(code?: string | null) {
  const normalizedCode = normalizePlanCode(code);
  if (!normalizedCode) return null;

  return PLANS.find((plan) => plan.code === normalizedCode) ?? null;
}

function jodToMinorUnits(amountJod: number) {
  return Math.round(amountJod * 1000);
}

function gbToMb(gb: number) {
  return gb * 1024;
}

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
    case "TRIAL":
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
    case "TRIAL":
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
    case "MISSING":
      return "لا يوجد اشتراك";
    default:
      return "غير محدد";
  }
}

function formatAmount(amount: number, currency: string) {
  const value = amount / 1000;

  const formattedValue = value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

  return {
    raw: amount,
    value,
    currency,

    // نستخدم LTR isolate حتى تظهر داخل الواجهة العربية بهذا الترتيب: 20 JOD
    // وليس JOD 20 بسبب اتجاه النص RTL.
    formatted: `\u2066${formattedValue} ${currency}\u2069`,
  };
}

function getPlanLimits(dbPlan: DbPlanLike, configuredPlan: PlanConfig | null) {
  const storageMb =
    configuredPlan?.limits.storageGb !== undefined
      ? gbToMb(configuredPlan.limits.storageGb)
      : dbPlan.maxStorageMb;

  return {
    users: configuredPlan?.limits.users ?? dbPlan.maxUsers,
    clients: configuredPlan?.limits.clients ?? dbPlan.maxClients,
    cases: configuredPlan?.limits.cases ?? dbPlan.maxCases,

    // في البلانز الجديدة لا نحدد عدد المستندات، الحد الحقيقي هو مساحة التخزين.
    documents: null as number | null,

    storageMb,
    aiEnabled: configuredPlan?.limits.aiEnabled ?? dbPlan.aiEnabled,
    aiMonthlyTokens: configuredPlan?.limits.aiMonthlyTokens ?? 0,
    activityRetentionDays: configuredPlan?.limits.activityRetentionDays ?? 30,
  };
}

function buildPlanPayload(dbPlan: DbPlanLike, isCurrent: boolean) {
  const configuredPlan = getConfiguredPlan(dbPlan.code);
  const currency = dbPlan.currency || "JOD";

  const displayMonthlyJod = configuredPlan
    ? getDisplayPrice(configuredPlan)
    : dbPlan.priceMonthly / 1000;

  const yearlyJod = configuredPlan
    ? getYearlyPrice(configuredPlan)
    : dbPlan.priceYearly / 1000;
  const limits = getPlanLimits(dbPlan, configuredPlan);

  return {
    id: dbPlan.id,
    code: dbPlan.code,
    name: configuredPlan?.name ?? dbPlan.name,
    subtitle: configuredPlan?.subtitle ?? null,
    description: configuredPlan?.description ?? dbPlan.description,
    currency,

    priceMonthly: formatAmount(jodToMinorUnits(displayMonthlyJod), currency),
    priceYearly: formatAmount(jodToMinorUnits(yearlyJod), currency),

    limits,
    aiEnabled: limits.aiEnabled,
    sortOrder: configuredPlan
      ? PLANS.findIndex((plan) => plan.code === configuredPlan.code) + 1
      : dbPlan.sortOrder ?? 999,
    isCurrent,
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
          take: 20,
          select: {
            id: true,
            status: true,
            interval: true,
            currency: true,
            amount: true,
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
                amount: true,
                currency: true,
                status: true,
                method: true,
                receiptPublicId: true,
                adminNote: true,
                reviewedAt: true,
                paidAt: true,
                createdAt: true,
              },
            },
          },
        },
        subscriptionPayments: {
          where: {
            status: { in: ["PENDING", "APPROVED", "REJECTED"] },
            receiptPublicId: { not: null },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            method: true,
            receiptPublicId: true,
            adminNote: true,
            reviewedAt: true,
            paidAt: true,
            createdAt: true,
            requestedInterval: true,
            requestedPlan: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            subscription: {
              select: {
                interval: true,
                plan: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      return err("المكتب غير موجود", 404);
    }

    const aiPeriod = getAiUsagePeriod();
    const [
      plans,
      usageCounts,
      storageAggregate,
      manualPaymentSettings,
      aiUsagePeriod,
    ] = await Promise.all([
      prisma.billingPlan.findMany({
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
          isActive: true,
        },
      }),
      Promise.all([
        prisma.user.count({
          where: {
            tenantId: tenant.id,
            isActive: true,
          },
        }),
        prisma.client.count({
          where: {
            tenantId: tenant.id,
            archivedAt: null,
          },
        }),
        prisma.case.count({
          where: {
            tenantId: tenant.id,
          },
        }),
        prisma.document.count({
          where: {
            tenantId: tenant.id,
          },
        }),
      ]),
      prisma.document.aggregate({
        where: {
          tenantId: tenant.id,
        },
        _sum: {
          fileSize: true,
        },
      }),
      prisma.manualPaymentSettings.findUnique({
        where: {
          id: MANUAL_PAYMENT_SETTINGS_ID,
        },
      }),
      prisma.aiUsagePeriod.findUnique({
        where: {
          tenantId_periodStart: {
            tenantId: tenant.id,
            periodStart: aiPeriod.start,
          },
        },
        select: {
          usedTokens: true,
          reservedTokens: true,
        },
      }),
    ]);

    type TenantSubscription = NonNullable<
      typeof tenant
    >["subscriptions"][number];

    const subscription: TenantSubscription | null =
      tenant.subscriptions.find((item) =>
        ["ACTIVE", "TRIALING"].includes(
          getEffectiveSubscriptionStatus(item.status, item.currentPeriodEnd),
        ),
      ) ??
      tenant.subscriptions.find((item) =>
        ["ACTIVE", "TRIALING"].includes(item.status),
      ) ??
      tenant.subscriptions[0] ??
      null;

    const defaultPlan =
      plans.find((plan) => plan.code === "PRO") ?? plans[0] ?? null;

    const currentDbPlan = subscription?.plan ?? defaultPlan;

    if (!currentDbPlan) {
      return err("لم يتم العثور على خطط الاشتراك", 500);
    }

    const currentPlanPayload = buildPlanPayload(currentDbPlan, true);
    const effectiveLimits = currentPlanPayload.limits;

    const [usersUsed, clientsUsed, casesUsed, documentsUsed] = usageCounts;
    const usedStorageBytes = storageAggregate._sum.fileSize || 0;
    const usedStorageMb = Math.ceil(usedStorageBytes / (1024 * 1024));
    const usedAiTokens =
      (aiUsagePeriod?.usedTokens ?? 0) +
      (aiUsagePeriod?.reservedTokens ?? 0);

    const usage = {
      users: {
        used: usersUsed,
        limit: effectiveLimits.users,
        percent: getUsagePercent(usersUsed, effectiveLimits.users),
      },
      clients: {
        used: clientsUsed,
        limit: effectiveLimits.clients,
        percent: getUsagePercent(clientsUsed, effectiveLimits.clients),
      },
      cases: {
        used: casesUsed,
        limit: effectiveLimits.cases,
        percent: getUsagePercent(casesUsed, effectiveLimits.cases),
      },
      documents: {
        used: documentsUsed,
        limit: effectiveLimits.documents,
        percent: getUsagePercent(documentsUsed, effectiveLimits.documents),
      },
      storage: {
        used: usedStorageMb,
        usedBytes: usedStorageBytes,
        limit: effectiveLimits.storageMb,
        percent: getUsagePercent(usedStorageMb, effectiveLimits.storageMb),
      },
      ai: {
        used: usedAiTokens,
        reserved: aiUsagePeriod?.reservedTokens ?? 0,
        limit: effectiveLimits.aiMonthlyTokens,
        percent: getUsagePercent(
          usedAiTokens,
          effectiveLimits.aiMonthlyTokens,
        ),
        periodStart: aiPeriod.start,
        periodEnd: aiPeriod.end,
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

    const plansByCode = new Map(
      plans.map((plan) => [plan.code.toUpperCase(), plan]),
    );

    const configuredAvailablePlans = PLANS.map((configuredPlan) => {
      const dbPlan = plansByCode.get(configuredPlan.code);
      if (!dbPlan) return null;

      return buildPlanPayload(dbPlan, dbPlan.id === currentDbPlan.id);
    }).filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));

    const availablePlans =
      configuredAvailablePlans.length > 0
        ? configuredAvailablePlans
        : plans.map((plan) => buildPlanPayload(plan, plan.id === currentDbPlan.id));

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
            effectiveStatus: subscriptionStatus,
            statusLabel: getSubscriptionLabel(subscriptionStatus),
            statusTone: getSubscriptionTone(
              subscriptionStatus,
              tenant.isSuspended,
            ),
            interval: subscription.interval,
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
            payments: subscription.payments.map((payment) => {
              const { receiptPublicId, ...safePayment } = payment;

              return {
                ...safePayment,
                amount: formatAmount(payment.amount, payment.currency),
                receiptUrl: receiptPublicId
                  ? `/api/billing/manual-payment/${payment.id}/receipt`
                  : null,
              };
            }),
            plan: currentPlanPayload,
          }
        : null,

      paymentHistory: tenant.subscriptionPayments.map((payment) => ({
        id: payment.id,
        amount: formatAmount(payment.amount, payment.currency),
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        receiptUrl: payment.receiptPublicId
          ? `/api/billing/manual-payment/${payment.id}/receipt`
          : null,
        adminNote: payment.adminNote,
        reviewedAt: payment.reviewedAt,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        plan: payment.requestedPlan ?? payment.subscription?.plan ?? null,
        interval:
          payment.requestedInterval ?? payment.subscription?.interval ?? null,
      })),

      currentPlan: currentPlanPayload,
      usage,
      warnings,
      availablePlans,
      manualPaymentSettings: buildPublicManualPaymentSettings(
        manualPaymentSettings,
      ),

      period: {
        currentPeriodStart: subscription?.currentPeriodStart ?? null,
        currentPeriodEnd: subscriptionCurrentPeriodEnd ?? null,
        trialEndsAt: subscriptionTrialEndsAt ?? null,
      },
    });
  });
}
