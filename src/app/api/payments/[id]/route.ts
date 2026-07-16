import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { paymentSchema } from "@/lib/validations";
import { ok, err, notFound } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { roundMoney, syncInvoiceStatus } from "@/lib/finance";
import {
  buildInvoiceAccessWhere,
  buildPaymentAccessWhere,
} from "@/lib/access-control";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعديل دفعة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = paymentSchema.partial().safeParse(body);

    if (!parsed.success) {
      return err("بيانات الدفعة غير صالحة", 400, parsed.error.flatten());
    }

    if (Object.keys(parsed.data).length === 0) {
      return err("لا توجد بيانات للتعديل", 400);
    }

    const { id } = await params;
    const tenantId = auth.user.tenantId;
    const meta = getRequestMeta(req);

    const transactionResult = await prisma.$transaction(async (tx) => {
      /*
       * قفل الدفعة لمنع تعديلها من طلبين متزامنين.
       */
      const lockedPayment = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Payment"
        WHERE "id" = ${id}
          AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      if (lockedPayment.length === 0) {
        return {
          ok: false as const,
          message: "الدفعة غير موجودة",
          status: 404,
        };
      }

      const existing = await tx.payment.findFirst({
        where: buildPaymentAccessWhere(auth.user!, { id }),
        select: {
          id: true,
          tenantId: true,
          clientId: true,
          caseId: true,
          invoiceId: true,
          amount: true,
          method: true,
          status: true,
          paidAt: true,
          reference: true,
          notes: true,
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
            },
          },
        },
      });

      if (!existing) {
        return {
          ok: false as const,
          message: "الدفعة غير موجودة",
          status: 404,
        };
      }

      /*
       * لا نسمح بنقل الدفعة إلى قضية أو فاتورة أخرى بعد تسجيلها.
       * تصحيح الرابط المالي يتم بإلغاء الدفعة وإنشاء سجل صحيح.
       */
      if (
        parsed.data.invoiceId !== undefined &&
        (parsed.data.invoiceId ?? null) !== existing.invoiceId
      ) {
        return {
          ok: false as const,
          message:
            "لا يمكن نقل الدفعة إلى فاتورة أخرى. ألغِ الدفعة وأنشئ دفعة جديدة بالرابط الصحيح.",
          status: 409,
        };
      }

      if (
        parsed.data.caseId !== undefined &&
        (parsed.data.caseId ?? null) !== existing.caseId
      ) {
        return {
          ok: false as const,
          message:
            "لا يمكن نقل الدفعة إلى قضية أخرى. ألغِ الدفعة وأنشئ دفعة جديدة بالرابط الصحيح.",
          status: 409,
        };
      }

      const nextStatus = parsed.data.status ?? existing.status;
      const nextAmount = roundMoney(
        parsed.data.amount !== undefined
          ? parsed.data.amount
          : Number(existing.amount),
      );

      const nextMethod = parsed.data.method ?? existing.method;

      const nextReference =
        parsed.data.reference !== undefined
          ? parsed.data.reference?.trim() || null
          : existing.reference;

      const nextNotes =
        parsed.data.notes !== undefined
          ? parsed.data.notes?.trim() || null
          : existing.notes;

      let nextPaidAt: Date | null = null;

      if (nextStatus === "PAID") {
        if (parsed.data.paidAt !== undefined) {
          if (!parsed.data.paidAt) {
            return {
              ok: false as const,
              message: "تاريخ الدفع مطلوب للدفعة المحصلة",
              status: 400,
            };
          }

          const parsedDate = new Date(parsed.data.paidAt);

          if (Number.isNaN(parsedDate.getTime())) {
            return {
              ok: false as const,
              message: "تاريخ الدفع غير صالح",
              status: 400,
            };
          }

          nextPaidAt = parsedDate;
        } else if (existing.status === "PAID" && existing.paidAt) {
          nextPaidAt = existing.paidAt;
        } else {
          nextPaidAt = new Date();
        }
      }

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
       * عند ارتباط الدفعة بفاتورة، نقفل الفاتورة أيضًا قبل احتساب الرصيد.
       */
      if (existing.invoiceId) {
        const lockedInvoice = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Invoice"
          WHERE "id" = ${existing.invoiceId}
            AND "tenantId" = ${tenantId}
          FOR UPDATE
        `;

        if (lockedInvoice.length === 0) {
          return {
            ok: false as const,
            message: "الفاتورة المرتبطة بالدفعة غير موجودة",
            status: 409,
          };
        }

        const invoice = await tx.invoice.findFirst({
          where: buildInvoiceAccessWhere(auth.user!, {
            id: existing.invoiceId,
          }),
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            payments: {
              where: {
                status: "PAID",
                id: {
                  not: existing.id,
                },
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
            message: "الفاتورة المرتبطة بالدفعة غير موجودة",
            status: 409,
          };
        }

        if (
          nextStatus === "PAID" &&
          (invoice.status === "DRAFT" || invoice.status === "CANCELLED")
        ) {
          return {
            ok: false as const,
            message:
              invoice.status === "DRAFT"
                ? "لا يمكن تحصيل دفعة على فاتورة مسودة"
                : "لا يمكن تحصيل دفعة على فاتورة ملغاة",
            status: 409,
          };
        }

        if (nextStatus === "PAID") {
          const otherPaidTotal = roundMoney(
            invoice.payments.reduce(
              (sum, payment) => sum + Number(payment.amount),
              0,
            ),
          );

          const invoiceTotal = roundMoney(Number(invoice.total));
          const availableBalance = roundMoney(
            Math.max(0, invoiceTotal - otherPaidTotal),
          );

          if (availableBalance <= 0.005) {
            return {
              ok: false as const,
              message:
                "الفاتورة مدفوعة بالكامل ولا يمكن تحويل هذه الدفعة إلى محصلة",
              status: 409,
              details: {
                invoiceTotal,
                otherPaidTotal,
                availableBalance,
              },
            };
          }

          if (nextAmount > availableBalance + 0.005) {
            return {
              ok: false as const,
              message: "قيمة الدفعة أكبر من الرصيد المتاح على الفاتورة",
              status: 409,
              details: {
                invoiceTotal,
                otherPaidTotal,
                availableBalance,
                requestedAmount: nextAmount,
              },
            };
          }
        }
      }

      const updated = await tx.payment.update({
        where: {
          id: existing.id,
        },
        data: {
          amount: nextAmount,
          method: nextMethod,
          status: nextStatus,
          paidAt: nextPaidAt,
          reference: nextReference,
          notes: nextNotes,
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

      if (existing.invoiceId) {
        invoiceSummary = await syncInvoiceStatus(tx, {
          tenantId,
          invoiceId: existing.invoiceId,
        });
      }

      return {
        ok: true as const,
        existing,
        updated,
        invoiceSummary,
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

    const entityType = transactionResult.updated.invoiceId
      ? "INVOICE"
      : transactionResult.updated.caseId
        ? "CASE"
        : "CLIENT";

    const entityId =
      transactionResult.updated.invoiceId ??
      transactionResult.updated.caseId ??
      transactionResult.updated.clientId;

    await logActivity({
      tenantId,
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      type: "PAYMENT_UPDATED",
      title:
        transactionResult.existing.status !== transactionResult.updated.status
          ? "تم تغيير حالة دفعة"
          : "تم تعديل دفعة",
      message: `${transactionResult.existing.status} → ${transactionResult.updated.status} | ${transactionResult.updated.amount}`,
      entityType,
      entityId,
    });

    return ok({
      ...transactionResult.updated,
      invoiceSummary: transactionResult.invoiceSummary ?? null,
    });
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "حذف دفعة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const { id } = await params;
    const tenantId = auth.user.tenantId;
    const meta = getRequestMeta(req);

    const transactionResult = await prisma.$transaction(async (tx) => {
      const lockedPayment = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Payment"
        WHERE "id" = ${id}
          AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      if (lockedPayment.length === 0) {
        return {
          ok: false as const,
          message: "الدفعة غير موجودة",
          status: 404,
        };
      }

      const existing = await tx.payment.findFirst({
        where: buildPaymentAccessWhere(auth.user!, { id }),
        select: {
          id: true,
          clientId: true,
          caseId: true,
          invoiceId: true,
          amount: true,
          status: true,
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
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
        },
      });

      if (!existing) {
        return {
          ok: false as const,
          message: "الدفعة غير موجودة",
          status: 404,
        };
      }

      if (existing.client.archivedAt) {
        return {
          ok: false as const,
          message: "لا يمكن حذف دفعة مرتبطة بموكل مؤرشف",
          status: 409,
        };
      }

      /*
       * الدفعات المحصلة لا تُحذف نهائيًا حفاظًا على أثر التدقيق.
       * يتم إلغاؤها من خلال PATCH بالحالة CANCELLED.
       */
      if (existing.status === "PAID") {
        return {
          ok: false as const,
          message:
            "لا يمكن حذف دفعة محصلة نهائيًا. غيّر حالتها إلى ملغاة للحفاظ على السجل المالي.",
          status: 409,
          details: {
            paymentId: existing.id,
            requiredStatus: "CANCELLED",
          },
        };
      }

      if (existing.invoiceId) {
        const lockedInvoice = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Invoice"
          WHERE "id" = ${existing.invoiceId}
            AND "tenantId" = ${tenantId}
          FOR UPDATE
        `;

        if (lockedInvoice.length === 0) {
          return {
            ok: false as const,
            message: "الفاتورة المرتبطة بالدفعة غير موجودة",
            status: 409,
          };
        }
      }

      await tx.payment.delete({
        where: {
          id: existing.id,
        },
      });

      const invoiceSummary = existing.invoiceId
        ? await syncInvoiceStatus(tx, {
            tenantId,
            invoiceId: existing.invoiceId,
          })
        : null;

      return {
        ok: true as const,
        existing,
        invoiceSummary,
      };
    });

    if (!transactionResult.ok) {
      if (transactionResult.status === 404) {
        return notFound(transactionResult.message);
      }

      return err(
        transactionResult.message,
        transactionResult.status,
        "details" in transactionResult
          ? transactionResult.details
          : undefined,
      );
    }

    const entityType = transactionResult.existing.invoiceId
      ? "INVOICE"
      : transactionResult.existing.caseId
        ? "CASE"
        : "CLIENT";

    const entityId =
      transactionResult.existing.invoiceId ??
      transactionResult.existing.caseId ??
      transactionResult.existing.clientId;

    await logActivity({
      tenantId,
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      type: "PAYMENT_DELETED",
      title: "تم حذف دفعة غير محصلة",
      message: String(transactionResult.existing.amount),
      entityType,
      entityId,
    });

    return ok({
      deleted: true,
      invoiceSummary: transactionResult.invoiceSummary,
    });
  });
}
