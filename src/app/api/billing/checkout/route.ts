import { NextRequest } from "next/server";
import { PLANS, type PlanCode } from "@/config/plans";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { getAppUrl, getPolarClient } from "@/lib/polar";
import { syncSubscriptionFromPolar } from "@/lib/polar-subscription-sync";

type BillingCycle = "monthly" | "yearly";

const VALID_PLAN_CODES = new Set<PlanCode>(["BASIC", "PRO", "BUSINESS"]);
const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING"]);

function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "yearly";
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

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const body = await req.json().catch(() => null);

    const planCode = normalizePlanCode(body?.planId);
    const billingCycle = String(body?.billingCycle || "monthly")
      .trim()
      .toLowerCase();

    if (!planCode) {
      return err("يرجى اختيار خطة صحيحة", 400);
    }

    if (!isBillingCycle(billingCycle)) {
      return err("دورة الفوترة غير صحيحة", 400);
    }

    if (!PLANS.some((plan) => plan.code === planCode)) {
      return err("الخطة غير معرفة داخل إعدادات النظام", 400);
    }

    const plan = await prisma.billingPlan.findFirst({
      where: { code: planCode, isActive: true },
    });

    if (!plan) {
      return err("الخطة غير موجودة أو غير مفعلة في قاعدة البيانات", 404);
    }

    const productId =
      billingCycle === "yearly"
        ? plan.polarYearlyProductId
        : plan.polarMonthlyProductId;

    if (!productId) {
      return err("لم يتم إعداد الدفع لهذه الخطة بعد", 400);
    }

    const polar = getPolarClient();

    // Polar rejects a second checkout for a customer who already has an
    // active subscription in the org (AlreadyActiveSubscriptionError at
    // confirmation). When the tenant already has a live Polar-linked
    // subscription, change it in place instead of starting a new checkout.
    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        tenantId: auth.user.tenantId,
        polarSubscriptionId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });

    if (
      currentSubscription?.polarSubscriptionId &&
      ACTIVE_STATUSES.has(currentSubscription.status)
    ) {
      const currentProductId =
        currentSubscription.interval === "YEARLY"
          ? currentSubscription.plan.polarYearlyProductId
          : currentSubscription.plan.polarMonthlyProductId;

      if (currentProductId === productId) {
        return err("أنت مشترك بهذه الخطة بالفعل", 400);
      }

      const updatedSubscription = await polar.subscriptions.update({
        id: currentSubscription.polarSubscriptionId,
        subscriptionUpdate: {
          productId,
          prorationBehavior: "prorate",
        },
      });

      await syncSubscriptionFromPolar(updatedSubscription);

      return ok({
        mode: "updated",
        message: "تم تغيير الخطة بنجاح",
      });
    }

    const checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: auth.user.tenantId,
      successUrl: `${getAppUrl()}/dashboard/billing?checkout=success`,
      metadata: {
        tenantId: auth.user.tenantId,
        planCode,
        billingCycle,
      },
    });

    return ok({ mode: "checkout", url: checkout.url });
  });
}
