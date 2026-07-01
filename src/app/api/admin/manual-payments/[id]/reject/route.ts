import { NextRequest } from "next/server";
import { BillingProvider, SubscriptionStatus } from "@prisma/client";
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
      select: {
        id: true,
        tenantId: true,
        subscriptionId: true,
        status: true,
      },
    });

    if (!payment) {
      return err("طلب الدفع غير موجود", 404);
    }

    if (payment.status !== "PENDING") {
      return err("لا يمكن مراجعة هذا الطلب لأنه ليس بانتظار المراجعة", 400);
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.subscriptionPayment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "REJECTED",
          reviewedAt: now,
          reviewedById: auth.user.userId,
          adminNote: adminNote || "تم رفض الإيصال",
        },
      });

      const updatedSubscription = await tx.subscription.update({
        where: {
          id: payment.subscriptionId,
        },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: now,
          cancelAtPeriodEnd: false,
        },
      });

      return {
        payment: updatedPayment,
        subscription: updatedSubscription,
      };
    });

    return ok({
      message: "تم رفض طلب الدفع",
      result,
    });
  });
}