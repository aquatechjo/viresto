// What may happen to an invoice, by its stored status (finance plan,
// batch 5, decisions of 2026-11-06). Used by the invoice routes and by the
// invoice page, so the buttons shown match what the server accepts.
//
// - A draft is the only invoice that may be deleted. It is issued
//   (DRAFT -> UNPAID) and never comes back to draft.
// - An issued invoice is cancelled, never deleted: by whoever holds
//   invoice.cancel (the office admin), with a reason. Cancelling is final.
// - A cancelled invoice cannot be edited, issued again or deleted.

import { hasPermission, type UserRole } from "@/lib/permissions";

export const INVOICE_CANCEL_REASON_MIN = 5;
export const INVOICE_CANCEL_REASON_MAX = 500;

export const INVOICE_MESSAGES = {
  cancelledLocked: "الفاتورة ملغاة نهائيًا، ولا يمكن تعديلها أو إرجاعها.",
  alreadyCancelled: "الفاتورة ملغاة مسبقًا.",
  draftNotCancelled: "المسودة لا تُلغى، بل تُحذف. الإلغاء للفاتورة الصادرة.",
  pendingPayments:
    "لا يمكن إلغاء فاتورة عليها دفعات معلّقة. ألغِ الدفعات المعلّقة أو حصّلها أولًا.",
  collectedPayments:
    "لا يمكن إلغاء فاتورة عليها دفعات محصّلة. ألغِ الدفعات المحصّلة أولًا.",
  reasonRequired: `سبب الإلغاء مطلوب (${INVOICE_CANCEL_REASON_MIN} أحرف على الأقل).`,
  reasonTooLong: `سبب الإلغاء طويل جدًا (${INVOICE_CANCEL_REASON_MAX} حرف كحد أقصى).`,
  deleteDraftOnly:
    "لا تُحذف إلا المسودة. الفاتورة الصادرة تُلغى من مدير المكتب مع ذكر السبب.",
  useCancel: "إلغاء الفاتورة يتم من زر الإلغاء مع ذكر السبب، لا بتغيير الحالة.",
  noBackToDraft: "لا يمكن إرجاع فاتورة صادرة إلى مسودة.",
  archivedClientCreate: "لا يمكن إنشاء فاتورة جديدة لموكل مؤرشف.",
  archivedClientIssue: "لا يمكن إصدار فاتورة لموكل مؤرشف.",
} as const;

type PaymentLike = { status: string; amount?: unknown };

/** Payments still waiting to be collected. */
export function hasPendingPayments(payments: readonly PaymentLike[] | undefined) {
  return (payments ?? []).some(
    (payment) => payment.status === "PENDING" || payment.status === "OVERDUE",
  );
}

export function hasCollectedPayments(payments: readonly PaymentLike[] | undefined) {
  return (payments ?? []).some(
    (payment) => payment.status === "PAID" && Number(payment.amount ?? 1) > 0,
  );
}

/** Why this invoice cannot be cancelled, or null when it can. */
export function invoiceCancelBlock(invoice: {
  status: string;
  payments?: readonly PaymentLike[];
}): string | null {
  if (invoice.status === "CANCELLED") return INVOICE_MESSAGES.alreadyCancelled;
  if (invoice.status === "DRAFT") return INVOICE_MESSAGES.draftNotCancelled;
  if (hasPendingPayments(invoice.payments)) return INVOICE_MESSAGES.pendingPayments;
  if (hasCollectedPayments(invoice.payments)) return INVOICE_MESSAGES.collectedPayments;
  return null;
}

/** The trimmed reason, or the message saying why it is refused. */
export function parseCancelReason(
  value: unknown,
): { ok: true; reason: string } | { ok: false; message: string } {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < INVOICE_CANCEL_REASON_MIN) {
    return { ok: false, message: INVOICE_MESSAGES.reasonRequired };
  }
  if (reason.length > INVOICE_CANCEL_REASON_MAX) {
    return { ok: false, message: INVOICE_MESSAGES.reasonTooLong };
  }
  return { ok: true, reason };
}

/** Why this invoice cannot be deleted, or null when it can. */
export function invoiceDeleteBlock(invoice: {
  status: string;
  payments?: readonly unknown[];
}): string | null {
  if (invoice.status !== "DRAFT") return INVOICE_MESSAGES.deleteDraftOnly;
  return null;
}

/**
 * Why a status change asked through an edit is refused, or null.
 * The only change an edit may make is issuing a draft (DRAFT -> UNPAID);
 * "paid" comes from payments, "overdue" from the due date, and cancelling
 * has its own route.
 */
export function invoiceStatusChangeBlock(current: string, next: string): string | null {
  if (current === next) return null;
  if (current === "CANCELLED") return INVOICE_MESSAGES.cancelledLocked;
  if (next === "CANCELLED") return INVOICE_MESSAGES.useCancel;
  if (next === "DRAFT") return INVOICE_MESSAGES.noBackToDraft;
  if (current === "DRAFT" && next === "UNPAID") return null;
  return "لا يمكن تغيير حالة الفاتورة يدويًا. الحالة تُحسب من الدفعات وتاريخ الاستحقاق.";
}

export function canEditInvoice(status: string) {
  return status !== "CANCELLED";
}

/**
 * The invoice page's actions for a role and a stored status: the buttons
 * shown are exactly what the server accepts.
 */
export function invoicePageActions(
  role: UserRole | null | undefined,
  status: string,
) {
  const can = (permission: Parameters<typeof hasPermission>[1]) =>
    role ? hasPermission(role, permission) : false;
  const isDraft = status === "DRAFT";
  const isCancelled = status === "CANCELLED";
  return {
    issue: isDraft && can("invoice.update"),
    cancel: !isDraft && !isCancelled && can("invoice.cancel"),
    delete: isDraft && can("invoice.delete"),
    edit: !isCancelled && can("invoice.update"),
  };
}
