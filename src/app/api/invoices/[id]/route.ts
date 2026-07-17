import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { ok, err, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { logActivity } from "@/lib/activity";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { invoiceCreateSchema } from "@/lib/validations";
import { verifySameOrigin } from "@/lib/csrf";
import { decryptText } from "@/lib/encryption";
import {
  buildCaseAccessWhere,
  buildClientAccessWhere,
  buildInvoiceAccessWhere,
  buildInvoiceIdentifierAccessWhere,
} from "@/lib/access-control";
import { roundMoney } from "@/lib/finance";
import { MAX_JOD_AMOUNT } from "@/lib/money";
import {
  assertCaseCanAcceptAmount,
  isCaseFinancialLimitError,
} from "@/lib/server/case-finance-integrity";

type Params = { params: Promise<{ id: string }> };

const allowedStatuses = [
  "DRAFT",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

type InvoiceStatusValue = (typeof allowedStatuses)[number];

type CalculatedItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

function calculateTotals(
  itemsInput: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>,
  taxInput = 0,
  discountInput = 0,
) {
  const items: CalculatedItem[] = itemsInput.map((item) => {
    const quantity = roundMoney(Number(item.quantity));
    const unitPrice = roundMoney(Number(item.unitPrice));

    return {
      description: item.description.trim(),
      quantity,
      unitPrice,
      total: roundMoney(quantity * unitPrice),
    };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const tax = roundMoney(Number(taxInput || 0));
  const discount = roundMoney(Number(discountInput || 0));
  const beforeDiscount = roundMoney(subtotal + tax);

  if (
    items.some((item) => item.total > MAX_JOD_AMOUNT) ||
    subtotal > MAX_JOD_AMOUNT ||
    beforeDiscount > MAX_JOD_AMOUNT
  ) {
    return {
      error: "إجمالي الفاتورة أكبر من الحد المالي المسموح",
      items,
      subtotal,
      tax,
      discount,
      total: 0,
    };
  }

  if (discount > beforeDiscount) {
    return {
      error: "الخصم لا يمكن أن يكون أكبر من المجموع مع الضريبة",
      items,
      subtotal,
      tax,
      discount,
      total: 0,
    };
  }

  return {
    error: null,
    items,
    subtotal,
    tax,
    discount,
    total: roundMoney(beforeDiscount - discount),
  };
}

function decryptInvoiceClient<T extends { client?: any }>(invoice: T | null) {
  if (!invoice?.client) return invoice;

  return {
    ...invoice,
    client: {
      ...invoice.client,
      email: decryptText(invoice.client.email),
      phone: decryptText(invoice.client.phone),
      nationalId: decryptText(invoice.client.nationalId),
      address: decryptText(invoice.client.address),
      notes: decryptText(invoice.client.notes),
    },
  };
}

function normalizeInvoiceItems(
  items: Array<{
    description: string;
    quantity: number | string | Prisma.Decimal;
    unitPrice: number | string | Prisma.Decimal;
  }>,
) {
  return items.map((item) => ({
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
  }));
}

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: buildInvoiceIdentifierAccessWhere(id, auth.user),
      include: {
        client: true,
        case: {
          select: {
            id: true,
            publicId: true,
            title: true,
            caseNumber: true,
            client: {
              select: {
                id: true,
                publicId: true,
                name: true,
                archivedAt: true,
              },
            },
          },
        },
        items: true,
        payments: {
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!invoice) {
      return notFound("الفاتورة غير موجودة");
    }

    return ok(decryptInvoiceClient(invoice));
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعديل فاتورة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: buildInvoiceIdentifierAccessWhere(id, auth.user),
      include: {
        client: true,
        case: {
          select: {
            id: true,
            publicId: true,
            title: true,
            caseNumber: true,
            clientId: true,
            client: {
              select: {
                id: true,
                publicId: true,
                name: true,
                archivedAt: true,
              },
            },
          },
        },
        items: true,
        payments: {
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!invoice) {
      return notFound("الفاتورة غير موجودة");
    }

    const body = await req.json().catch(() => ({}));
    const statusRaw =
      typeof body.status === "string"
        ? body.status.trim().toUpperCase()
        : undefined;

    if (
      statusRaw !== undefined &&
      !allowedStatuses.includes(statusRaw as any)
    ) {
      return err("حالة الفاتورة غير صالحة", 400);
    }

    const parsed = invoiceCreateSchema.partial().safeParse(body);

    if (!parsed.success) {
      return err("بيانات الفاتورة غير صالحة", 400, parsed.error.flatten());
    }

    const hasStatusUpdate = statusRaw !== undefined;

    if (Object.keys(parsed.data).length === 0 && !hasStatusUpdate) {
      return err("لا توجد بيانات للتعديل", 400);
    }

    const data = parsed.data;
    if (statusRaw === "PAID" || statusRaw === "PARTIALLY_PAID") {
      return err(
        "لا يمكن تعيين الفاتورة كمدفوعة يدويًا. سجّل دفعة على الفاتورة وسيحسب النظام حالتها تلقائيًا.",
        400,
      );
    }

    const paidTotal = roundMoney(
      invoice.payments
        .filter((payment) => payment.status === "PAID")
        .reduce((sum, payment) => sum + Number(payment.amount), 0),
    );

    const hasPaidPayments = paidTotal > 0;

    const paidLocked = invoice.status === "PAID" || hasPaidPayments;

    const hasFinancialChanges =
      data.items !== undefined ||
      data.tax !== undefined ||
      data.discount !== undefined ||
      data.clientId !== undefined ||
      data.caseId !== undefined;

    if (paidLocked && hasFinancialChanges) {
      return err(
        "لا يمكن تعديل البيانات المالية لفاتورة مدفوعة أو مرتبطة بدفعة مدفوعة",
        409,
      );
    }

    if (
      hasPaidPayments &&
      statusRaw !== undefined &&
      statusRaw !== invoice.status
    ) {
      return err(
        "لا يمكن تغيير حالة فاتورة لديها دفعات محصلة. يجب معالجة الدفعات المرتبطة أولًا.",
        409,
      );
    }

    let dueDateUpdate: Date | null | undefined;

    if (data.dueDate !== undefined) {
      if (data.dueDate) {
        const date = new Date(data.dueDate);

        if (Number.isNaN(date.getTime())) {
          return err("تاريخ استحقاق الفاتورة غير صالح", 400);
        }

        dueDateUpdate = date;
      } else {
        dueDateUpdate = null;
      }
    }

    const notesUpdate =
      data.notes !== undefined ? data.notes?.trim() || null : undefined;

    let nextClientId = data.clientId ?? invoice.clientId;
    const nextCaseId =
      data.caseId !== undefined ? data.caseId || null : invoice.caseId;

    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: buildClientAccessWhere(auth.user, { id: data.clientId }),
        select: {
          id: true,
          name: true,
          archivedAt: true,
        },
      });

      if (!client) {
        return err("الموكل غير موجود داخل هذا المكتب", 404);
      }
    }

    if (nextCaseId) {
      const selectedCase = await prisma.case.findFirst({
        where: buildCaseAccessWhere(auth.user, {
          id: nextCaseId,
          ...(data.clientId ? { clientId: nextClientId } : {}),
        }),
        select: {
          id: true,
          clientId: true,
          feeAgreed: true,
          client: {
            select: {
              id: true,
              name: true,
              archivedAt: true,
            },
          },
        },
      });

      if (!selectedCase) {
        return err("القضية غير موجودة لهذا الموكل أو لا تتبع هذا المكتب", 404);
      }

      if (data.clientId && selectedCase.clientId !== data.clientId) {
        return err("القضية لا تتبع الموكل المحدد", 400);
      }

      if (!data.clientId) {
        nextClientId = selectedCase.clientId;
      }

    }

    const itemsForTotals =
      data.items !== undefined
        ? data.items
        : normalizeInvoiceItems(invoice.items);

    const shouldRecalculateTotals =
      data.items !== undefined ||
      data.tax !== undefined ||
      data.discount !== undefined;

    const totals = shouldRecalculateTotals
      ? calculateTotals(
          itemsForTotals,
          data.tax !== undefined ? data.tax : Number(invoice.tax),
          data.discount !== undefined
            ? data.discount
            : Number(invoice.discount),
        )
      : null;

    if (totals?.error) {
      return err(totals.error, 400);
    }

    const nextStatus = (statusRaw || invoice.status) as InvoiceStatusValue;
    const shouldUpdateClientRelation =
      data.clientId !== undefined || data.caseId !== undefined;

    const updateInvoice = () => prisma.$transaction(async (tx) => {
      const lockedInvoice = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Invoice"
        WHERE "id" = ${invoice.id}
          AND "tenantId" = ${auth.user!.tenantId}
        FOR UPDATE
      `;

      if (lockedInvoice.length === 0) {
        throw new Error("INVOICE_NOT_FOUND");
      }

      const currentInvoice = await tx.invoice.findUnique({
        where: { id: invoice.id },
        select: {
          status: true,
          updatedAt: true,
          payments: {
            where: { status: "PAID" },
            select: { amount: true },
          },
        },
      });

      if (!currentInvoice) {
        throw new Error("INVOICE_NOT_FOUND");
      }

      /*
       * منع lost update: أي دفعة أو تعديل متزامن يغيّر updatedAt قبل أن
       * نحصل على القفل، وعندها نطلب من الواجهة إعادة تحميل أحدث نسخة.
       */
      if (currentInvoice.updatedAt.getTime() !== invoice.updatedAt.getTime()) {
        throw new Error("INVOICE_CHANGED");
      }

      const currentPaidTotal = roundMoney(
        currentInvoice.payments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        ),
      );
      const currentHasPaidPayments = currentPaidTotal > 0;

      if (
        (currentInvoice.status === "PAID" || currentHasPaidPayments) &&
        hasFinancialChanges
      ) {
        throw new Error("INVOICE_FINANCIAL_LOCKED");
      }

      if (
        currentHasPaidPayments &&
        statusRaw !== undefined &&
        statusRaw !== currentInvoice.status
      ) {
        throw new Error("INVOICE_STATUS_LOCKED");
      }

      if (nextCaseId && nextStatus !== "CANCELLED") {
        await assertCaseCanAcceptAmount(tx, {
          tenantId: auth.user!.tenantId,
          caseId: nextCaseId,
          excludeInvoiceId: invoice.id,
          amount: roundMoney(totals ? totals.total : Number(invoice.total)),
          label: "الفاتورة",
        });
      }

      const updateData: Prisma.InvoiceUpdateInput = {
        ...(statusRaw !== undefined ? { status: nextStatus as any } : {}),
        ...(shouldUpdateClientRelation
          ? {
              client: {
                connect: {
                  id: nextClientId,
                },
              },
            }
          : {}),
        ...(data.caseId !== undefined
          ? nextCaseId
            ? {
                case: {
                  connect: {
                    id: nextCaseId,
                  },
                },
              }
            : {
                case: {
                  disconnect: true,
                },
              }
          : {}),
        ...(dueDateUpdate !== undefined ? { dueDate: dueDateUpdate } : {}),
        ...(notesUpdate !== undefined ? { notes: notesUpdate } : {}),
        ...(totals
          ? {
              subtotal: totals.subtotal,
              tax: totals.tax,
              discount: totals.discount,
              total: totals.total,
            }
          : {}),
        ...(data.items !== undefined && totals
          ? {
              items: {
                deleteMany: {},
                create: totals.items,
              },
            }
          : {}),
      };

      const updatedInvoice = await tx.invoice.update({
        where: {
          id: invoice.id,
        },
        data: updateData,
        include: {
          client: true,
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  archivedAt: true,
                },
              },
            },
          },
          items: true,
          payments: {
            orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          },
        },
      });

      return updatedInvoice;
    });

    let updated: Awaited<ReturnType<typeof updateInvoice>>;

    try {
      updated = await updateInvoice();
    } catch (error) {
      if (error instanceof Error && error.message === "INVOICE_NOT_FOUND") {
        return notFound("الفاتورة غير موجودة");
      }

      if (error instanceof Error && error.message === "INVOICE_CHANGED") {
        return err(
          "تم تعديل الفاتورة أو تسجيل دفعة عليها بالتزامن. حدّث الصفحة ثم أعد المحاولة.",
          409,
        );
      }

      if (
        error instanceof Error &&
        error.message === "INVOICE_FINANCIAL_LOCKED"
      ) {
        return err(
          "لا يمكن تعديل البيانات المالية لفاتورة مدفوعة أو مرتبطة بدفعة مدفوعة",
          409,
        );
      }

      if (
        error instanceof Error &&
        error.message === "INVOICE_STATUS_LOCKED"
      ) {
        return err(
          "لا يمكن تغيير حالة فاتورة لديها دفعات محصلة. يجب معالجة الدفعات المرتبطة أولًا.",
          409,
        );
      }

      if (isCaseFinancialLimitError(error)) {
        return err(error.message, error.status, error.details);
      }

      throw error;
    }

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: "INVOICE_UPDATED",
      title: "تم تعديل فاتورة",
      message: updated.invoiceNumber,
      entityType: updated.caseId ? "CASE" : "INVOICE",
      entityId: updated.caseId || updated.id,
    });

    return ok(decryptInvoiceClient(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "حذف فاتورة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: buildInvoiceIdentifierAccessWhere(id, auth.user),
      include: {
        payments: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
        client: {
          select: {
            id: true,
            publicId: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            publicId: true,
            client: {
              select: {
                id: true,
                publicId: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return notFound("الفاتورة غير موجودة");
    }

    const isArchivedClient = Boolean(
      invoice.client?.archivedAt || invoice.case?.client?.archivedAt,
    );

    if (isArchivedClient) {
      return err("لا يمكن حذف فاتورة مرتبطة بموكل مؤرشف", 400);
    }

    if (invoice.payments.length > 0) {
      return err(
        "لا يمكن حذف فاتورة مرتبطة بدفعات. يجب معالجة الدفعات المرتبطة أولًا حتى لا يحدث خلل مالي.",
        409,
        {
          paymentsCount: invoice.payments.length,
        },
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        const lockedInvoice = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Invoice"
          WHERE "id" = ${invoice.id}
            AND "tenantId" = ${auth.user!.tenantId}
          FOR UPDATE
        `;

        if (lockedInvoice.length === 0) {
          throw new Error("INVOICE_NOT_FOUND");
        }

        const paymentsCount = await tx.payment.count({
          where: { invoiceId: invoice.id },
        });

        if (paymentsCount > 0) {
          throw new Error("INVOICE_HAS_PAYMENTS");
        }

        await tx.invoice.delete({
          where: { id: invoice.id },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVOICE_NOT_FOUND") {
        return notFound("الفاتورة غير موجودة");
      }

      if (error instanceof Error && error.message === "INVOICE_HAS_PAYMENTS") {
        return err(
          "لا يمكن حذف فاتورة مرتبطة بدفعات. يجب معالجة الدفعات المرتبطة أولًا حتى لا يحدث خلل مالي.",
          409,
        );
      }

      throw error;
    }

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: "INVOICE_DELETED",
      title: "تم حذف فاتورة",
      message: invoice.invoiceNumber,
      entityType: invoice.caseId ? "CASE" : "INVOICE",
      entityId: invoice.caseId || invoice.id,
    });

    return ok({ deleted: true });
  });
}
