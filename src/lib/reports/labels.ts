// Arabic labels and badge tones for every status a report prints. Typed by
// the Prisma enums, so a new enum value fails to compile until it has a
// label: a report never prints a raw value such as "OPEN". The wording
// matches the app's pages; the tones come from theme/status.ts.

import type {
  AppointmentStatus,
  AppointmentType,
  CaseStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";
import { statusTone, type StatusKind, type StatusTone } from "@/lib/theme/status";

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  OPEN: "نشطة",
  IN_PROGRESS: "قيد المتابعة",
  CLOSED: "مغلقة",
  ARCHIVED: "مؤرشفة",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: "مدفوعة",
  PENDING: "معلقة",
  OVERDUE: "متأخرة",
  CANCELLED: "ملغاة",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "نقدي",
  BANK_TRANSFER: "تحويل بنكي",
  CHECK: "شيك",
  ONLINE: "إلكتروني",
};

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  COURT_SESSION: "جلسة",
  MEETING: "اجتماع",
  PHONE_CALL: "اتصال",
  DEADLINE: "موعد نهائي",
  OTHER: "أخرى",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "مجدول",
  COMPLETED: "تم",
  CANCELLED: "ملغى",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "مسودة",
  UNPAID: "غير مدفوعة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
  PAID: "مدفوعة",
  OVERDUE: "متأخرة",
  CANCELLED: "ملغاة",
};

const LABELS = {
  case: CASE_STATUS_LABELS,
  payment: PAYMENT_STATUS_LABELS,
  appointment: APPOINTMENT_STATUS_LABELS,
  invoice: INVOICE_STATUS_LABELS,
} satisfies Partial<Record<StatusKind, Record<string, string>>>;

export type ReportStatusKind = keyof typeof LABELS;

/** Label of an unknown or missing value: never the raw value. */
export const UNKNOWN_LABEL = "غير محدد";

function lookup(labels: Record<string, string>, value: string | null | undefined): string {
  return (value && labels[value]) || UNKNOWN_LABEL;
}

/** The label and badge tone of a status. */
export function reportStatus(
  kind: ReportStatusKind,
  value: string | null | undefined,
): { label: string; tone: StatusTone } {
  return { label: lookup(LABELS[kind], value), tone: statusTone(kind, value) };
}

export function paymentMethodLabel(value: string | null | undefined): string {
  return lookup(PAYMENT_METHOD_LABELS, value);
}

export function appointmentTypeLabel(value: string | null | undefined): string {
  return lookup(APPOINTMENT_TYPE_LABELS, value);
}
