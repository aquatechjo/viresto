import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requirePermission, getRequestMeta } from "@/lib/api-auth";
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
import {
  invoiceStatusWhere,
  roundMoney,
  withInvoiceState,
} from "@/lib/finance";
import { calculateInvoiceTotals } from "@/lib/invoice-totals";
import {
  OUTSTANDING_INVOICE_STATUSES,
  summarizeInvoiceStats,
} from "@/lib/invoice-stats";
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

// Filter value, not a stored status: what is still to collect. The same
// statuses as the "unpaid" figure below.
const OUTSTANDING = "OUTSTANDING";
const outstandingStatuses = OUTSTANDING_INVOICE_STATUSES;

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
    const auth = await requirePermission(req, "finance.read");
    if (auth.error || !auth.user) return auth.error;

    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") || "";
    const q = sp.get("q")?.trim().slice(0, 100) || "";
    const options = sp.get("options")?.trim().toLowerCase() || "";
    const includeStats = sp.get("includeStats") !== "false";
    const clientId = sp.get("clientId")?.trim() || "";
    const archivedOnly = sp.get("archivedOnly") === "true";
    const pageRaw = Number(sp.get("page") || 1);
    const page = Number.isNaN(pageRaw) ? 1 : Math.max(Math.floor(pageRaw), 1);

    const limitRaw = Number(sp.get("limit") || 20);
    const limit = Number.isNaN(limitRaw)
      ? 20
      : Math.min(Math.max(limitRaw, 1), 100);

    if (status && status !== OUTSTANDING && !allowedStatuses.includes(status as any)) {
      return err("حالة الفاتورة غير صالحة", 400);
    }

    if (options && options !== "client" && options !== "case") {
      return err("نوع خيارات الفاتورة غير صالح", 400);
    }

    if (options === "client") {
      const clients = await prisma.client.findMany({
        where: buildClientAccessWhere(auth.user, {
          ...(q
            ? {
                name: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              }
            : {}),
        }),
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
        select: {
          id: true,
          name: true,
          archivedAt: true,
        },
      });

      return ok(clients);
    }

    if (options === "case") {
      if (!clientId) {
        return err("الموكل مطلوب لتحميل خيارات القضايا", 400);
      }

      const cases = await prisma.case.findMany({
        where: buildCaseAccessWhere(auth.user, {
          clientId,
          ...(q
            ? {
                OR: [
                  {
                    title: {
                      contains: q,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    caseNumber: {
                      contains: q,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        }),
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
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
      });

      return ok(cases);
    }

    const now = new Date();
    const where = buildInvoiceAccessWhere(auth.user, {
        // OVERDUE is computed from the due date, never stored (finance.ts).
        AND: [
          status === OUTSTANDING
            ? { status: { in: [...outstandingStatuses] } }
            : invoiceStatusWhere(status, now),
        ],
        ...(archivedOnly
          ? {
              OR: [
                { client: { archivedAt: { not: null } } },
                { case: { client: { archivedAt: { not: null } } } },
              ],
            }
          : {}),
      });
    const statsWhere = buildInvoiceAccessWhere(auth.user);

    const invoicesQuery = prisma.invoice.findMany({
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
    });
    const totalQuery = prisma.invoice.count({ where });

    if (!includeStats) {
      const [invoices, total] = await prisma.$transaction([
        invoicesQuery,
        totalQuery,
      ]);

      const decryptedInvoices = invoices.map((invoice) => ({
        ...withInvoiceState(invoice, now),
        client: invoice.client
          ? {
              ...invoice.client,
              phone: decryptText(invoice.client.phone),
              email: decryptText(invoice.client.email),
            }
          : invoice.client,
      }));

      return ok({
        items: decryptedInvoices,
        pagination: {
          page,
          pageSize: limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        stats: null,
      });
    }

    const [invoices, total, statRows] = await prisma.$transaction([
      invoicesQuery,
      totalQuery,
      prisma.invoice.findMany({
        where: statsWhere,
        select: {
          total: true,
          status: true,
          dueDate: true,
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
      ...withInvoiceState(invoice, now),
      client: invoice.client
        ? {
            ...invoice.client,
            phone: decryptText(invoice.client.phone),
            email: decryptText(invoice.client.email),
          }
        : invoice.client,
    }));

    const stats = summarizeInvoiceStats(statRows, now);

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

    const auth = await requirePermission(req, "invoice.create");
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
    const totals = calculateInvoiceTotals(data.items, data.tax, data.discount);

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

        const created = await tx.invoice.create({
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

        await logActivity(
          {
            actorId: auth.user!.userId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            tenantId: auth.user!.tenantId,
            type: "INVOICE_CREATED",
            title: "تم إنشاء فاتورة جديدة",
            message: `${created.invoiceNumber} - ${client.name}`,
            entityType: caseId ? "CASE" : "INVOICE",
            entityId: caseId || created.id,
          },
          tx,
        );

        return created;
      });
    } catch (error) {
      if (isCaseFinancialLimitError(error)) {
        return err(error.message, error.status, error.details);
      }

      throw error;
    }

    return ok(withInvoiceState(invoice), 201);
  });
}
