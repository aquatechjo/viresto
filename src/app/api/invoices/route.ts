import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { ok, err } from "@/lib/api-response";
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
} from "@/lib/access-control";
import { roundMoney } from "@/lib/finance";
import { MAX_JOD_AMOUNT } from "@/lib/money";
import { formatSequentialInvoiceNumber } from "@/lib/financial-audit";
import {
  assertCaseCanAcceptAmount,
  isCaseFinancialLimitError,
} from "@/lib/server/case-finance-integrity";

const allowedStatuses = [
  "DRAFT",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

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

async function allocateInvoiceNumber(
  tenantId: string,
  tx: Prisma.TransactionClient,
) {
  const year = DateTime.now().setZone("Asia/Amman").year;
  const allocated = await tx.$queryRaw<Array<{ sequenceNumber: number }>>`
    INSERT INTO "InvoiceSequence" (
      "tenantId",
      "year",
      "nextNumber",
      "createdAt",
      "updatedAt"
    )
    VALUES (${tenantId}, ${year}, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenantId", "year")
    DO UPDATE SET
      "nextNumber" = "InvoiceSequence"."nextNumber" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "nextNumber" - 1 AS "sequenceNumber"
  `;

  const sequenceNumber = allocated[0]?.sequenceNumber;

  if (!sequenceNumber) {
    throw new Error("INVOICE_SEQUENCE_ALLOCATION_FAILED");
  }

  return formatSequentialInvoiceNumber(year, sequenceNumber);
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") || "";
    const q = sp.get("q") || "";
    const archivedOnly = sp.get("archivedOnly") === "true";
    const pageRaw = Number(sp.get("page") || 1);
    const page = Number.isNaN(pageRaw) ? 1 : Math.max(Math.floor(pageRaw), 1);

    const limitRaw = Number(sp.get("limit") || 20);
    const limit = Number.isNaN(limitRaw)
      ? 20
      : Math.min(Math.max(limitRaw, 1), 100);

    if (status && !allowedStatuses.includes(status as any)) {
      return err("حالة الفاتورة غير صالحة", 400);
    }

    const where = buildInvoiceAccessWhere(auth.user, {
        ...(status ? { status: status as any } : {}),
        ...(archivedOnly
          ? {
              OR: [
                { client: { archivedAt: { not: null } } },
                { case: { client: { archivedAt: { not: null } } } },
              ],
            }
          : {}),
        ...(q
          ? {
              OR: [
                { invoiceNumber: { contains: q, mode: "insensitive" } },
                { client: { name: { contains: q, mode: "insensitive" } } },
                { case: { title: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      });

    const [invoices, total, statRows] = await prisma.$transaction([
      prisma.invoice.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            publicId: true,
            name: true,
            phone: true,
            email: true,
            archivedAt: true,
          },
        },
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
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        select: {
          total: true,
          status: true,
          client: { select: { archivedAt: true } },
          case: { select: { client: { select: { archivedAt: true } } } },
          payments: {
            where: { status: "PAID" },
            select: { amount: true },
          },
        },
      }),
    ]);

    const decryptedInvoices = invoices.map((invoice) => ({
      ...invoice,
      client: invoice.client
        ? {
            ...invoice.client,
            phone: decryptText(invoice.client.phone),
            email: decryptText(invoice.client.email),
          }
        : invoice.client,
    }));

    const stats = statRows.reduce(
      (result, invoice) => {
        const invoiceTotal = Number(invoice.total || 0);
        const paid = invoice.payments.reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0,
        );

        result.totalAmount += invoiceTotal;
        result.paidAmount += paid;
        if (["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) {
          result.unpaidAmount += Math.max(0, invoiceTotal - paid);
        }
        if (invoice.status === "OVERDUE") result.overdueCount += 1;
        if (invoice.status === "PAID") result.paidCount += 1;
        if (invoice.client?.archivedAt || invoice.case?.client?.archivedAt) {
          result.archivedCount += 1;
        }
        return result;
      },
      {
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        overdueCount: 0,
        paidCount: 0,
        archivedCount: 0,
        totalCount: total,
      },
    );

    return ok({
      items: decryptedInvoices,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats,
    });
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "إنشاء فاتورة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const body = await req.json().catch(() => ({}));
    const parsed = invoiceCreateSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات الفاتورة غير صالحة", 400, parsed.error.flatten());
    }

    const data = parsed.data;
    const caseId = data.caseId || null;
    let dueDate: Date | null = null;

    if (data.dueDate) {
      dueDate = new Date(data.dueDate);

      if (Number.isNaN(dueDate.getTime())) {
        return err("تاريخ استحقاق الفاتورة غير صالح", 400);
      }
    }
    const notes = data.notes?.trim() || null;
    const totals = calculateTotals(data.items, data.tax, data.discount);

    if (totals.error) {
      return err(totals.error, 400);
    }

    const client = await prisma.client.findFirst({
      where: buildClientAccessWhere(auth.user, { id: data.clientId }),
      select: {
        id: true,
        publicId: true,
        name: true,
        archivedAt: true,
      },
    });

    if (!client) {
      return err("الموكل غير موجود داخل هذا المكتب", 404);
    }

    if (caseId) {
      const selectedCase = await prisma.case.findFirst({
        where: buildCaseAccessWhere(auth.user, {
          id: caseId,
          clientId: data.clientId,
        }),
        select: {
          id: true,
          publicId: true,
          feeAgreed: true,
          client: {
            select: {
              id: true,
              publicId: true,
              archivedAt: true,
            },
          },
        },
      });

      if (!selectedCase) {
        return err("القضية غير موجودة لهذا الموكل", 404);
      }

      const caseFee = roundMoney(Number(selectedCase.feeAgreed || 0));

      if (caseFee <= 0) {
        return err(
          "لا يمكن إنشاء فاتورة لهذه القضية قبل تحديد قيمة الأتعاب المتفق عليها",
          400,
        );
      }

    }

    let invoice: Awaited<ReturnType<typeof prisma.invoice.create>>;

    try {
      invoice = await prisma.$transaction(async (tx) => {
        if (caseId) {
          await assertCaseCanAcceptAmount(tx, {
            tenantId: auth.user!.tenantId,
            caseId,
            amount: totals.total,
            label: "الفاتورة",
          });
        }

        const invoiceNumber = await allocateInvoiceNumber(
          auth.user!.tenantId,
          tx,
        );

        return tx.invoice.create({
          data: {
            tenantId: auth.user!.tenantId,
            clientId: data.clientId,
            caseId,
            invoiceNumber,
            status: "UNPAID",
            dueDate,
            subtotal: totals.subtotal,
            tax: totals.tax,
            discount: totals.discount,
            total: totals.total,
            notes,
            items: {
              create: totals.items,
            },
          },
          include: {
            client: {
              select: {
                id: true,
                publicId: true,
                name: true,
                phone: true,
                email: true,
                archivedAt: true,
              },
            },
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
            payments: true,
          },
        });
      });
    } catch (error) {
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
      type: "INVOICE_CREATED",
      title: "تم إنشاء فاتورة جديدة",
      message: `${invoice.invoiceNumber} - ${client.name}`,
      entityType: caseId ? "CASE" : "INVOICE",
      entityId: caseId || invoice.id,
    });
    return ok(invoice, 201);
  });
}
