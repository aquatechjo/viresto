import type { Prisma } from "@prisma/client";
import { PLANS, type PlanCode } from "@/config/plans";
import { prisma } from "@/lib/prisma";
import { hasPlanCapacity } from "@/lib/plan-capacity";

type BillingReadClient = Pick<
  Prisma.TransactionClient,
  "tenant" | "subscription" | "user" | "client" | "case" | "document"
>;

export type LimitedBillingResource =
  | "users"
  | "clients"
  | "cases"
  | "documents";

export interface TenantBillingLimits {
  subscriptionId: string | null;
  subscriptionStatus: string;
  canCreate: boolean;
  blockReason: string | null;
  plan: {
    id: string | null;
    code: string;
    name: string;
    aiEnabled: boolean;
  };
  limits: {
    users: number | null;
    clients: number | null;
    cases: number | null;
    documents: number | null;
    storageMb: number | null;
    aiEnabled: boolean;
    aiMonthlyTokens: number;
    activityRetentionDays: number;
  };
}

const BLOCKED_STATUSES = new Set([
  "CANCELLED",
  "EXPIRED",
  "UNPAID",
  "PAST_DUE",
  "MISSING",
]);

const VALID_PLAN_CODES = new Set<PlanCode>(["BASIC", "PRO", "BUSINESS"]);

export function getEffectiveSubscriptionStatus(
  status: string,
  currentPeriodEnd?: Date | null,
) {
  const now = new Date();

  if (
    currentPeriodEnd &&
    currentPeriodEnd.getTime() <= now.getTime() &&
    ["TRIAL", "TRIALING", "ACTIVE", "PAST_DUE"].includes(status)
  ) {
    return "EXPIRED";
  }

  return status;
}

function statusCanCreate(status: string) {
  return !BLOCKED_STATUSES.has(status);
}

function getBlockReason(status: string) {
  switch (status) {
    case "CANCELLED":
      return "تم إلغاء الاشتراك. يرجى تجديد الاشتراك للمتابعة.";
    case "EXPIRED":
      return "انتهى الاشتراك. يرجى تجديد الاشتراك للمتابعة.";
    case "UNPAID":
      return "الاشتراك غير مدفوع. يرجى إتمام الدفع للمتابعة.";
    case "PAST_DUE":
      return "يوجد تأخير في الدفع. يرجى تجديد الاشتراك للمتابعة.";
    case "MISSING":
      return "لا يوجد اشتراك مفعّل لهذا المكتب.";
    default:
      return null;
  }
}

function normalizePlanCode(code?: string | null): PlanCode | null {
  if (!code) return null;

  const normalized = code.toUpperCase() as PlanCode;

  if (VALID_PLAN_CODES.has(normalized)) {
    return normalized;
  }

  return null;
}

function getConfiguredPlan(code?: string | null) {
  const normalizedCode = normalizePlanCode(code);

  if (!normalizedCode) return null;

  return PLANS.find((plan) => plan.code === normalizedCode) ?? null;
}

function gbToMb(gb: number) {
  return gb * 1024;
}

function formatStorageMb(storageMb: number) {
  if (storageMb >= 1024) {
    const gb = storageMb / 1024;
    return `${gb}GB`;
  }

  return `${storageMb}MB`;
}

export async function getTenantBillingLimits(
  tenantId: string,
  db: BillingReadClient = prisma,
): Promise<TenantBillingLimits> {
  const subscriptions = await db.subscription.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      currentPeriodEnd: true,
      plan: {
        select: {
          id: true,
          code: true,
          name: true,
          maxUsers: true,
          maxClients: true,
          maxCases: true,
          maxDocuments: true,
          maxStorageMb: true,
          aiEnabled: true,
        },
      },
    },
  });

  const subscription =
    subscriptions.find((item) =>
      ["ACTIVE", "TRIALING"].includes(
        getEffectiveSubscriptionStatus(item.status, item.currentPeriodEnd),
      ),
    ) ??
    subscriptions.find((item) =>
      ["ACTIVE", "TRIALING"].includes(item.status),
    ) ??
    subscriptions[0] ??
    null;

  if (subscription?.plan) {
    const status = getEffectiveSubscriptionStatus(
      subscription.status,
      subscription.currentPeriodEnd,
    );

    const canCreate = statusCanCreate(status);
    const configuredPlan = getConfiguredPlan(subscription.plan.code);

    /**
     * مبدأ مهم:
     * الخطط الرسمية نقرأ حدودها من src/config/plans.ts
     * حتى لا يصير عندك اختلاف بين صفحة الأسعار ونظام المنع داخل التطبيق.
     *
     * إذا الخطة غير معروفة، نرجع لقيم قاعدة البيانات كـ fallback.
     */
    const usersLimit =
      configuredPlan?.limits.users ?? subscription.plan.maxUsers ?? null;

    const clientsLimit =
      configuredPlan?.limits.clients ?? subscription.plan.maxClients ?? null;

    const casesLimit =
      configuredPlan?.limits.cases ?? subscription.plan.maxCases ?? null;

    const storageMbLimit =
      configuredPlan?.limits.storageGb !== undefined
        ? gbToMb(configuredPlan.limits.storageGb)
        : subscription.plan.maxStorageMb ?? null;

    const aiEnabled =
      configuredPlan?.limits.aiEnabled ?? subscription.plan.aiEnabled;

    const aiMonthlyTokens =
      configuredPlan?.limits.aiMonthlyTokens ?? 0;

    const activityRetentionDays =
      configuredPlan?.limits.activityRetentionDays ?? 30;

    return {
      subscriptionId: subscription.id,
      subscriptionStatus: status,
      canCreate,
      blockReason: getBlockReason(status),
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: configuredPlan?.name ?? subscription.plan.name,
        aiEnabled,
      },
      limits: {
        users: usersLimit,
        clients: clientsLimit,
        cases: casesLimit,

        /**
         * لا نحدد عدد المستندات في الباقات الجديدة.
         * الحد الحقيقي للمستندات هو التخزين.
         */
        documents: null,

        storageMb: storageMbLimit,
        aiEnabled,
        aiMonthlyTokens,
        activityRetentionDays,
      },
    };
  }

  return {
    subscriptionId: null,
    subscriptionStatus: "MISSING",
    canCreate: false,
    blockReason: "لا يوجد اشتراك مفعّل لهذا المكتب.",
    plan: {
      id: null,
      code: "NONE",
      name: "No active plan",
      aiEnabled: false,
    },
    limits: {
      users: 1,
      clients: 0,
      cases: 0,
      documents: 0,
      storageMb: 0,
      aiEnabled: false,
      aiMonthlyTokens: 0,
      activityRetentionDays: 0,
    },
  };
}

export async function assertTenantCanWrite(
  tenantId: string,
  action = "تنفيذ هذا الإجراء",
  db: BillingReadClient = prisma,
) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      isSuspended: true,
      status: true,
    },
  });

  if (!tenant) {
    return {
      ok: false as const,
      status: 404,
      message: "المكتب غير موجود.",
    };
  }

  if (tenant.isSuspended || tenant.status === "SUSPENDED") {
    return {
      ok: false as const,
      status: 403,
      message: `لا يمكن ${action} لأن المكتب موقوف.`,
    };
  }

  const billing = await getTenantBillingLimits(tenantId, db);

  if (!billing.canCreate) {
    return {
      ok: false as const,
      status: 402,
      message: billing.blockReason || `لا يمكن ${action} لأن الاشتراك غير نشط.`,
      billing,
    };
  }

  return {
    ok: true as const,
    status: 200,
    billing,
  };
}

export async function assertTenantCanCreate(
  tenantId: string,
  resource: LimitedBillingResource,
  db: BillingReadClient = prisma,
) {
  const writeCheck = await assertTenantCanWrite(
    tenantId,
    "إنشاء عنصر جديد",
    db,
  );

  if (!writeCheck.ok) {
    return {
      ok: false as const,
      status: writeCheck.status,
      message: writeCheck.message,
      billing: writeCheck.billing ?? null,
    };
  }

  const billing = writeCheck.billing;

  if (!billing.canCreate) {
    return {
      ok: false as const,
      status: 402,
      message:
        billing.blockReason ||
        "لا يمكن إنشاء عناصر جديدة لأن الاشتراك غير نشط.",
      billing,
    };
  }

  const limit = billing.limits[resource];

  if (limit === null) {
    return {
      ok: true as const,
      status: 200,
      billing,
      limit,
      used: null,
    };
  }

  const used = await getResourceUsage(tenantId, resource, db);

  if (!hasPlanCapacity(used, limit)) {
    return {
      ok: false as const,
      status: 402,
      message: getLimitMessage(resource, limit),
      billing,
      limit,
      used,
    };
  }

  return {
    ok: true as const,
    status: 200,
    billing,
    limit,
    used,
  };
}

async function getResourceUsage(
  tenantId: string,
  resource: LimitedBillingResource,
  db: BillingReadClient,
) {
  switch (resource) {
    case "users":
      return db.user.count({
        where: {
          tenantId,
          isActive: true,
        },
      });

    case "clients":
      return db.client.count({
        where: {
          tenantId,
          archivedAt: null,
        },
      });

    case "cases":
      return db.case.count({
        where: {
          tenantId,
        },
      });

    case "documents":
      return db.document.count({
        where: {
          tenantId,
        },
      });

    default:
      return 0;
  }
}

function getLimitMessage(resource: LimitedBillingResource, limit: number) {
  const resourceLabel: Record<LimitedBillingResource, string> = {
    users: "المستخدمين",
    clients: "الموكلين",
    cases: "القضايا",
    documents: "المستندات",
  };

  return `وصلت إلى حد ${resourceLabel[resource]} في خطتك الحالية (${limit}). قم بترقية الاشتراك للمتابعة.`;
}

export async function assertTenantCanUseStorage(
  tenantId: string,
  incomingBytes: number,
  db: BillingReadClient = prisma,
) {
  const writeCheck = await assertTenantCanWrite(
    tenantId,
    "رفع ملفات جديدة",
    db,
  );

  if (!writeCheck.ok) {
    return {
      ok: false as const,
      status: writeCheck.status,
      message: writeCheck.message,
      billing: writeCheck.billing ?? null,
      usedBytes: null,
      incomingBytes,
      limitBytes: null,
    };
  }

  const billing = writeCheck.billing;

  if (!billing.canCreate) {
    return {
      ok: false as const,
      status: 402,
      message:
        billing.blockReason || "لا يمكن رفع ملفات جديدة لأن الاشتراك غير نشط.",
      billing,
      usedBytes: null,
      incomingBytes,
      limitBytes: null,
    };
  }

  const storageMb = billing.limits.storageMb;

  if (storageMb === null) {
    return {
      ok: true as const,
      status: 200,
      billing,
      usedBytes: null,
      incomingBytes,
      limitBytes: null,
    };
  }

  const result = await db.document.aggregate({
    where: {
      tenantId,
    },
    _sum: {
      fileSize: true,
    },
  });

  const usedBytes = result._sum.fileSize || 0;
  const limitBytes = storageMb * 1024 * 1024;

  if (!hasPlanCapacity(usedBytes, limitBytes, incomingBytes)) {
    return {
      ok: false as const,
      status: 402,
      message: `وصلت إلى حد التخزين في خطتك الحالية (${formatStorageMb(
        storageMb,
      )}). قم بترقية الاشتراك للمتابعة.`,
      billing,
      usedBytes,
      incomingBytes,
      limitBytes,
    };
  }

  return {
    ok: true as const,
    status: 200,
    billing,
    usedBytes,
    incomingBytes,
    limitBytes,
  };
}

export async function assertTenantCanUseAi(
  tenantId: string,
  action = "استخدام المساعد الذكي",
) {
  const writeCheck = await assertTenantCanWrite(tenantId, action);

  if (!writeCheck.ok) {
    return {
      ok: false as const,
      status: writeCheck.status,
      message: writeCheck.message,
      billing: writeCheck.billing ?? null,
    };
  }

  const billing = writeCheck.billing;

  if (!billing.limits.aiEnabled) {
    return {
      ok: false as const,
      status: 402,
      message: "المساعد الذكي غير متاح في خطتك الحالية. قم بترقية الاشتراك للمتابعة.",
      billing,
    };
  }

  return {
    ok: true as const,
    status: 200,
    billing,
  };
}
