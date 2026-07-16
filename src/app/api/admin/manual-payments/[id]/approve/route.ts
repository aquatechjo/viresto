import { NextRequest } from "next/server";
import {
  BillingInterval,
  Plan,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function tenantPlanForBillingCode(code: string): Plan | null {
  switch (code.toUpperCase()) {
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

function addBillingPeriod(start: Date, interval: BillingInterval) {
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

async function readBody(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    if (!auth.user.isSystemAdmin) {
      return err("لا تملك صلاحية إدارة مدفوعات النظام", 403);
    }

    const { id } = await context.params;
    const body = await readBody(req);

    const adminNote =
      typeof body.adminNote === "string"
        ? body.adminNote.trim().slice(0, 1000)
        : null;

    const payment = await prisma.subscriptionPayment.findFirst({
      where: {
        id,
        receiptUrl: {
          not: null,
        },
      },
      include: {
        requestedPlan: true,
        subscription: {
          include: {
            plan: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      return err("طلب الدفع غير موجود", 404);
    }

    if (payment.status !== "PENDING") {
      return err("لا يمكن مراجعة هذا الطلب لأنه ليس بانتظار المراجعة", 409);
    }

    const requestedPlan = payment.requestedPlan ?? payment.subscription?.plan;
    const requestedInterval =
      payment.requestedInterval ?? payment.subscription?.interval;

    if (!requestedPlan || !requestedInterval) {
      return err("بيانات الخطة المطلوبة غير مكتملة", 409);
    }

    const tenantPlan = tenantPlanForBillingCode(requestedPlan.code);

    if (!tenantPlan) {
      return err("رمز الخطة غير مدعوم", 409);
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.subscriptionPayment.updateMany({
        where: {
          id: payment.id,
          status: "PENDING",
        },
        data: {
          status: "PROCESSING",
        },
      });

      if (claim.count !== 1) {
        return null;
      }

      const currentSubscription = await tx.subscription.findFirst({
        where: {
          tenantId: payment.tenantId,
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const isRenewal =
        currentSubscription?.status === SubscriptionStatus.ACTIVE &&
        currentSubscription.planId === requestedPlan.id &&
        currentSubscription.interval === requestedInterval;

      let activatedSubscription;

      if (isRenewal && currentSubscription) {
        const periodBase =
          currentSubscription.currentPeriodEnd &&
          currentSubscription.currentPeriodEnd > now
            ? currentSubscription.currentPeriodEnd
            : now;

        await tx.subscription.updateMany({
          where: {
            tenantId: payment.tenantId,
            id: {
              not: currentSubscription.id,
            },
            status: {
              in: [
                SubscriptionStatus.TRIALING,
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
                SubscriptionStatus.UNPAID,
              ],
            },
          },
          data: {
            status: SubscriptionStatus.CANCELLED,
            cancelledAt: now,
            cancelAtPeriodEnd: false,
          },
        });

        activatedSubscription = await tx.subscription.update({
          where: {
            id: currentSubscription.id,
          },
          data: {
            status: SubscriptionStatus.ACTIVE,
            amount: payment.amount,
            currency: payment.currency,
            trialEndsAt: null,
            currentPeriodStart:
              currentSubscription.currentPeriodStart ?? now,
            currentPeriodEnd: addBillingPeriod(
              periodBase,
              requestedInterval,
            ),
            cancelAtPeriodEnd: false,
            cancelledAt: null,
          },
          include: {
            plan: true,
          },
        });
      } else {
        await tx.subscription.updateMany({
          where: {
            tenantId: payment.tenantId,
            status: {
              in: [
                SubscriptionStatus.TRIALING,
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
                SubscriptionStatus.UNPAID,
              ],
            },
          },
          data: {
            status: SubscriptionStatus.CANCELLED,
            cancelledAt: now,
            cancelAtPeriodEnd: false,
          },
        });

        activatedSubscription = await tx.subscription.create({
          data: {
            tenantId: payment.tenantId,
            planId: requestedPlan.id,
            status: SubscriptionStatus.ACTIVE,
            interval: requestedInterval,
            amount: payment.amount,
            currency: payment.currency,
            trialEndsAt: null,
            currentPeriodStart: now,
            currentPeriodEnd: addBillingPeriod(now, requestedInterval),
            cancelAtPeriodEnd: false,
            cancelledAt: null,
          },
          include: {
            plan: true,
          },
        });
      }

      const updatedPayment = await tx.subscriptionPayment.update({
        where: {
          id: payment.id,
        },
        data: {
          subscriptionId: activatedSubscription.id,
          requestedPlanId: requestedPlan.id,
          requestedInterval,
          status: "APPROVED",
          paidAt: now,
          reviewedAt: now,
          reviewedById: auth.user.userId,
          adminNote,
        },
      });

      const updatedTenant = await tx.tenant.update({
        where: {
          id: payment.tenantId,
        },
        data: {
          status: "ACTIVE",
          isSuspended: false,
          trialEndsAt: null,
          plan: tenantPlan,
          maxUsers: requestedPlan.maxUsers,
          ...(requestedPlan.aiEnabled
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

      await tx.activity.create({
        data: {
          tenantId: payment.tenantId,
          actorId: auth.user.userId,
          type: "MANUAL_PAYMENT_APPROVED",
          title: "تمت الموافقة على طلب الدفع اليدوي",
          message: `تم تفعيل خطة ${requestedPlan.name} (${requestedInterval}) بعد مراجعة الإيصال`,
          entityType: "SubscriptionPayment",
          entityId: payment.id,
        },
      });

      return {
        payment: updatedPayment,
        subscription: activatedSubscription,
        tenant: updatedTenant,
        renewal: isRenewal,
      };
    });

    if (!result) {
      return err("تمت مراجعة الطلب مسبقًا أو تتم مراجعته الآن", 409);
    }

    return ok({
      message: "تمت الموافقة على الدفع وتفعيل الاشتراك بنجاح",
      result,
    });
  });
}
