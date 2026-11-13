import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { WRITE_TRANSACTION } from "@/lib/transaction-options";
import { requirePermission, getRequestMeta } from "@/lib/api-auth";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { logActivity } from "@/lib/activity";
import { decryptText } from "@/lib/encryption";
import { buildPaymentAccessWhere } from "@/lib/access-control";
import { allocateReceiptNumber } from "@/lib/server/receipt-number";

type Params = { params: Promise<{ id: string }> };

/**
 * The data of a payment's receipt, for printing (finance plan, batch 6).
 *
 * POST, not GET: a collected payment recorded before receipt numbers
 * (2026-11-08) has none, and takes the next one of its office here, on its
 * first print. The payment row is locked first, so two prints at the same
 * time give one number. A cancelled payment never takes a number: it is
 * printed with its number if it had one, and with a "cancelled" stamp.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requirePermission(req, "finance.read");
    if (auth.error || !auth.user) return auth.error;

    const { id } = await params;
    const tenantId = auth.user.tenantId;
    const meta = getRequestMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Payment"
        WHERE "id" = ${id}
          AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        return { ok: false as const, status: 404, message: "الدفعة غير موجودة" };
      }

      const payment = await tx.payment.findFirst({
        where: buildPaymentAccessWhere(auth.user!, { id }),
        select: {
          id: true,
          status: true,
          receiptNumber: true,
          clientId: true,
          caseId: true,
          invoiceId: true,
        },
      });

      if (!payment) {
        return { ok: false as const, status: 404, message: "الدفعة غير موجودة" };
      }

      if (payment.status !== "PAID" && payment.status !== "CANCELLED") {
        return {
          ok: false as const,
          status: 409,
          message: "سند القبض يُطبع للدفعة المحصّلة فقط",
        };
      }

      if (payment.status === "PAID" && !payment.receiptNumber) {
        const receiptNumber = await allocateReceiptNumber(tenantId, tx);

        await tx.payment.update({
          where: { id: payment.id },
          data: { receiptNumber },
        });

        await logActivity(
          {
            tenantId,
            actorId: auth.user!.userId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            // Same type and entity as the other payment records, so it is
            // kept as long and shows in the same history.
            type: "PAYMENT_UPDATED",
            title: "رقم سند قبض لدفعة محصّلة سابقًا",
            message: receiptNumber,
            entityType: payment.invoiceId ? "INVOICE" : payment.caseId ? "CASE" : "CLIENT",
            entityId: payment.invoiceId ?? payment.caseId ?? payment.clientId,
          },
          tx,
        );
      }

      const receipt = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        select: {
          id: true,
          receiptNumber: true,
          status: true,
          amount: true,
          method: true,
          reference: true,
          paidAt: true,
          cancelledAt: true,
          cancellationReason: true,
          client: { select: { id: true, name: true, phone: true } },
          case: { select: { id: true, title: true, caseNumber: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          collectedBy: { select: { id: true, name: true } },
          tenant: {
            select: {
              name: true,
              email: true,
              phone: true,
              address: true,
              logoUrl: true,
            },
          },
        },
      });

      return { ok: true as const, receipt };
    }, WRITE_TRANSACTION);

    if (!result.ok) return err(result.message, result.status);

    const { receipt } = result;

    return ok({
      ...receipt,
      amount: Number(receipt.amount),
      client: { ...receipt.client, phone: decryptText(receipt.client.phone) },
    });
  });
}
