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

    const limitRaw = Number(sp.get("limit") || 50);
    const limit = Number.isNaN(limitRaw)
      ? 50
      : Math.min(Math.max(limitRaw, 1), 100);

    if (status && !allowedStatuses.includes(status as any)) {
      return err("حالة الدفعة غير صالحة", 400);
    }

    const payments = await prisma.payment.findMany({
      where: {
        tenantId: auth.user.tenantId,
        ...(caseId ? { caseId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(invoiceId ? { invoiceId } : {}),
        ...(status ? { status: status as any } : {}),
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
      orderBy: [
        {
          paidAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: limit,
    });

    return ok(payments);
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

    const transactionResult = await prisma.$transaction(async (tx) => {
      let clientId: string;
      let caseId: string | null = requestedCaseId;
      let invoiceId: string | null = requestedInvoiceId;

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
          where: {
            id: invoiceId,
            tenantId,
          },
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
            where: {
              id: requestedCaseId,
              tenantId,
              clientId: invoice.clientId,
            },
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

          if (remaining <= 0.005) {
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

          if (roundMoney(parsed.data.amount) > remaining + 0.005) {
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
          where: {
            id: requestedCaseId!,
            tenantId,
          },
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
