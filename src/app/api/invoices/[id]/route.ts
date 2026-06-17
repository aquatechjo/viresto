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

type Params = { params: Promise<{ id: string }> };

const allowedStatuses = [
  "DRAFT",
  "UNPAID",
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

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
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
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
        payment: true,
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
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      include: {
        client: true,
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
            clientId: true,
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
        payment: true,
      },
    });

    if (!invoice) {
      return notFound("الفاتورة غير موجودة");
    }

    const body = await req.json().catch(() => ({}));
    const statusRaw =
      typeof body.status === "string" ? body.status.trim().toUpperCase() : undefined;

    if (statusRaw !== undefined && !allowedStatuses.includes(statusRaw as any)) {
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

    const paidLocked =
      invoice.status === "PAID" || invoice.payment?.status === "PAID";

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
      invoice.payment?.status === "PAID" &&
      statusRaw !== undefined &&
      statusRaw !== "PAID"
    ) {
      return err("لا يمكن تغيير حالة فاتورة مرتبطة بدفعة مدفوعة", 409);
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
    let nextCaseId =
      data.caseId !== undefined ? data.caseId || null : invoice.caseId;

    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: data.clientId,
          tenantId: auth.user.tenantId,
        },
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
        where: {
          id: nextCaseId,
          tenantId: auth.user.tenantId,
          ...(data.clientId ? { clientId: nextClientId } : {}),
        },
        select: {
          id: true,
          clientId: true,
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
          data.discount !== undefined ? data.discount : Number(invoice.discount),
        )
      : null;

    if (totals?.error) {
      return err(totals.error, 400);
    }

    const nextStatus = (statusRaw || invoice.status) as InvoiceStatusValue;

    if (nextStatus === "PAID" && !nextCaseId) {
      return err("لا يمكن تحويل الفاتورة إلى مدفوعة بدون ربطها بقضية", 400);
    }

    const shouldUpdateClientRelation =
      data.clientId !== undefined || data.caseId !== undefined;

    const updated = await prisma.$transaction(async (tx) => {
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
          payment: true,
        },
      });

      const shouldSyncPaidPayment =
        nextStatus === "PAID" &&
        nextCaseId &&
        (statusRaw === "PAID" || !updatedInvoice.payment);

      if (shouldSyncPaidPayment) {
        if (updatedInvoice.payment) {
          await tx.payment.update({
            where: {
              invoiceId: updatedInvoice.id,
            },
            data: {
              caseId: nextCaseId,
              amount: updatedInvoice.total,
              status: "PAID",
              paidAt: new Date(),
              notes: `دفعة من الفاتورة ${updatedInvoice.invoiceNumber}`,
            },
          });
        } else {
          await tx.payment.create({
            data: {
              tenantId: auth.user!.tenantId,
              caseId: nextCaseId,
              invoiceId: updatedInvoice.id,
              amount: updatedInvoice.total,
              status: "PAID",
              method: "CASH",
              paidAt: new Date(),
              notes: `دفعة تلقائية من الفاتورة ${updatedInvoice.invoiceNumber}`,
            },
          });
        }
      }

      return updatedInvoice;
    });

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
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      include: {
        payment: true,
        client: {
          select: {
            id: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            client: {
              select: {
                id: true,
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

    if (invoice.payment) {
      return err(
        "لا يمكن حذف فاتورة مرتبطة بدفعة. احذف الدفعة أو غيّر حالة الفاتورة أولًا.",
        409,
      );
    }

    const deleted = await prisma.invoice.deleteMany({
      where: {
        id: invoice.id,
        tenantId: auth.user.tenantId,
      },
    });

    if (deleted.count === 0) {
      return notFound("الفاتورة غير موجودة");
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