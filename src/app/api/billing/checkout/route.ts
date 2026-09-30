import { NextRequest } from "next/server";
import { SubscriptionStatus } from "@prisma/client";
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

// A Polar subscription in any of these is still alive (PAST_DUE: Polar is
// retrying the card), so the office must never be sent to a new checkout:
// that would create a second subscription and bill it twice.
const LIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];
const POLAR_LIVE_STATUSES = ["active", "trialing", "past_due"] as const;

// Read by the billing page, which opens the customer portal for it.
const PAYMENT_METHOD_UPDATE_REQUIRED = "PAYMENT_METHOD_UPDATE_REQUIRED";

function findLiveSubscription(tenantId: string) {
  return prisma.subscription.findFirst({
    where: {
      tenantId,
      polarSubscriptionId: { not: null },
      status: { in: LIVE_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
}

class PolarLookupError extends Error {}

/**
 * Our DB can lag Polar (the office paid in another tab and the webhook or
 * the return-confirm has not synced yet). Before opening a new checkout,
 * ask Polar whether this office already has a live subscription to one of
 * our products (checkout metadata.tenantId is copied onto it).
 */
async function findLiveSubscriptionInPolar(
  polar: ReturnType<typeof getPolarClient>,
  tenantId: string,
) {
  const plans = await prisma.billingPlan.findMany({
    select: { polarMonthlyProductId: true, polarYearlyProductId: true },
  });
  const productIds = plans
    .flatMap((plan) => [plan.polarMonthlyProductId, plan.polarYearlyProductId])
    .filter((id): id is string => Boolean(id));

  if (productIds.length === 0) return null;

  try {
    const page = await polar.subscriptions.list({
      metadata: { tenantId },
      productId: productIds,
      status: [...POLAR_LIVE_STATUSES],
      limit: 10,
    });

    return page.result.items[0] ?? null;
  } catch (error) {
    console.warn(
      `[polar-checkout] live_subscription_lookup_failed tenant=${tenantId} error=${error instanceof Error ? error.name : "unknown"}`,
    );
    throw new PolarLookupError();
  }
}

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

    // Never a second subscription: when the office already has a live one,
    // change it in place (or send them to fix the card) instead.
    let currentSubscription = await findLiveSubscription(auth.user.tenantId);

    if (!currentSubscription) {
      let polarLive;

      try {
        polarLive = await findLiveSubscriptionInPolar(polar, auth.user.tenantId);
      } catch (error) {
        if (error instanceof PolarLookupError) {
          // Fail closed: without knowing, a new checkout could double-bill.
          return err("تعذر التحقق من الاشتراك الحالي. حاول مرة أخرى بعد قليل.", 503);
        }
        throw error;
      }

      if (polarLive) {
        await syncSubscriptionFromPolar(polarLive);
        currentSubscription = await findLiveSubscription(auth.user.tenantId);

        if (!currentSubscription) {
          // Live in Polar but not attachable to this office (e.g. linked to
          // another office). Still never open a second checkout.
          console.warn(
            `[polar-checkout] live_subscription_unsynced tenant=${auth.user.tenantId} sub=${polarLive.id}`,
          );
          return err(
            "يوجد اشتراك فعّال لهذا المكتب في نظام الدفع. تواصل مع الدعم لإكماله.",
            409,
            { code: "SUBSCRIPTION_ALREADY_EXISTS" },
          );
        }
      }
    }

    if (currentSubscription?.status === SubscriptionStatus.PAST_DUE) {
      // The renewal failed and Polar is retrying: the fix is a new card on
      // the existing subscription (customer portal), never a new one.
      return err(
        "فشل تجديد اشتراكك الحالي. حدّث وسيلة الدفع من بوابة العميل بدل شراء اشتراك جديد.",
        409,
        { code: PAYMENT_METHOD_UPDATE_REQUIRED, action: "portal" },
      );
    }

    if (currentSubscription?.polarSubscriptionId) {
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
      // No trial on the Polar side: the office already had its in-app
      // trial, and paying ends it. The products carry no trial either;
      // this is the safety net if one is ever configured there again.
      allowTrial: false,
      externalCustomerId: auth.user.tenantId,
      // Polar fills {CHECKOUT_ID}; the billing page posts it to
      // /api/billing/checkout/confirm for an instant, verified unlock.
      successUrl: `${getAppUrl()}/dashboard/billing?checkout=success&checkout_id={CHECKOUT_ID}`,
      metadata: {
        tenantId: auth.user.tenantId,
        planCode,
        billingCycle,
      },
    });

    return ok({ mode: "checkout", url: checkout.url });
  });
}
