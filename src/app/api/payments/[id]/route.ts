import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { paymentUpdateSchema } from "@/lib/validations";
import { ok, err, notFound } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { roundMoney, syncInvoiceStatus } from "@/lib/finance";
import { moneyExceeds, moneyIsSettled } from "@/lib/money";
import {
  canTransitionPayment,
  isPaymentFinanciallyLocked,
  requiresPaymentCancellationReason,
} from "@/lib/financial-audit";
import {
  buildInvoiceAccessWhere,
  buildPaymentAccessWhere,
} from "@/lib/access-control";
import {
  assertCaseCanAcceptAmount,
  isCaseFinancialLimitError,
} from "@/lib/server/case-finance-integrity";

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
    const parsed = paymentUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات الدفعة غير صالحة", 400, parsed.error.flatten());
    }

    if (Object.keys(parsed.data).length === 0) {
      return err("لا توجد بيانات للتعديل", 400);
    }

    const { id } = await params;
    const tenantId = auth.user.tenantId;
    const meta = getRequestMeta(req);

    const updatePayment = () => prisma.$transaction(async (tx) => {
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
          cancelledAt: true,
          cancelledById: true,
          cancellationReason: true,
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

      if (!canTransitionPayment(existing.status, nextStatus)) {
        return {
          ok: false as const,
          message:
            existing.status === "CANCELLED"
              ? "الدفعة الملغاة سجل نهائي ولا يمكن إعادة فتحها"
              : "لا يمكن إعادة الدفعة المحصلة إلى معلقة أو متأخرة. يمكن إلغاؤها مع تسجيل السبب فقط.",
          status: 409,
        };
      }

      if (existing.status === "CANCELLED") {
        return {
          ok: false as const,
          message: "الدفعة الملغاة سجل نهائي ولا يمكن تعديلها",
          status: 409,
        };
      }

      const cancellationReason = parsed.data.cancellationReason?.trim();

      if (
        requiresPaymentCancellationReason(existing.status, nextStatus) &&
        !cancellationReason
      ) {
        return {
          ok: false as const,
          message: "سبب الإلغاء مطلوب للحفاظ على أثر التدقيق المالي",
          status: 400,
        };
      }

      if (cancellationReason && nextStatus !== "CANCELLED") {
        return {
          ok: false as const,
          message: "سبب الإلغاء يقبل فقط عند تحويل الدفعة إلى ملغاة",
          status: 400,
        };
      }

      if (
        existing.status === "PAID" &&
        nextStatus === "CANCELLED" &&
        auth.user!.role !== "ADMIN"
      ) {
        return {
          ok: false as const,
          message: "إلغاء دفعة محصلة يتطلب صلاحية مدير المكتب",
          status: 403,
        };
      }

      const hasFinancialFieldChanges =
        parsed.data.amount !== undefined ||
        parsed.data.method !== undefined ||
        parsed.data.paidAt !== undefined;

      if (
        hasFinancialFieldChanges &&
        (isPaymentFinanciallyLocked(existing.status) ||
          nextStatus === "CANCELLED")
      ) {
        return {
          ok: false as const,
          message:
            "لا يمكن تعديل المبلغ أو الطريقة أو تاريخ التحصيل لدفعة محصلة أو أثناء إلغائها",
          status: 409,
        };
      }

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

      let nextPaidAt: Date | null =
        nextStatus === "CANCELLED" && existing.status === "PAID"
          ? existing.paidAt
          : null;

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

          if (moneyIsSettled(availableBalance)) {
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

          if (moneyExceeds(nextAmount, availableBalance)) {
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
      } else if (existing.caseId && nextStatus === "PAID") {
        await assertCaseCanAcceptAmount(tx, {
          tenantId,
          caseId: existing.caseId,
          excludeDirectPaymentId: existing.id,
          amount: nextAmount,
          label: "الدفعة",
        });
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
          ...(nextStatus === "CANCELLED"
            ? {
                cancelledAt: new Date(),
                cancelledById: auth.user!.userId,
                cancellationReason,
              }
            : {}),
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
          cancelledBy: {
            select: {
              id: true,
              name: true,
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

    let transactionResult: Awaited<ReturnType<typeof updatePayment>>;

    try {
      transactionResult = await updatePayment();
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
        transactionResult.updated.status === "CANCELLED"
          ? "تم إلغاء دفعة"
          : transactionResult.existing.status !== transactionResult.updated.status
            ? "تم تغيير حالة دفعة"
            : "تم تعديل دفعة",
      message: `${transactionResult.existing.status} → ${transactionResult.updated.status} | ${transactionResult.updated.amount}${transactionResult.updated.cancellationReason ? ` | ${transactionResult.updated.cancellationReason}` : ""}`,
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
      if (existing.status === "PAID" || existing.status === "CANCELLED") {
        return {
          ok: false as const,
          message:
            "لا يمكن حذف دفعة محصلة أو ملغاة نهائيًا. استخدم الإلغاء الموثق للدفعة المحصلة ليبقى السجل المالي محفوظًا.",
          status: 409,
          details: {
            paymentId: existing.id,
            currentStatus: existing.status,
            deletableStatuses: ["PENDING", "OVERDUE"],
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
