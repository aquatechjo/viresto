"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import AppLoader from "@/components/ui/AppLoader";
import { useLocale } from "@/lib/useLocale";
import type { Locale } from "@/lib/i18n";
import {
  buildInvoiceWhatsAppMessage,
  formatInvoiceNumber,
  normalizeWhatsAppPhone,
  printInvoiceDocument,
  safeInvoiceFilename,
} from "@/lib/invoice-print";

type InvoiceStatus =
  | "DRAFT"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

type EditItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

interface InvoicePayment {
  id: string;
  amount: number;
  status: string;
  method: string;
  paidAt?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdAt?: string;
}

interface Invoice {
  id: string;
  publicId?: number;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate?: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string | null;
  client: {
    id: string;
    publicId?: number;
    name: string;
    phone?: string | null;
    whatsapp?: string | null;
    whatsappNumber?: string | null;
    mobile?: string | null;
    email?: string | null;
    archivedAt?: string | null;
  };
  case?: {
    id: string;
    publicId?: number;
    title: string;
    caseNumber?: string | null;
    client?: {
      id?: string;
      publicId?: number;
      name?: string;
      archivedAt?: string | null;
    } | null;
  } | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  payments: InvoicePayment[];

  tenant?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
  } | null;
}

const STATUS_LABELS: Record<Locale, Record<InvoiceStatus, string>> = {
  ar: {
    DRAFT: "مسودة",
    UNPAID: "غير مدفوعة",
    PAID: "مدفوعة",
    OVERDUE: "متأخرة",
    CANCELLED: "ملغاة",
    PARTIALLY_PAID: "مدفوعة جزئيًا",
  },
  en: {
    DRAFT: "Draft",
    UNPAID: "Unpaid",
    PAID: "Paid",
    OVERDUE: "Overdue",
    CANCELLED: "Cancelled",
    PARTIALLY_PAID: "Partially paid",
  },
};

const statusClasses: Record<InvoiceStatus, string> = {
  DRAFT: "badge badge-gray",
  UNPAID: "badge badge-amber",
  PAID: "badge badge-green",
  OVERDUE: "badge badge-red",
  CANCELLED: "badge badge-gray",
  PARTIALLY_PAID: "badge badge-blue",
};

const statusStyles: Record<
  InvoiceStatus,
  { background: string; color: string; border: string }
> = {
  DRAFT: {
    background: "#e2e8f0",
    color: "#334155",
    border: "1px solid #cbd5e1",
  },
  UNPAID: {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
  },
  PAID: {
    background: "#d1fae5",
    color: "#065f46",
    border: "1px solid #a7f3d0",
  },
  OVERDUE: {
    background: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },
  CANCELLED: {
    background: "#e5e7eb",
    color: "#374151",
    border: "1px solid #d1d5db",
  },
  PARTIALLY_PAID: {
    background: "#dbeafe",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },
};

const INVOICE_DETAILS_COPY = {
  ar: {
    confirm: "تأكيد",
    notFoundTitle: "الفاتورة غير موجودة",
    notFoundText:
      "تعذر العثور على الفاتورة المطلوبة، أو أنها حُذفت، أو أن الرابط غير صحيح.",
    backToInvoices: "← رجوع للفواتير",
    detailsBadge: "تفاصيل الفاتورة",
    invoiceTitle: (number: string) => `فاتورة ${number}`,
    detailsSubtitle:
      "عرض بيانات الفاتورة، البنود، الموكل، القضية، الدفعات المرتبطة، وإجراءات الطباعة والإرسال.",
    status: "الحالة",
    total: "الإجمالي",
    archivedClient: "موكل مؤرشف",
    arabic: "العربية",
    english: "English",
    edit: "تعديل",
    editTitle: "تعديل الفاتورة",
    editBlockedTitle:
      "لا يمكن تعديل البيانات المالية لفاتورة لديها دفعات محصلة",
    print: "طباعة",
    creatingPdf: "جاري إنشاء PDF...",
    whatsapp: "واتساب",
    delete: "حذف",
    deleteTitle: "حذف الفاتورة",
    deleteArchivedTitle: "لا يمكن حذف فاتورة مرتبطة بموكل مؤرشف",
    deletePaymentsTitle: "لا يمكن حذف فاتورة مرتبطة بدفعات",
    invoiceTotal: "إجمالي الفاتورة",
    finalAmount: "المبلغ النهائي",
    paidAmount: "المبلغ المحصل",
    collectedPayments: (count: number) => `${count} دفعة محصلة`,
    remainingAmount: "المبلغ المتبقي",
    remainingToCollect: "متبقي للتحصيل",
    fullyCollected: "تم التحصيل بالكامل",
    paymentCount: "عدد الدفعات",
    allLinkedPayments: "كل الدفعات المرتبطة",
    invoiceStatus: "حالة الفاتورة",
    automaticStatus: "الحالة المالية تُحسب تلقائيًا من الدفعات",
    changeStatus: "تغيير حالة الفاتورة",
    automatic: "تلقائي",
    linkedPaymentsNotice: (count: number) =>
      `هذه الفاتورة مرتبطة بـ ${count} دفعة. حالة التحصيل تُحسب تلقائيًا.`,
    archivedInvoiceNotice:
      "هذه الفاتورة مرتبطة بموكل مؤرشف. يمكن تعديل بيانات الفاتورة وتحديث حالتها، لكن لا يمكن حذفها لحماية السجل المالي.",
    clientDetails: "بيانات الموكل",
    name: "الاسم",
    phone: "الهاتف",
    email: "البريد",
    caseDetails: "بيانات القضية",
    case: "القضية",
    caseNumber: "رقم القضية",
    noCase: "بدون قضية",
    dates: "التواريخ",
    issueDate: "تاريخ الإصدار",
    dueDate: "تاريخ الاستحقاق",
    editSubtitle:
      "تعديل التواريخ والبنود والضريبة والخصم. لا يمكن تعديل فاتورة لديها دفعات محصلة.",
    editLockedNotice:
      "هذه الفاتورة لديها دفعات محصلة، لذلك تم منع تعديل البيانات المالية لحماية السجلات.",
    tax: "الضريبة",
    discount: "الخصم",
    items: "البنود",
    addItem: "+ إضافة بند",
    itemDescription: "وصف البند",
    quantity: "الكمية",
    unitPrice: "سعر الوحدة",
    notes: "ملاحظات",
    subtotal: "المجموع الفرعي",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ...",
    saveChanges: "حفظ التعديلات",
    errors: {
      editLocked:
        "لا يمكن تعديل البيانات المالية لفاتورة لديها دفعات محصلة. عالج الدفعات أولًا.",
      itemRequired: "أضف بند واحد على الأقل",
      invalidItem: "تأكد أن الكمية أكبر من صفر وأن سعر الوحدة غير سالب",
      negativeTaxDiscount: "الضريبة والخصم لا يمكن أن تكون قيمهم سالبة",
      discountTooHigh: "الخصم لا يمكن أن يكون أكبر من المجموع والضريبة",
      editFailed: "تعذر تعديل الفاتورة",
      automaticPaidStatus:
        "حالة التحصيل تُحسب تلقائيًا من الدفعات. سجّل دفعة على الفاتورة بدل تغيير الحالة يدويًا.",
      statusLocked:
        "لا يمكن تغيير حالة فاتورة لديها دفعات محصلة. عالج الدفعات المرتبطة أولًا.",
      statusFailed: "تعذر تحديث حالة الفاتورة",
      deleteArchived: "لا يمكن حذف فاتورة مرتبطة بموكل مؤرشف",
      deletePayments:
        "لا يمكن حذف هذه الفاتورة لأنها مرتبطة بدفعات. عالج الدفعات المرتبطة أولًا.",
      deleteFailed: "تعذر حذف الفاتورة",
      noWhatsapp: "لا يوجد رقم واتساب أو هاتف محفوظ لهذا الموكل",
      pdfFailed: "تعذر إنشاء ملف PDF",
    },
    success: {
      edited: "تم تعديل الفاتورة",
      statusUpdated: "تم تحديث حالة الفاتورة",
      deleted: "تم حذف الفاتورة",
    },
    confirmDelete: "هل أنت متأكد من حذف هذه الفاتورة؟",
  },
  en: {
    confirm: "Confirm",
    notFoundTitle: "Invoice not found",
    notFoundText:
      "The requested invoice could not be found. It may have been deleted or the link may be invalid.",
    backToInvoices: "← Back to invoices",
    detailsBadge: "Invoice details",
    invoiceTitle: (number: string) => `Invoice ${number}`,
    detailsSubtitle:
      "View invoice items, client, case, linked payments, and printing or sharing actions.",
    status: "Status",
    total: "Total",
    archivedClient: "Archived client",
    arabic: "العربية",
    english: "English",
    edit: "Edit",
    editTitle: "Edit invoice",
    editBlockedTitle:
      "Financial details cannot be edited after payments are collected",
    print: "Print",
    creatingPdf: "Creating PDF...",
    whatsapp: "WhatsApp",
    delete: "Delete",
    deleteTitle: "Delete invoice",
    deleteArchivedTitle:
      "An invoice linked to an archived client cannot be deleted",
    deletePaymentsTitle: "An invoice linked to payments cannot be deleted",
    invoiceTotal: "Invoice total",
    finalAmount: "Final amount",
    paidAmount: "Amount collected",
    collectedPayments: (count: number) =>
      `${count} collected ${count === 1 ? "payment" : "payments"}`,
    remainingAmount: "Remaining amount",
    remainingToCollect: "Remaining to collect",
    fullyCollected: "Collected in full",
    paymentCount: "Payment count",
    allLinkedPayments: "All linked payments",
    invoiceStatus: "Invoice status",
    automaticStatus:
      "The financial status is calculated automatically from payments",
    changeStatus: "Change invoice status",
    automatic: "automatic",
    linkedPaymentsNotice: (count: number) =>
      `This invoice is linked to ${count} ${count === 1 ? "payment" : "payments"}. Collection status is calculated automatically.`,
    archivedInvoiceNotice:
      "This invoice is linked to an archived client. Its details and status may be updated, but it cannot be deleted in order to protect the financial record.",
    clientDetails: "Client details",
    name: "Name",
    phone: "Phone",
    email: "Email",
    caseDetails: "Case details",
    case: "Case",
    caseNumber: "Case number",
    noCase: "No case",
    dates: "Dates",
    issueDate: "Issue date",
    dueDate: "Due date",
    editSubtitle:
      "Edit dates, items, tax, and discount. An invoice with collected payments cannot be edited.",
    editLockedNotice:
      "This invoice has collected payments, so its financial details are locked to protect the records.",
    tax: "Tax",
    discount: "Discount",
    items: "Items",
    addItem: "+ Add item",
    itemDescription: "Item description",
    quantity: "Quantity",
    unitPrice: "Unit price",
    notes: "Notes",
    subtotal: "Subtotal",
    cancel: "Cancel",
    saving: "Saving...",
    saveChanges: "Save changes",
    errors: {
      editLocked:
        "Financial details cannot be edited after payments are collected. Handle the payments first.",
      itemRequired: "Add at least one item",
      invalidItem:
        "Quantity must be greater than zero and unit price cannot be negative",
      negativeTaxDiscount: "Tax and discount cannot be negative",
      discountTooHigh: "Discount cannot exceed the subtotal plus tax",
      editFailed: "Could not update the invoice",
      automaticPaidStatus:
        "Collection status is calculated automatically from payments. Record a payment instead of changing it manually.",
      statusLocked:
        "The status cannot be changed while the invoice has collected payments. Handle the linked payments first.",
      statusFailed: "Could not update the invoice status",
      deleteArchived:
        "An invoice linked to an archived client cannot be deleted",
      deletePayments:
        "This invoice cannot be deleted because it has linked payments. Handle those payments first.",
      deleteFailed: "Could not delete the invoice",
      noWhatsapp: "No WhatsApp or phone number is saved for this client",
      pdfFailed: "Could not create the PDF file",
    },
    success: {
      edited: "Invoice updated",
      statusUpdated: "Invoice status updated",
      deleted: "Invoice deleted",
    },
    confirmDelete: "Are you sure you want to delete this invoice?",
  },
} as const;

const INVOICE_DOCUMENT_COPY = {
  ar: {
    invoice: "فاتورة",
    invoiceNumber: "رقم الفاتورة",
    issueDate: "تاريخ الإصدار",
    dueDate: "تاريخ الاستحقاق",
    finalTotal: "الإجمالي النهائي",
    clientDetails: "بيانات الموكل",
    caseDetails: "بيانات القضية",
    status: "الحالة",
    noCase: "بدون قضية",
    noPayment: "لا توجد دفعة مرتبطة",
    linkedPayment: "مرتبطة بدفعة",
    items: "بنود الفاتورة",
    description: "الوصف",
    quantity: "الكمية",
    unitPrice: "سعر الوحدة",
    total: "الإجمالي",
    subtotal: "المجموع الفرعي",
    tax: "الضريبة",
    discount: "الخصم",
    payment: "الدفعة المرتبطة",
    payments: "الدفعات المرتبطة",
    amount: "المبلغ",
    paidTotal: "إجمالي المحصل",
    remaining: "المبلغ المتبقي",
    paymentCount: "عدد الدفعات",
    paymentMethod: "طريقة الدفع",
    paymentReference: "رقم المرجع",
    paymentDate: "تاريخ الدفع",
    notes: "ملاحظات",
    noNotes: "لا توجد ملاحظات إضافية.",
    officeSignature: "توقيع المكتب",
    clientSignature: "توقيع الموكل",
    generatedBy: "تم إنشاء هذه الفاتورة بواسطة Viresto",
    language: "لغة الفاتورة",
    statuses: {
      DRAFT: "مسودة",
      UNPAID: "غير مدفوعة",
      PARTIALLY_PAID: "مدفوعة جزئيًا",
      PAID: "مدفوعة",
      OVERDUE: "متأخرة",
      CANCELLED: "ملغاة",
    } as Record<InvoiceStatus, string>,
    paymentStatuses: {
      PAID: "مدفوعة",
      PENDING: "معلّقة",
      OVERDUE: "متأخرة",
      CANCELLED: "ملغاة",
    } as Record<string, string>,
  },
  en: {
    invoice: "Invoice",
    invoiceNumber: "Invoice number",
    issueDate: "Issue date",
    dueDate: "Due date",
    finalTotal: "Final total",
    clientDetails: "Client details",
    caseDetails: "Case details",
    status: "Status",
    noCase: "No case",
    noPayment: "No linked payment",
    linkedPayment: "Linked to a payment",
    items: "Invoice items",
    description: "Description",
    quantity: "Quantity",
    unitPrice: "Unit price",
    total: "Total",
    subtotal: "Subtotal",
    tax: "Tax",
    discount: "Discount",
    payment: "Linked payment",
    payments: "Linked payments",
    amount: "Amount",
    paidTotal: "Paid total",
    remaining: "Remaining amount",
    paymentCount: "Payment count",
    paymentMethod: "Payment method",
    paymentReference: "Reference",
    paymentDate: "Payment date",
    notes: "Notes",
    noNotes: "No additional notes.",
    officeSignature: "Office signature",
    clientSignature: "Client signature",
    generatedBy: "This invoice was generated by Viresto",
    language: "Invoice language",
    statuses: {
      DRAFT: "Draft",
      UNPAID: "Unpaid",
      PARTIALLY_PAID: "Partially paid",
      PAID: "Paid",
      OVERDUE: "Overdue",
      CANCELLED: "Cancelled",
    } as Record<InvoiceStatus, string>,
    paymentStatuses: {
      PAID: "Paid",
      PENDING: "Pending",
      OVERDUE: "Overdue",
      CANCELLED: "Cancelled",
    } as Record<string, string>,
  },
};

const VIRESTO_BRAND_LOGO_PATH = "/viresto-logo.png";

const VIRESTO_FALLBACK_LOGO =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="128" fill="#ffffff"/>
      <path
        d="M116 128h82l58 166 58-166h82L294 384h-76L116 128Z"
        fill="#0f3d3e"
      />
    </svg>
  `);

function formatInvoiceDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function formatInvoiceMoney(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US", {
    style: "currency",
    currency: "JOD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

function extractClientPhone(data: unknown) {
  const payload = data as any;
  const candidates = [
    payload?.whatsappNumber,
    payload?.whatsapp,
    payload?.phone,
    payload?.mobile,
    payload?.client?.whatsappNumber,
    payload?.client?.whatsapp,
    payload?.client?.phone,
    payload?.client?.mobile,
    payload?.data?.whatsappNumber,
    payload?.data?.whatsapp,
    payload?.data?.phone,
    payload?.data?.mobile,
    payload?.data?.client?.whatsappNumber,
    payload?.data?.client?.whatsapp,
    payload?.data?.client?.phone,
    payload?.data?.client?.mobile,
    payload?.data?.data?.whatsappNumber,
    payload?.data?.data?.whatsapp,
    payload?.data?.data?.phone,
    payload?.data?.data?.mobile,
  ];

  return (
    candidates.find(
      (value) => typeof value === "string" && value.trim().length > 0,
    ) || null
  );
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function paymentStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    PAID: "مدفوعة",
    PENDING: "معلّقة",
    OVERDUE: "متأخرة",
    CANCELLED: "ملغاة",
  };

  return status ? (map[status] ?? status) : "-";
}

function isArchivedInvoice(invoice: Invoice) {
  return Boolean(
    invoice.client?.archivedAt || invoice.case?.client?.archivedAt,
  );
}


function FinanceSuccessOverlay({
  open,
  kind,
  title,
  subtitle,
  status,
  onComplete,
}: {
  open: boolean;
  kind: "invoice" | "payment" | "update" | "pdf";
  title: string;
  subtitle?: string;
  status?: string;
  onComplete?: () => void;
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open || !onComplete) return;
    const timeout = window.setTimeout(onComplete, reduceMotion ? 250 : 1450);
    return () => window.clearTimeout(timeout);
  }, [open, onComplete, reduceMotion]);

  const icon =
    kind === "payment" ? "💳" : kind === "pdf" ? "🖨️" : kind === "update" ? "✓" : "🧾";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[30px] border p-7 text-center shadow-2xl"
            style={{
              background: "var(--card)",
              borderColor: "rgba(184,115,51,.35)",
              color: "var(--text)",
            }}
          >
            <motion.div
              className="absolute inset-x-0 top-0 h-1"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #b87333, #f1c27d, transparent)",
              }}
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: reduceMotion ? 0.01 : 1.05, ease: "easeInOut" }}
            />

            <motion.div
              className="relative mx-auto grid h-24 w-24 place-items-center rounded-[26px] border text-4xl"
              style={{
                background: "var(--green-soft)",
                borderColor: "rgba(53,138,136,.26)",
              }}
              initial={reduceMotion ? false : { rotate: -8, scale: 0.75 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.08, type: "spring", stiffness: 300 }}
            >
              {icon}
              <motion.span
                className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-lg font-black text-white shadow-lg"
                initial={reduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.28, type: "spring", stiffness: 380 }}
              >
                ✓
              </motion.span>
            </motion.div>

            <motion.h2
              className="mt-5 text-xl font-black"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
            >
              {title}
            </motion.h2>

            {subtitle && (
              <motion.p
                className="mt-2 text-sm font-semibold leading-6"
                style={{ color: "var(--text-3)" }}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.32 }}
              >
                {subtitle}
              </motion.p>
            )}

            {status && (
              <motion.div
                className="mx-auto mt-4 w-fit -rotate-3 rounded-xl border-2 px-4 py-2 text-sm font-black uppercase tracking-[0.18em]"
                style={{
                  borderColor: "#15803d",
                  color: "#15803d",
                  background: "rgba(34,197,94,.08)",
                }}
                initial={reduceMotion ? false : { opacity: 0, scale: 1.5, rotate: -14 }}
                animate={{ opacity: 1, scale: 1, rotate: -3 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 260 }}
              >
                {status}
              </motion.div>
            )}

            <div
              className="mt-6 h-1.5 overflow-hidden rounded-full"
              style={{ background: "var(--green-soft)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg,#0f5253,#b87333)" }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: reduceMotion ? 0.1 : 1.15, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const localeState = useLocale() as { locale?: Locale };
  const appLocale: Locale = localeState?.locale === "en" ? "en" : "ar";
  const appIsRtl = appLocale === "ar";
  const ui = INVOICE_DETAILS_COPY[appLocale];
  const statusLabels = STATUS_LABELS[appLocale];
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [invoiceLocale, setInvoiceLocale] = useState<Locale>(appLocale);
  const [successMotion, setSuccessMotion] = useState<{ kind: "update" | "pdf"; title: string; subtitle?: string; status?: string } | null>(null);

  const [editDueDate, setEditDueDate] = useState("");
  const [editTax, setEditTax] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<EditItem[]>([]);

  const invoiceRef = useRef<HTMLDivElement | null>(null);
  function confirmToast(message: string) {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const toastId = toast(message, {
        duration: 10000,
        action: {
          label: ui.confirm,
          onClick: () => {
            if (settled) return;
            settled = true;
            toast.dismiss(toastId);
            resolve(true);
          },
        },
        onDismiss: () => {
          if (settled) return;
          settled = true;
          resolve(false);
        },
        onAutoClose: () => {
          if (settled) return;
          settled = true;
          resolve(false);
        },
      });
    });
  }

  async function load() {
    if (!id || id === "undefined" || id === "null") {
      setInvoice(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`/api/invoices/${id}`, {
        cache: "no-store",
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Invoice load failed:", {
          id,
          status: res.status,
          data,
        });

        setInvoice(null);
        return;
      }

      const loadedInvoice =
        data.data?.invoice ?? data.data ?? data.invoice ?? null;

      setInvoice(loadedInvoice);

      if (
        loadedInvoice?.publicId &&
        String(loadedInvoice.publicId) !== String(id)
      ) {
        router.replace(`/dashboard/finance/invoices/${loadedInvoice.publicId}`);
      }
    } catch (error) {
      console.error("Invoice load error:", error);
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setInvoiceLocale(appLocale);
  }, [appLocale]);

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openEditModal() {
    if (!invoice) return;

    const hasCollectedPayments = invoice.payments.some(
      (payment) => payment.status === "PAID",
    );

    if (
      invoice.status === "PAID" ||
      invoice.status === "PARTIALLY_PAID" ||
      hasCollectedPayments
    ) {
      toast.error(ui.errors.editLocked);
      return;
    }

    setEditDueDate(toDateInput(invoice.dueDate));
    setEditTax(invoice.tax || 0);
    setEditDiscount(invoice.discount || 0);
    setEditNotes(invoice.notes || "");
    setEditItems(
      invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    );
    setEditOpen(true);
  }

  function updateEditItem(index: number, key: keyof EditItem, value: string) {
    setEditItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]: key === "description" ? value : Number(value || 0),
            }
          : item,
      ),
    );
  }

  function addEditItem() {
    setEditItems((prev) => [
      ...prev,
      {
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }

  function removeEditItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  const editSubtotal = roundMoney(
    editItems.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      return sum + quantity * unitPrice;
    }, 0),
  );

  const editTotal = roundMoney(
    editSubtotal + Number(editTax || 0) - Number(editDiscount || 0),
  );

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!invoice) return;

    const cleanItems = editItems
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
      }))
      .filter((item) => item.description);

    if (cleanItems.length === 0) {
      toast.error(ui.errors.itemRequired);
      return;
    }

    if (cleanItems.some((item) => item.quantity <= 0 || item.unitPrice < 0)) {
      toast.error(ui.errors.invalidItem);
      return;
    }

    if (Number(editTax || 0) < 0 || Number(editDiscount || 0) < 0) {
      toast.error(ui.errors.negativeTaxDiscount);
      return;
    }

    if (editTotal < 0) {
      toast.error(ui.errors.discountTooHigh);
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate: editDueDate || null,
          tax: Number(editTax || 0),
          discount: Number(editDiscount || 0),
          notes: editNotes,
          items: cleanItems,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(apiErrorMessage(data, ui.errors.editFailed));
        return;
      }

      setEditOpen(false);
      setSuccessMotion({ kind: "update", title: ui.success.edited, status: invoice.status ? statusLabels[invoice.status] : undefined });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(nextStatus: InvoiceStatus) {
    if (!invoice || invoice.status === nextStatus) return;

    if (nextStatus === "PAID" || nextStatus === "PARTIALLY_PAID") {
      toast.error(ui.errors.automaticPaidStatus);
      return;
    }

    if (invoice.payments.some((payment) => payment.status === "PAID")) {
      toast.error(ui.errors.statusLocked);
      return;
    }

    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: nextStatus,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(apiErrorMessage(data, ui.errors.statusFailed));
      return;
    }

    setSuccessMotion({ kind: "update", title: ui.success.statusUpdated, status: statusLabels[nextStatus] });
    await load();
  }

  async function deleteInvoice() {
    if (!invoice) return;

    if (isArchivedInvoice(invoice)) {
      toast.error(ui.errors.deleteArchived);
      return;
    }

    if (invoice.payments.length > 0) {
      toast.error(ui.errors.deletePayments);
      return;
    }

    const confirmed = await confirmToast(ui.confirmDelete);
    if (!confirmed) return;

    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(apiErrorMessage(data, ui.errors.deleteFailed));
      return;
    }

    toast.success(ui.success.deleted);
    router.push("/dashboard/finance/invoices");
  }

  async function sendInvoiceWhatsApp() {
    if (!invoice) return;

    let rawPhone =
      invoice.client?.whatsappNumber ||
      invoice.client?.whatsapp ||
      invoice.client?.phone ||
      invoice.client?.mobile ||
      null;

    if (!rawPhone && invoice.client?.id) {
      try {
        const response = await fetch(`/api/clients/${invoice.client.id}`, {
          cache: "no-store",
        });
        const data = response.ok ? await response.json().catch(() => ({})) : {};

        rawPhone = extractClientPhone(data);
      } catch {
        rawPhone = null;
      }
    }

    const phone = normalizeWhatsAppPhone(rawPhone);

    if (!phone) {
      toast.error(ui.errors.noWhatsapp);
      return;
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(
        buildInvoiceWhatsAppMessage(invoice, invoiceLocale),
      )}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function downloadInvoicePDF() {
    if (!invoiceRef.current || !invoice) return;

    try {
      setPdfLoading(true);

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;
      const mmPerPixel = usableWidth / canvas.width;
      const pageHeightInPixels = Math.max(
        1,
        Math.floor(usableHeight / mmPerPixel),
      );

      const invoiceRect = invoiceRef.current.getBoundingClientRect();
      const canvasScale =
        invoiceRect.width > 0 ? canvas.width / invoiceRect.width : 1;
      const keepRanges = Array.from(
        invoiceRef.current.querySelectorAll<HTMLElement>("[data-pdf-keep]"),
      )
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            top: Math.max(
              0,
              Math.floor((rect.top - invoiceRect.top) * canvasScale),
            ),
            bottom: Math.min(
              canvas.height,
              Math.ceil((rect.bottom - invoiceRect.top) * canvasScale),
            ),
          };
        })
        .filter((range) => range.bottom > range.top)
        .sort((first, second) => first.top - second.top);

      let sliceStart = 0;
      let pageIndex = 0;

      while (sliceStart < canvas.height) {
        let sliceEnd = Math.min(
          sliceStart + pageHeightInPixels,
          canvas.height,
        );

        if (sliceEnd < canvas.height) {
          const protectedRange = keepRanges.find(
            (range) =>
              range.top > sliceStart &&
              range.top < sliceEnd &&
              range.bottom > sliceEnd &&
              range.bottom - range.top <= pageHeightInPixels,
          );

          if (
            protectedRange &&
            protectedRange.top - sliceStart >= pageHeightInPixels * 0.2
          ) {
            sliceEnd = protectedRange.top;
          }
        }

        const sliceHeight = Math.max(1, sliceEnd - sliceStart);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const context = pageCanvas.getContext("2d");
        if (!context) {
          throw new Error("Could not prepare the invoice PDF page.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(
          canvas,
          0,
          sliceStart,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          pageCanvas.toDataURL("image/png"),
          "PNG",
          margin,
          margin,
          usableWidth,
          sliceHeight * mmPerPixel,
        );

        sliceStart = sliceEnd;
        pageIndex += 1;
      }

      pdf.save(`${safeInvoiceFilename(invoice.invoiceNumber)}.pdf`);
    } catch (error) {
      console.error(error);
      toast.error(ui.errors.pdfFailed);
    } finally {
      setPdfLoading(false);
    }
  }

  function printInvoice() {
    if (!invoice) return;
    printInvoiceDocument(invoice, invoiceLocale);
  }

  if (!mounted || loading) {
    return <AppLoader fullScreen={false} />;
  }

  function apiErrorMessage(
    data: { message?: string; error?: string },
    fallback: string,
  ) {
    if (appLocale === "ar") {
      return data.message || data.error || fallback;
    }

    return fallback;
  }

  if (!invoice) {
    return (
      <div dir={appIsRtl ? "rtl" : "ltr"} className="space-y-5 stagger">
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
            borderColor: "rgba(255,255,255,0.12)",
            boxShadow: "0 18px 50px rgba(15, 61, 62, 0.18)",
          }}
        >
          <h1 className="text-2xl font-black text-white">{ui.notFoundTitle}</h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
            {ui.notFoundText}
          </p>
        </div>

        <div className="card p-8 text-center">
          <button
            onClick={() => router.push("/dashboard/finance/invoices")}
            className="btn btn-primary"
          >
            {ui.backToInvoices.replace("← ", "")}
          </button>
        </div>
      </div>
    );
  }

  const payments = invoice.payments ?? [];
  const paidPayments = payments.filter((payment) => payment.status === "PAID");
  const paidTotal = roundMoney(
    paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
  );
  const remainingTotal = roundMoney(
    Math.max(0, Number(invoice.total || 0) - paidTotal),
  );
  const hasPayments = payments.length > 0;
  const hasPaidPayments = paidPayments.length > 0;

  const tenantName = invoice.tenant?.name || "Viresto";
  const useVirestoLockup =
    !invoice.tenant?.logoUrl && tenantName.trim().toLowerCase() === "viresto";
  const archivedInvoice = isArchivedInvoice(invoice);
  const canEditFinancials =
    !hasPaidPayments &&
    invoice.status !== "PAID" &&
    invoice.status !== "PARTIALLY_PAID";
  const invoiceCopy = INVOICE_DOCUMENT_COPY[invoiceLocale];
  const invoiceIsRtl = invoiceLocale === "ar";

  return (
    <div
      dir={appIsRtl ? "rtl" : "ltr"}
      className="space-y-5 stagger print:space-y-4 print:bg-white print:text-black"
    >
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6 print:hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 18px 50px rgba(15, 61, 62, 0.18)",
        }}
      >
        <div
          className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
          style={{ background: "rgba(184, 115, 51, 0.16)" }}
        />

        <div
          className="absolute -bottom-20 right-16 h-52 w-52 rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <button
              onClick={() => router.push("/dashboard/finance/invoices")}
              className="mb-3 rounded-full px-3 py-1 text-xs font-black text-white/80 transition hover:bg-white/10"
            >
              {ui.backToInvoices}
            </button>

            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {ui.detailsBadge}
            </div>

            <h1 className="text-2xl font-black text-white">
              {ui.invoiceTitle(formatInvoiceNumber(invoice.invoiceNumber))}
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              {ui.detailsSubtitle}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                }}
              >
                {ui.status}: {statusLabels[invoice.status]}
              </span>

              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: "rgba(184, 115, 51,0.18)",
                  color: "#fff",
                }}
              >
                {ui.total}: {formatInvoiceMoney(invoice.total, appLocale)}
              </span>

              {archivedInvoice && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-black"
                  style={{
                    background: "#fff7ed",
                    color: "#b45309",
                    border: "1px solid rgba(180, 83, 9, 0.18)",
                  }}
                >
                  {ui.archivedClient}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-2xl border p-1"
              style={{
                background: "rgba(255,255,255,0.12)",
                borderColor: "rgba(255,255,255,0.22)",
              }}
              aria-label={invoiceCopy.language}
            >
              <button
                type="button"
                onClick={() => setInvoiceLocale("ar")}
                className="rounded-xl px-3 py-2 text-xs font-black transition"
                style={{
                  background: invoiceLocale === "ar" ? "#fff" : "transparent",
                  color:
                    invoiceLocale === "ar"
                      ? "var(--sidebar)"
                      : "rgba(255,255,255,0.82)",
                }}
              >
                {ui.arabic}
              </button>

              <button
                type="button"
                onClick={() => setInvoiceLocale("en")}
                className="rounded-xl px-3 py-2 text-xs font-black transition"
                style={{
                  background: invoiceLocale === "en" ? "#fff" : "transparent",
                  color:
                    invoiceLocale === "en"
                      ? "var(--sidebar)"
                      : "rgba(255,255,255,0.82)",
                }}
              >
                {ui.english}
              </button>
            </div>

            <button
              onClick={openEditModal}
              disabled={!canEditFinancials}
              title={canEditFinancials ? ui.editTitle : ui.editBlockedTitle}
              className="btn disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "#fff",
                color: "var(--sidebar)",
                borderColor: "rgba(255,255,255,0.32)",
              }}
            >
              {ui.edit}
            </button>

            <button
              onClick={printInvoice}
              className="btn"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.22)",
              }}
            >
              {ui.print}
            </button>

            <button
              onClick={downloadInvoicePDF}
              disabled={pdfLoading}
              className="btn"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.22)",
              }}
            >
              {pdfLoading ? ui.creatingPdf : "PDF"}
            </button>

            <button
              onClick={sendInvoiceWhatsApp}
              className="btn"
              style={{
                background: "rgba(34,197,94,0.18)",
                color: "#fff",
                borderColor: "rgba(34,197,94,0.32)",
              }}
            >
              {ui.whatsapp}
            </button>

            <button
              onClick={deleteInvoice}
              disabled={archivedInvoice || hasPayments}
              title={
                archivedInvoice
                  ? ui.deleteArchivedTitle
                  : hasPayments
                    ? ui.deletePaymentsTitle
                    : ui.deleteTitle
              }
              className="btn disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "rgba(239,68,68,0.18)",
                color: "#fff",
                borderColor: "rgba(239,68,68,0.32)",
              }}
            >
              {ui.delete}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <InfoCard
          label={ui.invoiceTotal}
          value={formatInvoiceMoney(invoice.total, appLocale)}
          hint={ui.finalAmount}
          tone="green"
        />

        <InfoCard
          label={ui.paidAmount}
          value={formatInvoiceMoney(paidTotal, appLocale)}
          hint={ui.collectedPayments(paidPayments.length)}
          tone="green"
        />

        <InfoCard
          label={ui.remainingAmount}
          value={formatInvoiceMoney(remainingTotal, appLocale)}
          hint={remainingTotal > 0 ? ui.remainingToCollect : ui.fullyCollected}
          tone={remainingTotal > 0 ? "amber" : "green"}
        />

        <InfoCard
          label={ui.paymentCount}
          value={payments.length}
          hint={ui.allLinkedPayments}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 print:block">
        {/* Sidebar */}
        <div className="space-y-5 xl:col-span-4 print:hidden">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black" style={{ color: "var(--text)" }}>
                  {ui.invoiceStatus}
                </h2>

                <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                  {ui.automaticStatus}
                </p>
              </div>

              <span
                className={`${statusClasses[invoice.status]} shrink-0`}
                style={statusStyles[invoice.status]}
              >
                {statusLabels[invoice.status]}
              </span>
            </div>

            <select
              value={invoice.status}
              onChange={(e) => updateStatus(e.target.value as InvoiceStatus)}
              dir={appIsRtl ? "rtl" : "ltr"}
              className="input text-start"
              style={{
                direction: appIsRtl ? "rtl" : "ltr",
                textAlign: appIsRtl ? "right" : "left",
                backgroundPosition: appIsRtl
                  ? "left 16px center"
                  : "right 16px center",
                paddingInlineStart: "16px",
                paddingInlineEnd: "44px",
              }}
              aria-label={ui.changeStatus}
            >
              <option
                value="DRAFT"
                style={{ textAlign: appIsRtl ? "right" : "left" }}
              >
                {statusLabels.DRAFT}
              </option>
              <option
                value="UNPAID"
                style={{ textAlign: appIsRtl ? "right" : "left" }}
              >
                {statusLabels.UNPAID}
              </option>

              <option
                value="PARTIALLY_PAID"
                disabled
                style={{ textAlign: appIsRtl ? "right" : "left" }}
              >
                {statusLabels.PARTIALLY_PAID} — {ui.automatic}
              </option>

              <option
                value="PAID"
                disabled
                style={{ textAlign: appIsRtl ? "right" : "left" }}
              >
                {statusLabels.PAID} — {ui.automatic}
              </option>

              <option
                value="OVERDUE"
                style={{ textAlign: appIsRtl ? "right" : "left" }}
              >
                {statusLabels.OVERDUE}
              </option>
              <option
                value="CANCELLED"
                style={{ textAlign: appIsRtl ? "right" : "left" }}
              >
                {statusLabels.CANCELLED}
              </option>
            </select>

            {hasPayments && (
              <div
                className="mt-4 rounded-2xl border p-4 text-sm font-bold"
                style={{
                  borderColor: "#a7f3d0",
                  background: "#ecfdf5",
                  color: "#065f46",
                }}
              >
                {ui.linkedPaymentsNotice(payments.length)}
              </div>
            )}

            {archivedInvoice && (
              <div
                className="mt-4 rounded-2xl border p-4 text-sm font-bold"
                style={{
                  borderColor: "rgba(180, 83, 9, 0.22)",
                  background: "#fff7ed",
                  color: "#b45309",
                }}
              >
                {ui.archivedInvoiceNotice}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-black" style={{ color: "var(--text)" }}>
              {ui.clientDetails}
            </h2>

            <div className="mt-4 space-y-3">
              <MiniLine label={ui.name} value={invoice.client?.name} />
              <MiniLine label={ui.phone} value={invoice.client?.phone} />
              <MiniLine label={ui.email} value={invoice.client?.email} />

              {archivedInvoice && (
                <div
                  className="rounded-2xl border p-3 text-xs font-black"
                  style={{
                    background: "#fff7ed",
                    color: "#b45309",
                    borderColor: "rgba(180, 83, 9, 0.18)",
                  }}
                >
                  {ui.archivedClient}
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-black" style={{ color: "var(--text)" }}>
              {ui.caseDetails}
            </h2>

            <div className="mt-4 space-y-3">
              <MiniLine
                label={ui.case}
                value={invoice.case?.title || ui.noCase}
              />
              <MiniLine
                label={ui.caseNumber}
                value={invoice.case?.caseNumber}
              />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-black" style={{ color: "var(--text)" }}>
              {ui.dates}
            </h2>

            <div className="mt-4 space-y-3">
              <MiniLine
                label={ui.issueDate}
                value={formatInvoiceDate(invoice.issueDate, appLocale)}
              />
              <MiniLine
                label={ui.dueDate}
                value={formatInvoiceDate(invoice.dueDate, appLocale)}
              />
            </div>
          </div>
        </div>

        {/* Invoice Printable Area */}
        <div className="space-y-5 xl:col-span-8 print:block">
          <div
            ref={invoiceRef}
            dir={invoiceIsRtl ? "rtl" : "ltr"}
            className="overflow-hidden rounded-[30px] border bg-white text-start text-slate-950 shadow-sm print:rounded-none print:border-0 print:shadow-none"
            style={{ borderColor: "#dce9e7" }}
          >
            {/* Branded Header */}
            <div
              data-pdf-keep
              className="relative overflow-hidden px-7 py-7 text-white sm:px-9"
              style={{
                background:
                  "radial-gradient(circle at 12% 0%, rgba(255,255,255,0.14), transparent 34%), linear-gradient(135deg, #0f3d3e, #1a5556)",
              }}
            >
              <div
                className="absolute -bottom-24 end-[-72px] h-52 w-52 rounded-full"
                style={{ background: "rgba(255,255,255,0.08)" }}
              />

              <div
                dir="ltr"
                className={`relative z-10 flex flex-col gap-6 sm:items-center sm:justify-between ${
                  invoiceIsRtl ? "sm:flex-row" : "sm:flex-row-reverse"
                }`}
              >
                <div className="flex shrink-0 flex-col items-center justify-center gap-2 text-center">
                  {useVirestoLockup ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={VIRESTO_BRAND_LOGO_PATH}
                      alt="Viresto"
                      className="h-[86px] w-[86px] rounded-[24px] border border-white/25 bg-white/10 object-contain p-2"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = VIRESTO_FALLBACK_LOGO;
                      }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={invoice.tenant?.logoUrl || "/icon.png"}
                      alt={tenantName}
                      className="h-[86px] w-[86px] rounded-[24px] border border-white/25 bg-white object-contain p-2"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = VIRESTO_FALLBACK_LOGO;
                      }}
                    />
                  )}

                  <p
                    dir={invoiceIsRtl ? "rtl" : "ltr"}
                    className="max-w-[190px] break-words text-center text-base font-black text-white"
                  >
                    {tenantName}
                  </p>

                  <p
                    dir={invoiceIsRtl ? "rtl" : "ltr"}
                    className="max-w-[190px] break-words text-center text-[10px] font-bold text-white/65"
                  >
                    {invoice.tenant?.email || "Legal Platform"}
                  </p>
                </div>

                <div
                  dir={invoiceIsRtl ? "rtl" : "ltr"}
                  className={`min-w-0 ${
                    invoiceIsRtl ? "text-right" : "text-left"
                  }`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">
                    Viresto
                  </p>

                  <h2
                    className="mt-2 pb-1 text-4xl font-black leading-[1.4] text-white"
                    style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
                  >
                    {invoiceCopy.invoice}
                  </h2>

                  <div className="mt-3">
                    <span
                      dir="ltr"
                      className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-black leading-5"
                    >
                      {formatInvoiceNumber(invoice.invoiceNumber)}
                    </span>
                  </div>

                  <p className="mt-4 text-xs font-black leading-5 text-white/80">
                    {invoiceCopy.status}: {invoiceCopy.statuses[invoice.status]}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {/* Summary */}
              <div
                data-pdf-keep
                className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
              >
                {[
                  {
                    label: invoiceCopy.invoiceNumber,
                    value: formatInvoiceNumber(invoice.invoiceNumber),
                    ltr: true,
                  },
                  {
                    label: invoiceCopy.issueDate,
                    value: formatInvoiceDate(invoice.issueDate, invoiceLocale),
                  },
                  {
                    label: invoiceCopy.dueDate,
                    value: formatInvoiceDate(invoice.dueDate, invoiceLocale),
                  },
                  {
                    label: invoiceCopy.finalTotal,
                    value: formatInvoiceMoney(invoice.total, invoiceLocale),
                    total: true,
                    ltr: true,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    dir={invoiceIsRtl ? "rtl" : "ltr"}
                    className={`rounded-2xl border p-4 ${
                      invoiceIsRtl ? "text-right" : "text-left"
                    }`}
                    style={{
                      borderColor: item.total ? "#bdd8d3" : "#dce9e7",
                      background: item.total ? "#e8f3f1" : "#fbfdfc",
                    }}
                  >
                    <p
                      className="text-[11px] font-black"
                      style={{
                        color: item.total ? "#0f3d3e" : "#456463",
                        WebkitTextFillColor: item.total ? "#0f3d3e" : "#456463",
                        opacity: 1,
                      }}
                    >
                      {item.label}
                    </p>
                    <p
                      dir={item.ltr ? "ltr" : undefined}
                      className="mt-2 break-words text-sm font-black"
                      style={{
                        color: item.total ? "#0f3d3e" : "#102d2e",
                        textAlign: invoiceIsRtl ? "right" : "left",
                      }}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Client and case */}
              <div
                data-pdf-keep
                className="mb-6 grid gap-4 md:grid-cols-2"
              >
                <div
                  dir={invoiceIsRtl ? "rtl" : "ltr"}
                  className={`rounded-3xl border p-5 ${
                    invoiceIsRtl ? "text-right" : "text-left"
                  }`}
                  style={{
                    borderColor: "#dce9e7",
                    background: "#fbfdfc",
                  }}
                >
                  <h3 className="text-base font-black text-[#0f3d3e]">
                    {invoiceCopy.clientDetails}
                  </h3>
                  <p className="mt-3 text-base font-black">
                    {invoice.client?.name || "-"}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-1 text-xs font-semibold text-[#4d6767]"
                    style={{
                      textAlign: invoiceIsRtl ? "right" : "left",
                    }}
                  >
                    {invoice.client?.phone || "-"}
                  </p>
                  <p
                    className="mt-1 break-all text-xs font-semibold text-[#4d6767]"
                    style={{
                      textAlign: invoiceIsRtl ? "right" : "left",
                    }}
                  >
                    {invoice.client?.email || "-"}
                  </p>
                </div>

                <div
                  dir={invoiceIsRtl ? "rtl" : "ltr"}
                  className={`rounded-3xl border p-5 ${
                    invoiceIsRtl ? "text-right" : "text-left"
                  }`}
                  style={{
                    borderColor: "#dce9e7",
                    background: "#fbfdfc",
                  }}
                >
                  <h3 className="text-base font-black text-[#0f3d3e]">
                    {invoiceCopy.caseDetails}
                  </h3>
                  <p className="mt-3 text-base font-black">
                    {invoice.case?.title || invoiceCopy.noCase}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#4d6767]">
                    {invoice.case?.caseNumber || "-"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#4d6767]">
                    {hasPayments
                      ? `${invoiceCopy.linkedPayment} (${payments.length})`
                      : invoiceCopy.noPayment}
                  </p>
                </div>
              </div>

              {/* Items */}
              <h3 className="mb-3 text-lg font-black text-[#0f3d3e]">
                {invoiceCopy.items}
              </h3>

              <div
                className="overflow-hidden rounded-3xl border"
                style={{ borderColor: "#dce9e7" }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead style={{ background: "#e8f3f1" }}>
                      <tr>
                        <th className="w-14 px-4 py-3 text-center text-xs font-black text-[#0f3d3e]">
                          #
                        </th>
                        <th className="px-4 py-3 text-start text-xs font-black text-[#0f3d3e]">
                          {invoiceCopy.description}
                        </th>
                        <th className="w-24 px-4 py-3 text-center text-xs font-black text-[#0f3d3e]">
                          {invoiceCopy.quantity}
                        </th>
                        <th className="w-40 px-4 py-3 text-start text-xs font-black text-[#0f3d3e]">
                          {invoiceCopy.unitPrice}
                        </th>
                        <th className="w-40 px-4 py-3 text-start text-xs font-black text-[#0f3d3e]">
                          {invoiceCopy.total}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {invoice.items.map((item, index) => (
                        <tr
                          key={item.id}
                          className="border-t"
                          style={{ borderColor: "#edf4f3" }}
                        >
                          <td className="px-4 py-3 text-center text-xs font-bold">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold">
                            {item.description}
                          </td>
                          <td
                            dir="ltr"
                            className="px-4 py-3 text-center text-xs font-bold"
                          >
                            {item.quantity}
                          </td>
                          <td
                            dir="ltr"
                            className="px-4 py-3 text-start text-xs font-bold"
                          >
                            {formatInvoiceMoney(item.unitPrice, invoiceLocale)}
                          </td>
                          <td
                            dir="ltr"
                            className="px-4 py-3 text-start text-xs font-black"
                          >
                            {formatInvoiceMoney(item.total, invoiceLocale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes and totals */}
              <div
                data-pdf-keep
                className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_340px]"
              >
                <div
                  className="min-h-40 rounded-3xl border border-dashed p-5"
                  style={{
                    borderColor: "#bfd5d2",
                    background: "#fbfdfc",
                  }}
                >
                  <h3 className="text-base font-black text-[#0f3d3e]">
                    {invoiceCopy.notes}
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-[#3d5a5a]">
                    {invoice.notes || invoiceCopy.noNotes}
                  </p>
                </div>

                <div
                  className="rounded-3xl border p-5"
                  style={{
                    borderColor: "#dce9e7",
                    background: "#fbfdfc",
                  }}
                >
                  {[
                    {
                      label: invoiceCopy.subtotal,
                      value: invoice.subtotal,
                    },
                    { label: invoiceCopy.tax, value: invoice.tax },
                    {
                      label: invoiceCopy.discount,
                      value: invoice.discount,
                    },
                  ].map((line) => (
                    <div
                      key={line.label}
                      className="flex items-center justify-between gap-4 border-b py-3 text-sm"
                      style={{ borderColor: "#e7f0ef" }}
                    >
                      <span className="font-semibold text-[#3d5a5a]">
                        {line.label}
                      </span>
                      <strong dir="ltr">
                        {formatInvoiceMoney(line.value, invoiceLocale)}
                      </strong>
                    </div>
                  ))}

                  <div className="flex items-center justify-between gap-4 pt-5 text-lg font-black text-[#0f3d3e]">
                    <span>{invoiceCopy.finalTotal}</span>
                    <span dir="ltr">
                      {formatInvoiceMoney(invoice.total, invoiceLocale)}
                    </span>
                  </div>
                </div>
              </div>

              {hasPayments && (
                <div
                  className="mt-5 rounded-2xl border px-5 py-4"
                  style={{
                    borderColor: "#bdd8d3",
                    background: "#e8f3f1",
                  }}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-black text-[#0f3d3e]">
                      {invoiceCopy.payments}
                    </h3>

                    <span className="text-xs font-bold text-[#4d6767]">
                      {payments.length} {invoiceCopy.paymentCount}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        data-pdf-keep
                        className="grid gap-3 rounded-xl border bg-white p-4 text-sm md:grid-cols-2 xl:grid-cols-5"
                        style={{ borderColor: "#dce9e7" }}
                      >
                        <div>
                          <p className="text-xs font-bold text-[#4d6767]">
                            {invoiceCopy.amount}
                          </p>
                          <p dir="ltr" className="mt-1 font-black">
                            {formatInvoiceMoney(payment.amount, invoiceLocale)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-[#4d6767]">
                            {invoiceCopy.status}
                          </p>
                          <p className="mt-1 font-black">
                            {invoiceCopy.paymentStatuses[payment.status] ||
                              paymentStatusLabel(payment.status)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-[#4d6767]">
                            {invoiceCopy.paymentMethod}
                          </p>
                          <p className="mt-1 font-black">
                            {payment.method || "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-[#4d6767]">
                            {invoiceCopy.paymentDate}
                          </p>
                          <p className="mt-1 font-black">
                            {formatInvoiceDate(payment.paidAt, invoiceLocale)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-[#4d6767]">
                            {invoiceCopy.paymentReference}
                          </p>
                          <p dir="ltr" className="mt-1 break-all font-black">
                            {payment.reference || "-"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#4d6767]">
                        {invoiceCopy.paidTotal}
                      </span>
                      <strong dir="ltr">
                        {formatInvoiceMoney(paidTotal, invoiceLocale)}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#4d6767]">
                        {invoiceCopy.remaining}
                      </span>
                      <strong dir="ltr">
                        {formatInvoiceMoney(remainingTotal, invoiceLocale)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div data-pdf-keep className="mt-12">
                <div className="grid grid-cols-2 gap-10">
                  <div className="border-t pt-3 text-center text-xs font-semibold text-[#4d6767]">
                    {invoiceCopy.officeSignature}
                  </div>
                  <div className="border-t pt-3 text-center text-xs font-semibold text-[#4d6767]">
                    {invoiceCopy.clientSignature}
                  </div>
                </div>

                <div
                  className="mt-8 flex flex-col gap-3 border-t pt-4 text-[11px] text-[#4d6767] sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderColor: "#edf4f3" }}
                >
                  <span>{invoiceCopy.generatedBy}</span>
                  <span dir="ltr">
                    {formatInvoiceNumber(invoice.invoiceNumber)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
          onClick={() => setEditOpen(false)}
        >
          <form
            onSubmit={submitEdit}
            onClick={(e) => e.stopPropagation()}
            className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2
                  className="text-xl font-black"
                  style={{ color: "var(--text)" }}
                >
                  {ui.editTitle}
                </h2>

                <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
                  {ui.editSubtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-bold hover:bg-black/5"
              >
                ✕
              </button>
            </div>

            {!canEditFinancials && (
              <div
                className="mb-4 rounded-2xl border p-4 text-sm font-bold"
                style={{
                  borderColor: "#fbbf24",
                  background: "var(--amber-soft)",
                  color: "#92400e",
                }}
              >
                {ui.editLockedNotice}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-bold">{ui.dueDate}</span>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="input"
                  disabled={!canEditFinancials}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">{ui.tax}</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={editTax}
                  onChange={(e) => setEditTax(Number(e.target.value || 0))}
                  className="input"
                  disabled={!canEditFinancials}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">{ui.discount}</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(Number(e.target.value || 0))}
                  className="input"
                  disabled={!canEditFinancials}
                />
              </label>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-black" style={{ color: "var(--text)" }}>
                  {ui.items}
                </h3>

                <button
                  type="button"
                  onClick={addEditItem}
                  className="btn btn-ghost"
                  disabled={!canEditFinancials}
                >
                  {ui.addItem}
                </button>
              </div>

              <div className="space-y-3">
                {editItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border p-3 md:grid-cols-[1fr_120px_140px_90px]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateEditItem(index, "description", e.target.value)
                      }
                      placeholder={ui.itemDescription}
                      className="input"
                      disabled={!canEditFinancials}
                    />

                    <input
                      type="number"
                      min="0.01"
                      step="0.001"
                      value={item.quantity}
                      onChange={(e) =>
                        updateEditItem(index, "quantity", e.target.value)
                      }
                      placeholder={ui.quantity}
                      className="input"
                      disabled={!canEditFinancials}
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateEditItem(index, "unitPrice", e.target.value)
                      }
                      placeholder={ui.unitPrice}
                      className="input"
                      disabled={!canEditFinancials}
                    />

                    <button
                      type="button"
                      onClick={() => removeEditItem(index)}
                      className="rounded-xl px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                      disabled={!canEditFinancials || editItems.length === 1}
                    >
                      {ui.delete}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-bold">{ui.notes}</span>

              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                className="input min-h-28"
                disabled={!canEditFinancials}
              />
            </label>

            <div className="mt-5 flex justify-end">
              <div
                className="w-full max-w-sm space-y-2 rounded-2xl border p-4"
                style={{ borderColor: "var(--border)" }}
              >
                <MoneyLine
                  label={ui.subtotal}
                  value={editSubtotal}
                  locale={appLocale}
                />
                <MoneyLine
                  label={ui.tax}
                  value={Number(editTax || 0)}
                  locale={appLocale}
                />
                <MoneyLine
                  label={ui.discount}
                  value={Number(editDiscount || 0)}
                  locale={appLocale}
                />

                <div className="flex justify-between border-t pt-2 text-lg font-black">
                  <span>{ui.total}</span>
                  <span dir={appIsRtl ? "rtl" : "ltr"}>
                    {formatInvoiceMoney(editTotal, appLocale)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="btn btn-ghost"
              >
                {ui.cancel}
              </button>

              <button
                type="submit"
                disabled={saving || !canEditFinancials}
                className="btn btn-primary"
              >
                {saving ? ui.saving : ui.saveChanges}
              </button>
            </div>
          </form>
        </div>
      )}

      <FinanceSuccessOverlay
        open={!!successMotion}
        kind={successMotion?.kind || "update"}
        title={successMotion?.title || ""}
        subtitle={successMotion?.subtitle}
        status={successMotion?.status}
        onComplete={() => setSuccessMotion(null)}
      />
    </div>
  );
}

function InfoCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "green" | "amber" | "red";
}) {
  const style =
    tone === "green"
      ? {
          background: "var(--green-soft)",
          color: "var(--sidebar)",
        }
      : tone === "amber"
        ? {
            background: "var(--amber-soft)",
            color: "#92400e",
          }
        : tone === "red"
          ? {
              background: "var(--red-soft)",
              color: "#dc2626",
            }
          : {
              background: "var(--card)",
              color: "var(--text)",
            };

  return (
    <div
      className="card p-5 text-start"
      style={{
        background: style.background,
        borderColor: "var(--border)",
      }}
    >
      <p className="text-xs font-black" style={{ color: style.color }}>
        {label}
      </p>

      <p className="mt-2 text-2xl font-black" style={{ color: style.color }}>
        {value}
      </p>

      <p className="mt-1 text-xs font-bold" style={{ color: "var(--text-3)" }}>
        {hint}
      </p>
    </div>
  );
}

function MiniLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
      }}
    >
      <p className="text-xs font-black" style={{ color: "var(--text-3)" }}>
        {label}
      </p>

      <p
        className="mt-1 break-words text-sm font-bold"
        style={{ color: value ? "var(--text)" : "var(--text-3)" }}
      >
        {value || "-"}
      </p>
    </div>
  );
}

function MoneyLine({
  label,
  value,
  locale,
}: {
  label: string;
  value: number;
  locale: Locale;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <strong dir={locale === "ar" ? "rtl" : "ltr"}>
        {formatInvoiceMoney(value, locale)}
      </strong>
    </div>
  );
}
