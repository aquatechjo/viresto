import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { paymentSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { roundMoney, syncInvoiceStatus } from "@/lib/finance";
import { moneyExceeds, moneyIsSettled } from "@/lib/money";
import {
  buildCaseAccessWhere,
  buildInvoiceAccessWhere,
  buildPaymentAccessWhere,
} from "@/lib/access-control";
import {
  assertCaseCanAcceptAmount,
  isCaseFinancialLimitError,
} from "@/lib/server/case-finance-integrity";

const allowedStatuses = [
  "PENDING",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const sp = new URL(req.url).searchParams;

    const caseId = sp.get("caseId");
    const clientId = sp.get("clientId");
    const invoiceId = sp.get("invoiceId");
    const status = sp.get("status");
    const q = sp.get("q")?.trim() || "";
    const pageRaw = Number(sp.get("page") || 1);
    const page = Number.isNaN(pageRaw) ? 1 : Math.max(Math.floor(pageRaw), 1);

    const limitRaw = Number(sp.get("limit") || 20);
    const limit = Number.isNaN(limitRaw)
      ? 20
      : Math.min(Math.max(limitRaw, 1), 100);

    if (status && !allowedStatuses.includes(status as any)) {
      return err("حالة الدفعة غير صالحة", 400);
    }

    const where = buildPaymentAccessWhere(auth.user, {
        ...(caseId ? { caseId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(invoiceId ? { invoiceId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(q
          ? {
              OR: [
                { reference: { contains: q, mode: "insensitive" as const } },
                { client: { name: { contains: q, mode: "insensitive" as const } } },
                { case: { title: { contains: q, mode: "insensitive" as const } } },
                { case: { caseNumber: { contains: q, mode: "insensitive" as const } } },
                { invoice: { invoiceNumber: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      });

    const [payments, total, grouped, direct] = await prisma.$transaction([
      prisma.payment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            title: true,
            caseNumber: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            dueDate: true,
          },
        },
      },
      orderBy: [
        {
          paidAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      skip: (page - 1) * limit,
      take: limit,
      }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({
        by: ["status"],
        where,
        orderBy: { status: "asc" },
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: { AND: [where, { invoiceId: null }] } }),
    ]);

    const amountByStatus = Object.fromEntries(
      grouped.map((item) => [item.status, Number(item._sum?.amount || 0)]),
    );

    return ok({
      items: payments,
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        collected: amountByStatus.PAID || 0,
        pending: amountByStatus.PENDING || 0,
        overdue: amountByStatus.OVERDUE || 0,
        direct,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تسجيل دفعة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = paymentSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات الدفعة غير صالحة", 400, parsed.error.flatten());
    }

    const tenantId = auth.user.tenantId;
    const meta = getRequestMeta(req);

    const requestedCaseId = parsed.data.caseId ?? null;
    const requestedInvoiceId = parsed.data.invoiceId ?? null;
    const paymentStatus = parsed.data.status ?? "PAID";

    if (paymentStatus === "CANCELLED") {
      return err(
        "لا يمكن إنشاء دفعة ملغاة. أنشئ دفعة معلقة أو محصلة ثم استخدم مسار الإلغاء الموثق عند الحاجة.",
        400,
      );
    }

    if (!requestedCaseId && !requestedInvoiceId) {
      return err(
        "يجب ربط الدفعة بفاتورة أو قضية على الأقل",
        400,
      );
    }

    let paidAt: Date | null = null;

    if (paymentStatus === "PAID") {
      if (parsed.data.paidAt) {
        const date = new Date(parsed.data.paidAt);

        if (Number.isNaN(date.getTime())) {
          return err("تاريخ الدفع غير صالح", 400);
        }

        paidAt = date;
      } else {
        paidAt = new Date();
      }
    }

    const createPayment = () => prisma.$transaction(async (tx) => {
      let clientId: string;
      let caseId: string | null = requestedCaseId;
      const invoiceId: string | null = requestedInvoiceId;

      let caseTitle: string | null = null;
      let invoiceNumber: string | null = null;
      let invoiceSummary:
        | {
            invoiceId: string;
            previousStatus: string;
            status: string;
            total: number;
            paidTotal: number;
            remaining: number;
          }
        | undefined;

      /*
       * عند وجود فاتورة، نقفل سجلها أثناء احتساب الرصيد.
       * هذا يمنع تسجيل دفعتين متزامنتين تتجاوزان قيمة الفاتورة.
       */
      if (invoiceId) {
        const lockedInvoice = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Invoice"
          WHERE "id" = ${invoiceId}
            AND "tenantId" = ${tenantId}
          FOR UPDATE
        `;

        if (lockedInvoice.length === 0) {
          return {
            ok: false as const,
            message: "الفاتورة غير موجودة داخل هذا المكتب",
            status: 404,
          };
        }

        const invoice = await tx.invoice.findFirst({
          where: buildInvoiceAccessWhere(auth.user!, { id: invoiceId }),
          select: {
            id: true,
            invoiceNumber: true,
            clientId: true,
            caseId: true,
            status: true,
            total: true,
            client: {
              select: {
                id: true,
                archivedAt: true,
              },
            },
            case: {
              select: {
                id: true,
                title: true,
                clientId: true,
              },
            },
            payments: {
              where: {
                status: "PAID",
              },
              select: {
                amount: true,
              },
            },
          },
        });

        if (!invoice) {
          return {
            ok: false as const,
            message: "الفاتورة غير موجودة داخل هذا المكتب",
            status: 404,
          };
        }

        if (invoice.status === "DRAFT") {
          return {
            ok: false as const,
            message: "لا يمكن تسجيل دفعة على فاتورة مسودة",
            status: 409,
          };
        }

        if (invoice.status === "CANCELLED") {
          return {
            ok: false as const,
            message: "لا يمكن تسجيل دفعة على فاتورة ملغاة",
            status: 409,
          };
        }

        clientId = invoice.clientId;
        invoiceNumber = invoice.invoiceNumber;

        if (
          invoice.caseId &&
          requestedCaseId &&
          invoice.caseId !== requestedCaseId
        ) {
          return {
            ok: false as const,
            message: "القضية المحددة لا تطابق قضية الفاتورة",
            status: 409,
          };
        }

        if (invoice.caseId) {
          caseId = invoice.caseId;
          caseTitle = invoice.case?.title ?? null;
        } else if (requestedCaseId) {
          const selectedCase = await tx.case.findFirst({
            where: buildCaseAccessWhere(auth.user!, {
              id: requestedCaseId,
              clientId: invoice.clientId,
            }),
            select: {
              id: true,
              title: true,
            },
          });

          if (!selectedCase) {
            return {
              ok: false as const,
              message: "القضية لا تتبع موكل الفاتورة أو لا تتبع هذا المكتب",
              status: 409,
            };
          }

          caseId = selectedCase.id;
          caseTitle = selectedCase.title;
        }

        if (paymentStatus === "PAID") {
          const paidTotal = roundMoney(
            invoice.payments.reduce(
              (sum, payment) => sum + Number(payment.amount),
              0,
            ),
          );

          const invoiceTotal = roundMoney(Number(invoice.total));
          const remaining = roundMoney(
            Math.max(0, invoiceTotal - paidTotal),
          );

          if (moneyIsSettled(remaining)) {
            return {
              ok: false as const,
              message: "الفاتورة مدفوعة بالكامل ولا تقبل دفعة إضافية",
              status: 409,
              details: {
                invoiceTotal,
                paidTotal,
                remaining,
              },
            };
          }

          if (moneyExceeds(parsed.data.amount, remaining)) {
            return {
              ok: false as const,
              message: "قيمة الدفعة أكبر من الرصيد المتبقي على الفاتورة",
              status: 409,
              details: {
                invoiceTotal,
                paidTotal,
                remaining,
                requestedAmount: roundMoney(parsed.data.amount),
              },
            };
          }
        }
      } else {
        const selectedCase = await tx.case.findFirst({
          where: buildCaseAccessWhere(auth.user!, {
            id: requestedCaseId!,
          }),
          select: {
            id: true,
            title: true,
            clientId: true,
            client: {
              select: {
                id: true,
                archivedAt: true,
              },
            },
          },
        });

        if (!selectedCase) {
          return {
            ok: false as const,
            message: "القضية غير موجودة داخل هذا المكتب",
            status: 404,
          };
        }

        clientId = selectedCase.clientId;
        caseId = selectedCase.id;
        caseTitle = selectedCase.title;

        if (paymentStatus === "PAID") {
          await assertCaseCanAcceptAmount(tx, {
            tenantId,
            caseId: selectedCase.id,
            amount: parsed.data.amount,
            label: "الدفعة",
          });
        }
      }

      const payment = await tx.payment.create({
        data: {
          tenantId,
          clientId,
          caseId,
          invoiceId,
          amount: roundMoney(parsed.data.amount),
          method: parsed.data.method ?? "CASH",
          status: paymentStatus,
          paidAt,
          reference: parsed.data.reference?.trim() || null,
          notes: parsed.data.notes?.trim() || null,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              archivedAt: true,
            },
          },
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              total: true,
              dueDate: true,
            },
          },
        },
      });

      if (invoiceId) {
        invoiceSummary = await syncInvoiceStatus(tx, {
          tenantId,
          invoiceId,
        });
      }

      return {
        ok: true as const,
        payment,
        invoiceSummary,
        caseTitle,
        invoiceNumber,
      };
    });

    let transactionResult: Awaited<ReturnType<typeof createPayment>>;

    try {
      transactionResult = await createPayment();
    } catch (error) {
      if (isCaseFinancialLimitError(error)) {
        return err(error.message, error.status, error.details);
      }

      throw error;
    }

    if (!transactionResult.ok) {
      return err(
        transactionResult.message,
        transactionResult.status,
        "details" in transactionResult
          ? transactionResult.details
          : undefined,
      );
    }

    const activityEntityType = transactionResult.payment.invoiceId
      ? "INVOICE"
      : transactionResult.payment.caseId
        ? "CASE"
        : "CLIENT";

    const activityEntityId =
      transactionResult.payment.invoiceId ??
      transactionResult.payment.caseId ??
      transactionResult.payment.clientId;

    const contextTitle =
      transactionResult.invoiceNumber ??
      transactionResult.caseTitle ??
      transactionResult.payment.client.name;

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId,
      type: "PAYMENT_CREATED",
      title: transactionResult.payment.client.archivedAt
        ? "تم تسجيل دفعة لموكل مؤرشف"
        : "تم تسجيل دفعة جديدة",
      message: `${transactionResult.payment.amount} - ${contextTitle}`,
      entityType: activityEntityType,
      entityId: activityEntityId,
    });

    return ok(
      {
        ...transactionResult.payment,
        invoiceSummary: transactionResult.invoiceSummary ?? null,
      },
      201,
    );
  });
}
