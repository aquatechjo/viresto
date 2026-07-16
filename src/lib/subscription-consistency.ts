import {
  BillingInterval,
  Plan,
  TenantStatus,
  type Prisma,
} from "@prisma/client";
import {
  getDisplayPrice,
  getPlanByCode,
  getYearlyPrice,
  type PlanCode,
} from "@/config/plans";

const SUPPORTED_PLAN_CODES = new Set<PlanCode>([
  "BASIC",
  "PRO",
  "BUSINESS",
]);

function normalizePlanCode(code: string): PlanCode | null {
  const normalized = code.trim().toUpperCase() as PlanCode;
  return SUPPORTED_PLAN_CODES.has(normalized) ? normalized : null;
}

export function tenantPlanForBillingCode(code: string): Plan | null {
  switch (code.trim().toUpperCase()) {
    case "BASIC":
      return Plan.FREE;
    case "PRO":
      return Plan.PRO;
    case "BUSINESS":
      return Plan.ENTERPRISE;
    default:
      return null;
  }
}

export function getBillingPlanConfig(
  code: string,
  interval: BillingInterval,
) {
  const normalized = normalizePlanCode(code);
  const legacyPlan = tenantPlanForBillingCode(code);
  if (!normalized || !legacyPlan) return null;

  const plan = getPlanByCode(normalized);
  if (!plan) return null;

  return {
    plan,
    legacyPlan,
    currency: "JOD",
    amount:
      (interval === BillingInterval.YEARLY
        ? getYearlyPrice(plan)
        : getDisplayPrice(plan)) * 1000,
    maxUsers: plan.limits.users,
    aiEnabled: plan.limits.aiEnabled,
  };
}

export function addBillingPeriod(start: Date, interval: BillingInterval) {
  const end = new Date(start);
  const originalDay = end.getUTCDate();
  const months = interval === BillingInterval.YEARLY ? 12 : 1;

  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();

  end.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return end;
}

export async function syncTenantSubscriptionMirror(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    planCode: string;
    status?: TenantStatus;
    trialEndsAt?: Date | null;
  },
) {
  const legacyPlan = tenantPlanForBillingCode(input.planCode);
  const normalized = normalizePlanCode(input.planCode);
  const configuredPlan = normalized ? getPlanByCode(normalized) : null;

  if (!legacyPlan || !configuredPlan) {
    throw new Error(`UNSUPPORTED_BILLING_PLAN:${input.planCode}`);
  }

  return tx.tenant.update({
    where: { id: input.tenantId },
    data: {
      status: input.status ?? TenantStatus.ACTIVE,
      isSuspended: false,
      trialEndsAt: input.trialEndsAt ?? null,
      plan: legacyPlan,
      maxUsers: configuredPlan.limits.users,
      ...(configuredPlan.limits.aiEnabled
        ? {}
        : {
            aiEnabled: false,
            aiConsentAt: null,
            aiConsentBy: null,
            aiConsentPolicyVersion: null,
          }),
    },
    select: {
      id: true,
      name: true,
      status: true,
      plan: true,
      maxUsers: true,
      aiEnabled: true,
    },
  });
}
