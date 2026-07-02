import { NextRequest } from "next/server";
import { PLANS, getDisplayPrice, type PlanCode } from "@/config/plans";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";

type BillingInterval = "MONTHLY" | "YEARLY";

const VALID_PLAN_CODES = new Set<PlanCode>(["BASIC", "PRO", "BUSINESS"]);

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "MONTHLY" || value === "YEARLY";
}

function normalizePlanCode(value: unknown): PlanCode | null {
  const code = String(value || "")
    .trim()
    .toUpperCase() as PlanCode;

  if (!VALID_PLAN_CODES.has(code)) {
    return null;
  }

  return code;
}

function getConfiguredPlan(code: PlanCode) {
  return PLANS.find((plan) => plan.code === code) ?? null;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getPlanAmountFils(planCode: PlanCode, interval: BillingInterval) {
  const configuredPlan = getConfiguredPlan(planCode);

  if (!configuredPlan) {
    return null;
  }

  const monthlyAmountJod = getDisplayPrice(configuredPlan);
  const monthlyAmountFils = monthlyAmountJod * 1000;

  if (interval === "YEARLY") {
    return monthlyAmountFils * 12;
  }

  return monthlyAmountFils;
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    if (
      process.env.BILLING_MANUAL_ADMIN_ENABLED !== "true" ||
      !auth.user.isSystemAdmin
    ) {
      return err("تغيير الخطة يدوياً متاح لإدارة النظام فقط", 403);
    }

    const body = await req.json().catch(() => null);

    const planCode = normalizePlanCode(body?.planCode);

    const interval = String(body?.interval || "MONTHLY")
      .trim()
      .toUpperCase();

    if (!planCode) {
      return err("يرجى اختيار خطة صحيحة", 400);
    }

    if (!isBillingInterval(interval)) {
      return err("دورة الاشتراك غير صحيحة", 400);
    }

    const configuredPlan = getConfiguredPlan(planCode);

    if (!configuredPlan) {
      return err("الخطة غير معرفة داخل إعدادات النظام", 400);
    }

    const amount = getPlanAmountFils(planCode, interval);

    if (amount === null) {
      return err("تعذر حساب سعر الخطة", 400);
    }

    const plan = await prisma.billingPlan.findFirst({
      where: {
        code: planCode,
        isActive: true,
      },
    });

    if (!plan) {
      return err("الخطة غير موجودة أو غير مفعلة في قاعدة البيانات", 404);
    }

    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        tenantId: auth.user.tenantId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const now = new Date();

    const currentPeriodEnd =
      interval === "YEARLY" ? addMonths(now, 12) : addMonths(now, 1);

    const subscription = await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: {
          id: auth.user.tenantId,
        },
        data: {
          status: "ACTIVE",
        },
      });

      if (!currentSubscription) {
        const created = await tx.subscription.create({
          data: {
            tenantId: auth.user.tenantId,
            planId: plan.id,
            provider: "MANUAL",
            status: "ACTIVE",
            interval,
            currency: plan.currency || "JOD",
            amount,
            trialEndsAt: null,
            currentPeriodStart: now,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
            cancelledAt: null,
          },
          include: {
            plan: true,
          },
        });

        await tx.activity.create({
          data: {
            tenantId: auth.user.tenantId,
            actorId: auth.user.userId,
            type: "BILLING_PLAN_CHANGED",
            title: "تم تغيير خطة الاشتراك",
            message: `تم تفعيل خطة ${configuredPlan.name} يدوياً بسعر ${amount / 1000} JOD`,
            entityType: "Subscription",
            entityId: created.id,
          },
        });

        return created;
      }

      const updated = await tx.subscription.update({
        where: {
          id: currentSubscription.id,
        },
        data: {
          planId: plan.id,
          provider: "MANUAL",
          status: "ACTIVE",
          interval,
          currency: plan.currency || "JOD",
          amount,
          trialEndsAt: null,
          currentPeriodStart: now,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
        include: {
          plan: true,
        },
      });

      await tx.activity.create({
        data: {
          tenantId: auth.user.tenantId,
          actorId: auth.user.userId,
          type: "BILLING_PLAN_CHANGED",
          title: "تم تغيير خطة الاشتراك",
          message: `تم تغيير الخطة إلى ${configuredPlan.name} يدوياً بسعر ${amount / 1000} JOD`,
          entityType: "Subscription",
          entityId: updated.id,
        },
      });

      return updated;
    });

    return ok({
      message: "تم تغيير الخطة بنجاح",
      subscription,
    });
  });
}
