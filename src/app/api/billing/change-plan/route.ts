import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";

type BillingInterval = "MONTHLY" | "YEARLY";

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "MONTHLY" || value === "YEARLY";
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
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

    const planCode = String(body?.planCode || "")
      .trim()
      .toUpperCase();
    const interval = String(body?.interval || "MONTHLY")
      .trim()
      .toUpperCase();

    if (!planCode) {
      return err("يرجى اختيار الخطة", 400);
    }

    if (!isBillingInterval(interval)) {
      return err("دورة الاشتراك غير صحيحة", 400);
    }

    const plan = await prisma.billingPlan.findFirst({
      where: {
        code: planCode,
        isActive: true,
      },
    });

    if (!plan) {
      return err("الخطة غير موجودة أو غير مفعلة", 404);
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
    const amount = interval === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
    const currentPeriodEnd =
      interval === "YEARLY" ? addMonths(now, 12) : addMonths(now, 1);

    if (!currentSubscription) {
      const created = await prisma.subscription.create({
        data: {
          tenantId: auth.user.tenantId,
          planId: plan.id,
          provider: "MANUAL",
          status: "ACTIVE",
          interval,
          currency: plan.currency,
          amount,
          currentPeriodStart: now,
          currentPeriodEnd,
        },
        include: {
          plan: true,
        },
      });

      await prisma.activity.create({
        data: {
          tenantId: auth.user.tenantId,
          actorId: auth.user.userId,
          type: "BILLING_PLAN_CHANGED",
          title: "تم تغيير خطة الاشتراك",
          message: `تم تفعيل خطة ${plan.name} يدوياً`,
          entityType: "Subscription",
          entityId: created.id,
        },
      });

      return ok({
        message: "تم تغيير الخطة بنجاح",
        subscription: created,
      });
    }

    const updated = await prisma.subscription.update({
      where: {
        id: currentSubscription.id,
      },
      data: {
        planId: plan.id,
        provider: "MANUAL",
        status: "ACTIVE",
        interval,
        currency: plan.currency,
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

    await prisma.activity.create({
      data: {
        tenantId: auth.user.tenantId,
        actorId: auth.user.userId,
        type: "BILLING_PLAN_CHANGED",
        title: "تم تغيير خطة الاشتراك",
        message: `تم تغيير الخطة إلى ${plan.name} يدوياً`,
        entityType: "Subscription",
        entityId: updated.id,
      },
    });

    return ok({
      message: "تم تغيير الخطة بنجاح",
      subscription: updated,
    });
  });
}
