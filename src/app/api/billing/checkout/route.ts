import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { getPaymentProvider } from "@/lib/billing/provider";
import { BillingInterval } from "@/lib/billing/types";
import { verifySameOrigin } from "@/lib/csrf";

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "MONTHLY" || value === "YEARLY";
}

function getBaseUrl(req: NextRequest) {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");

  if (appUrl) return appUrl;

  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host");

  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    if (process.env.BILLING_ENABLED !== "true") {
      return err(
        "الدفع الإلكتروني غير متاح حالياً. لتفعيل أو تجديد الاشتراك يرجى التواصل مع إدارة Viresto.",
        403,
      );
    }

    if (process.env.BILLING_SELF_SERVICE_ENABLED !== "true") {
      return err(
        "تغيير الخطة من داخل النظام غير متاح حالياً. يرجى التواصل مع إدارة Viresto.",
        403,
      );
    }

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

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
      select: {
        id: true,
        code: true,
        name: true,
        priceMonthly: true,
        priceYearly: true,
        currency: true,
      },
    });

    if (!plan) {
      return err("الخطة غير موجودة أو غير مفعلة", 404);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: auth.user.userId,
        tenantId: auth.user.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    if (!user) {
      return err("المستخدم غير موجود", 404);
    }

    const baseUrl = getBaseUrl(req);
    const provider = getPaymentProvider();
    const amount = interval === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

    let checkout: Awaited<ReturnType<typeof provider.createCheckout>>;

    try {
      checkout = await provider.createCheckout({
        tenantId: auth.user.tenantId,
        userId: auth.user.userId,
        planCode: plan.code,
        planName: plan.name,
        interval,
        amount,
        currency: plan.currency,
        customer: {
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
        successUrl: `${baseUrl}/dashboard/billing?checkout=success`,
        cancelUrl: `${baseUrl}/dashboard/billing?checkout=cancelled`,
        webhookUrl: `${baseUrl}/api/webhooks/tap`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "تعذر إنشاء رابط الدفع";

      return err(message, 502);
    }

    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        tenantId: auth.user.tenantId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
      },
    });

    if (existingSubscription) {
      await prisma.subscription.update({
        where: {
          id: existingSubscription.id,
        },
        data: {
          planId: plan.id,
          provider: checkout.provider,
          providerCustomerId: checkout.providerCustomerId ?? null,
          providerSubscriptionId: checkout.providerReferenceId ?? null,
          status: "PAST_DUE",
          interval,
          currency: plan.currency,
          amount,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          tenantId: auth.user.tenantId,
          planId: plan.id,
          provider: checkout.provider,
          providerCustomerId: checkout.providerCustomerId ?? null,
          providerSubscriptionId: checkout.providerReferenceId ?? null,
          status: "PAST_DUE",
          interval,
          currency: plan.currency,
          amount,
        },
      });
    }

    return ok({
      checkoutUrl: checkout.checkoutUrl,
      provider: checkout.provider,
      providerReferenceId: checkout.providerReferenceId ?? null,
      providerCustomerId: checkout.providerCustomerId ?? null,
      plan: {
        code: plan.code,
        name: plan.name,
        currency: plan.currency,
        amount,
        interval,
      },
    });
  });
}
