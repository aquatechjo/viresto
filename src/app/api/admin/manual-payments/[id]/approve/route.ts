import { NextRequest } from "next/server";
import {
  BillingInterval,
  BillingProvider,
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

function isTenantPlanCode(value: string): value is Plan {
  return Object.values(Plan).includes(value as Plan);
}

function addBillingPeriod(start: Date, interval: BillingInterval) {
  const end = new Date(start);

  if (interval === BillingInterval.YEARLY) {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

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
        provider: BillingProvider.MANUAL,
        receiptUrl: {
          not: null,
        },
      },
      include: {
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
      return err("لا يمكن مراجعة هذا الطلب لأنه ليس بانتظار المراجعة", 400);
    }

    const now = new Date();
    const currentPeriodEnd = addBillingPeriod(
      now,
      payment.subscription.interval,
    );

    const result = await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          tenantId: payment.tenantId,
          id: {
            not: payment.subscriptionId,
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

      const updatedSubscription = await tx.subscription.update({
        where: {
          id: payment.subscriptionId,
        },
        data: {
          status: SubscriptionStatus.ACTIVE,
          provider: BillingProvider.MANUAL,
          amount: payment.amount,
          currency: payment.currency,
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

      const updatedPayment = await tx.subscriptionPayment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "APPROVED",
          paidAt: now,
          reviewedAt: now,
          reviewedById: auth.user.userId,
          adminNote,
        },
      });

      const planCode = updatedSubscription.plan.code;

      const updatedTenant = await tx.tenant.update({
        where: {
          id: payment.tenantId,
        },
        data: {
          status: "ACTIVE",
          isSuspended: false,
          trialEndsAt: null,
          maxUsers: updatedSubscription.plan.maxUsers,
          aiEnabled: updatedSubscription.plan.aiEnabled,
          ...(isTenantPlanCode(planCode) ? { plan: planCode } : {}),
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

      return {
        payment: updatedPayment,
        subscription: updatedSubscription,
        tenant: updatedTenant,
      };
    });

    return ok({
      message: "تمت الموافقة على الدفع وتفعيل الاشتراك بنجاح",
      result,
    });
  });
}