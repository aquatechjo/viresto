import { NextRequest } from "next/server";
import { BillingProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";

function formatMoney(amountInFils: number, currency = "JOD") {
  const value = amountInFils / 1000;

  return {
    raw: amountInFils,
    value,
    currency,
    formatted: `${value.toFixed(3)} ${currency}`,
  };
}

function normalizeStatus(value: string | null) {
  const status = String(value || "").trim().toUpperCase();

  if (!status || status === "ALL") return null;

  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    return null;
  }

  return status;
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    if (!auth.user.isSystemAdmin) {
      return err("لا تملك صلاحية إدارة مدفوعات النظام", 403);
    }

    const url = new URL(req.url);
    const status = normalizeStatus(url.searchParams.get("status"));

    const manualPaymentWhere = {
      provider: BillingProvider.MANUAL,
      receiptUrl: {
        not: null,
      },
    } as const;

    const [payments, statusCounts] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        where: {
          ...manualPaymentWhere,
          ...(status ? { status } : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
        select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        method: true,
        receiptUrl: true,
        receiptPublicId: true,
        adminNote: true,
        reviewedById: true,
        reviewedAt: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
        raw: true,
        requestedInterval: true,
        requestedPlan: {
          select: {
            id: true,
            code: true,
            name: true,
            currency: true,
            priceMonthly: true,
            priceYearly: true,
            maxUsers: true,
            maxClients: true,
            maxCases: true,
            maxDocuments: true,
            maxStorageMb: true,
            aiEnabled: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            status: true,
            plan: true,
            trialEndsAt: true,
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
            interval: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            plan: {
              select: {
                id: true,
                code: true,
                name: true,
                currency: true,
                priceMonthly: true,
                priceYearly: true,
                maxUsers: true,
                maxClients: true,
                maxCases: true,
                maxDocuments: true,
                maxStorageMb: true,
                aiEnabled: true,
              },
            },
          },
        },
        },
      }),
      prisma.subscriptionPayment.groupBy({
        by: ["status"],
        where: {
          ...manualPaymentWhere,
          status: {
            in: ["PENDING", "APPROVED", "REJECTED"],
          },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const summary = statusCounts.reduce(
      (acc, item) => {
        const key = item.status.toUpperCase();

        if (key === "PENDING") acc.pending = item._count._all;
        else if (key === "APPROVED") acc.approved = item._count._all;
        else if (key === "REJECTED") acc.rejected = item._count._all;

        return acc;
      },
      {
        pending: 0,
        approved: 0,
        rejected: 0,
      },
    );

    return ok({
      summary,
      payments: payments.map((payment) => {
        const plan = payment.requestedPlan ?? payment.subscription?.plan ?? null;
        const interval =
          payment.requestedInterval ?? payment.subscription?.interval ?? null;

        return {
          id: payment.id,
          amount: formatMoney(payment.amount, payment.currency),
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          receiptUrl: payment.receiptUrl,
          receiptPublicId: payment.receiptPublicId,
          adminNote: payment.adminNote,
          reviewedById: payment.reviewedById,
          reviewedAt: payment.reviewedAt,
          paidAt: payment.paidAt,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
          raw: payment.raw,
          tenant: payment.tenant,
          plan,
          interval,
          subscription: payment.subscription,
        };
      }),
    });
  });
}
