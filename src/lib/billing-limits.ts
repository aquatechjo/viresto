import { prisma } from "@/lib/prisma";

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
  };
}

const BLOCKED_STATUSES = new Set([
  "CANCELLED",
  "EXPIRED",
  "UNPAID",
  "PAST_DUE",
  "MISSING",
]);

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

export async function getTenantBillingLimits(
  tenantId: string,
): Promise<TenantBillingLimits> {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
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

  if (subscription?.plan) {
    const status = getEffectiveSubscriptionStatus(
      subscription.status,
      subscription.currentPeriodEnd,
    );

    const canCreate = statusCanCreate(status);

    return {
      subscriptionId: subscription.id,
      subscriptionStatus: status,
      canCreate,
      blockReason: getBlockReason(status),
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        aiEnabled: subscription.plan.aiEnabled,
      },
      limits: {
        users: subscription.plan.maxUsers,
        clients: subscription.plan.maxClients,
        cases: subscription.plan.maxCases,
        documents: subscription.plan.maxDocuments,
        storageMb: subscription.plan.maxStorageMb,
        aiEnabled: subscription.plan.aiEnabled,
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
    },
  };
}

export async function assertTenantCanWrite(
  tenantId: string,
  action = "تنفيذ هذا الإجراء",
) {
  const tenant = await prisma.tenant.findUnique({
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

  const billing = await getTenantBillingLimits(tenantId);

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
) {
  const writeCheck = await assertTenantCanWrite(tenantId, "إنشاء عنصر جديد");

  if (!writeCheck.ok) {
    return {
      ok: false as const,
      message: writeCheck.message,
      billing: writeCheck.billing ?? null,
    };
  }

  const billing = writeCheck.billing;

  if (!billing.canCreate) {
    return {
      ok: false as const,
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
      billing,
      limit,
      used: null,
    };
  }

  const used = await getResourceUsage(tenantId, resource);

  if (used >= limit) {
    return {
      ok: false as const,
      message: getLimitMessage(resource, limit),
      billing,
      limit,
      used,
    };
  }

  return {
    ok: true as const,
    billing,
    limit,
    used,
  };
}

async function getResourceUsage(
  tenantId: string,
  resource: LimitedBillingResource,
) {
  switch (resource) {
    case "users":
      return prisma.user.count({
        where: {
          tenantId,
          isActive: true,
        },
      });

    case "clients":
      return prisma.client.count({
        where: {
          tenantId,
          archivedAt: null,
        },
      });

    case "cases":
      return prisma.case.count({
        where: {
          tenantId,
        },
      });

    case "documents":
      return prisma.document.count({
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
) {
  const writeCheck = await assertTenantCanWrite(tenantId, "رفع ملفات جديدة");

  if (!writeCheck.ok) {
    return {
      ok: false as const,
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
      billing,
      usedBytes: null,
      incomingBytes,
      limitBytes: null,
    };
  }

  const result = await prisma.document.aggregate({
    where: {
      tenantId,
    },
    _sum: {
      fileSize: true,
    },
  });

  const usedBytes = result._sum.fileSize || 0;
  const limitBytes = storageMb * 1024 * 1024;

  if (usedBytes + incomingBytes > limitBytes) {
    return {
      ok: false as const,
      message: `وصلت إلى حد التخزين في خطتك الحالية (${storageMb} MB). قم بترقية الاشتراك للمتابعة.`,
      billing,
      usedBytes,
      incomingBytes,
      limitBytes,
    };
  }

  return {
    ok: true as const,
    billing,
    usedBytes,
    incomingBytes,
    limitBytes,
  };
}
