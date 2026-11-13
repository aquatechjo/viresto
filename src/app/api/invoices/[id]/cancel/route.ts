import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { WRITE_TRANSACTION } from "@/lib/transaction-options";
import { requirePermission, getRequestMeta } from "@/lib/api-auth";
import { ok, err, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { logActivity } from "@/lib/activity";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";
import { buildInvoiceIdentifierAccessWhere } from "@/lib/access-control";
import { withInvoiceState } from "@/lib/finance";
import { invoiceCancelBlock, parseCancelReason } from "@/lib/invoice-lifecycle";

type Params = { params: Promise<{ id: string }> };

class CancelRefused extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Cancel an issued invoice: the office admin only (invoice.cancel), with a
 * reason, and final. Refused for a draft (deleted instead), for an invoice
 * already cancelled, and while it has pending or collected payments.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requirePermission(req, "invoice.cancel");
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "إلغاء فاتورة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsedReason = parseCancelReason(body?.reason);

    if (!parsedReason.ok) {
      return err(parsedReason.message, 400);
    }

    const invoice = await prisma.invoice.findFirst({
      where: buildInvoiceIdentifierAccessWhere(id, auth.user),
      select: {
        id: true,
        status: true,
        invoiceNumber: true,
        caseId: true,
        payments: { select: { status: true, amount: true } },
      },
    });

    if (!invoice) {
      return notFound("الفاتورة غير موجودة");
    }

    const block = invoiceCancelBlock(invoice);
    if (block) {
      return err(block, 409);
    }

    let cancelledId: string;

    try {
      cancelledId = await prisma.$transaction(async (tx) => {
        // Same lock as the payment routes, so a payment recorded at the same
        // moment either lands first (and blocks this) or sees CANCELLED.
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Invoice"
          WHERE "id" = ${invoice.id}
            AND "tenantId" = ${auth.user!.tenantId}
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new CancelRefused("الفاتورة غير موجودة");
        }

        const current = await tx.invoice.findUnique({
          where: { id: invoice.id },
          select: {
            status: true,
            payments: { select: { status: true, amount: true } },
          },
        });

        const currentBlock = current
          ? invoiceCancelBlock(current)
          : "الفاتورة غير موجودة";
        if (currentBlock) {
          throw new CancelRefused(currentBlock);
        }

        const cancelled = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledById: auth.user!.userId,
            cancellationReason: parsedReason.reason,
          },
          select: { id: true, invoiceNumber: true, caseId: true },
        });

        await logActivity(
          {
            actorId: auth.user!.userId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            tenantId: auth.user!.tenantId,
            type: "INVOICE_CANCELLED",
            title: "تم إلغاء فاتورة",
            message: `${cancelled.invoiceNumber} | ${parsedReason.reason}`,
            entityType: cancelled.caseId ? "CASE" : "INVOICE",
            entityId: cancelled.caseId || cancelled.id,
          },
          tx,
        );

        return cancelled.id;
      }, WRITE_TRANSACTION);
    } catch (error) {
      if (error instanceof CancelRefused) {
        return err(error.message, error.message === "الفاتورة غير موجودة" ? 404 : 409);
      }
      throw error;
    }

    // The response shape, read after the commit (not inside the row lock).
    const updated = await prisma.invoice.findUniqueOrThrow({
      where: { id: cancelledId },
      include: {
        client: { select: { id: true, publicId: true, name: true, archivedAt: true } },
        case: { select: { id: true, publicId: true, title: true, caseNumber: true } },
        items: true,
        payments: { orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }] },
        cancelledBy: { select: { id: true, name: true } },
      },
    });

    return ok(withInvoiceState(updated));
  });
}
