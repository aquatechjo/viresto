import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";

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
        receiptUrl: {
          not: null,
        },
      },
      select: {
        id: true,
        tenantId: true,
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
      await lockTenantMutation(tx, payment.tenantId);

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

      await tx.activity.create({
        data: {
          tenantId: payment.tenantId,
          actorId: auth.user.userId,
          type: "MANUAL_PAYMENT_REJECTED",
          title: "تم رفض طلب الدفع اليدوي",
          message: adminNote || "تم رفض الإيصال بعد المراجعة",
          entityType: "SubscriptionPayment",
          entityId: payment.id,
        },
      });

      return {
        payment: updatedPayment,
      };
    });

    if (!result) {
      return err("تمت مراجعة الطلب مسبقًا أو تتم مراجعته الآن", 409);
    }

    return ok({
      message: "تم رفض طلب الدفع",
      result,
    });
  });
}
