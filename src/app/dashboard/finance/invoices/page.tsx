"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import AppLoader from "@/components/ui/AppLoader";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { useLocale } from "@/lib/useLocale";
import SubscriptionReadOnlyBanner from "@/components/billing/SubscriptionReadOnlyBanner";
import { useTenantWriteAccess } from "@/hooks/useTenantWriteAccess";
import type { Locale } from "@/lib/i18n";
import { formatInvoiceNumber } from "@/lib/invoice-print";

type InvoiceStatus =
  | "DRAFT"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

interface ClientOption {
  id: string;
  name: string;
  archivedAt?: string | null;
}

interface CaseOption {
  id: string;
  title: string;
  caseNumber?: string | null;
  clientId: string;
  client?: {
    id?: string;
    name?: string;
    archivedAt?: string | null;
  } | null;
}

interface InvoiceItem {
  preset: string;
  description: string;
  quantity: string;
  unitPrice: string;
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
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
    paidAt?: string | null;
    reference?: string | null;
  }>;
}

const COPY = {
  ar: {
    hero: {
      badge: "إدارة الفواتير",
      title: "الفواتير",
      subtitle:
        "إنشاء وإدارة فواتير الموكلين والقضايا، متابعة الحالات المالية، وطباعة أو إرسال الفواتير بسهولة.",
    },
    actions: {
      create: "+ إنشاء فاتورة",
      refresh: "تحديث",
      search: "بحث",
      clear: "مسح",
      clearFilters: "مسح الفلاتر",
      view: "عرض",
      print: "🖨️ طباعة",
      whatsapp: "واتساب",
      delete: "حذف",
      addItem: "+ إضافة بند",
      saveInvoice: "حفظ الفاتورة",
      saving: "جارٍ الحفظ...",
      close: "إغلاق",
    },
    stats: {
      totalInvoices: "عدد الفواتير",
      allInvoices: "كل الفواتير",
      totalAmount: "إجمالي الفواتير",
      totalValue: "القيمة الكلية",
      paid: "المدفوع",
      invoice: (count: number) => `${count} فاتورة`,
      unpaid: "غير المحصل",
      unpaidHint: "غير مدفوعة/متأخرة",
      overdue: "المتأخرة",
      overdueHint: "تحتاج متابعة",
      archivedClients: "موكلون مؤرشفون",
      archivedHint: "فواتير سجلات مؤرشفة",
    },
    filters: {
      searchPlaceholder: "بحث برقم الفاتورة أو الموكل أو القضية...",
      statusAria: "فلترة الفواتير حسب الحالة",
      allStatuses: "كل الحالات",
      archivedClient: "موكل مؤرشف",
    },
    empty: {
      title: "لا توجد فواتير",
      first: "ابدأ بإنشاء أول فاتورة لموكل أو قضية",
      filtered: "لا توجد نتائج مطابقة للفلاتر الحالية",
    },
    list: {
      title: "قائمة الفواتير",
      count: (count: number) => `${count} فاتورة ضمن النتائج الحالية`,
      archivedOnly: "فواتير موكلين مؤرشفين",
      overdueCount: (count: number) => `${count} فاتورة متأخرة`,
      noOverdue: "لا توجد فواتير متأخرة",
      archivedRecord: "سجل مؤرشف",
      archivedClient: "موكل مؤرشف",
      paidPayment: "دفعة مدفوعة",
      pendingPayment: "دفعة معلّقة",
    },
    table: {
      invoiceNumber: "رقم الفاتورة",
      client: "الموكل",
      case: "القضية",
      total: "الإجمالي",
      status: "الحالة",
      issueDate: "الإصدار",
      dueDate: "الاستحقاق",
      actions: "إجراءات",
    },
    statuses: {
      DRAFT: "مسودة",
      UNPAID: "غير مدفوعة",
      PAID: "مدفوعة",
      OVERDUE: "متأخرة",
      CANCELLED: "ملغاة",
      PARTIALLY_PAID: "مدفوعة جزئيًا",
    } as Record<InvoiceStatus, string>,
    modal: {
      title: "إنشاء فاتورة جديدة",
      subtitle: "أضف بيانات الفاتورة والبنود المالية",
      client: "الموكل",
      chooseClient: "اختر الموكل",
      case: "القضية",
      noCase: "بدون قضية",
      archivedWarning:
        "سيتم إنشاء الفاتورة لموكل مؤرشف. يمكن التحصيل والتعديل، لكن لا يمكن حذف الفاتورة لاحقًا لحماية السجل المالي.",
      dueDate: "تاريخ الاستحقاق",
      notes: "ملاحظات",
      notesPlaceholder: "مثال: الدفعة الأولى من الأتعاب",
      items: "بنود الفاتورة",
      itemType: "نوع البند",
      chooseItem: "اختر بندًا من القائمة",
      customItem: "بند مخصص",
      customDescription: "وصف البند المخصص",
      itemDescription: "وصف البند",
      quantity: "الكمية",
      quantityPlaceholder: "مثال: 1",
      unitPrice: "سعر الوحدة (د.أ)",
      unitPricePlaceholder: "مثال: 250",
      lineTotal: "إجمالي البند",
      tax: "الضريبة",
      taxPlaceholder: "مثال: 0",
      discount: "الخصم",
      discountPlaceholder: "مثال: 0",
      finalTotal: "الإجمالي النهائي",
    },
    messages: {
      chooseClient: "اختار الموكل",
      archivedCreateBlocked:
        "يمكن إنشاء فاتورة لموكل مؤرشف، لكن لا يمكن حذفها لاحقًا لحماية السجل المالي.",
      addOneItem: "أضف بند واحد على الأقل",
      createError: "حدث خطأ أثناء إنشاء الفاتورة",
      archivedStatusBlocked:
        "يمكن تعديل حالة فاتورة الموكل المؤرشف، لكن لا يمكن حذفها لحماية السجل المالي.",
      paidNeedsCase: "لا يمكن تعليم الفاتورة كمدفوعة لأنها غير مرتبطة بقضية",
      paidLinkedPaymentConfirm:
        "سيتم تسجيل دفعة مرتبطة بالقضية عند تعليم الفاتورة كمدفوعة. هل تريد المتابعة؟",
      statusUpdateError: "تعذر تحديث حالة الفاتورة",
      archivedDeleteBlocked: "لا يمكن حذف فاتورة مرتبطة بموكل مؤرشف",
      linkedPaymentDeleteBlocked:
        "لا يمكن حذف فاتورة مرتبطة بدفعة. غيّر حالة الفاتورة أو احذف الدفعة المرتبطة أولًا.",
      confirmDelete: "هل أنت متأكد من حذف هذه الفاتورة؟",
      deleteError: "تعذر حذف الفاتورة",
      noPhone: "لا يوجد رقم هاتف محفوظ لهذا الموكل",
      deleteTitleArchived: "لا يمكن حذف فاتورة مرتبطة بموكل مؤرشف",
      deleteTitlePayment: "لا يمكن حذف فاتورة مرتبطة بدفعة",
      deleteTitle: "حذف الفاتورة",
      changeStatusAria: (invoiceNumber: string) =>
        `تغيير حالة الفاتورة ${invoiceNumber}`,
    },
  },
  en: {
    hero: {
      badge: "Invoice management",
      title: "Invoices",
      subtitle:
        "Create and manage client and case invoices, track financial statuses, and print or send invoices easily.",
    },
    actions: {
      create: "+ Create invoice",
      refresh: "Refresh",
      search: "Search",
      clear: "Clear",
      clearFilters: "Clear filters",
      view: "View",
      print: "🖨️ Print",
      whatsapp: "WhatsApp",
      delete: "Delete",
      addItem: "+ Add item",
      saveInvoice: "Save invoice",
      saving: "Saving...",
      close: "Close",
    },
    stats: {
      totalInvoices: "Invoice count",
      allInvoices: "All invoices",
      totalAmount: "Total invoices",
      totalValue: "Total value",
      paid: "Paid",
      invoice: (count: number) => `${count} invoice${count === 1 ? "" : "s"}`,
      unpaid: "Uncollected",
      unpaidHint: "Unpaid/overdue",
      overdue: "Overdue",
      overdueHint: "Needs follow-up",
      archivedClients: "Archived clients",
      archivedHint: "Archived-record invoices",
    },
    filters: {
      searchPlaceholder: "Search by invoice number, client, or case...",
      statusAria: "Filter invoices by status",
      allStatuses: "All statuses",
      archivedClient: "Archived client",
    },
    empty: {
      title: "No invoices",
      first: "Create the first invoice for a client or case",
      filtered: "No invoices match the current filters",
    },
    list: {
      title: "Invoice list",
      count: (count: number) =>
        `${count} invoice${count === 1 ? "" : "s"} in the current results`,
      archivedOnly: "Invoices for archived clients",
      overdueCount: (count: number) =>
        `${count} overdue invoice${count === 1 ? "" : "s"}`,
      noOverdue: "No overdue invoices",
      archivedRecord: "Archived record",
      archivedClient: "Archived client",
      paidPayment: "Paid payment",
      pendingPayment: "Pending payment",
    },
    table: {
      invoiceNumber: "Invoice number",
      client: "Client",
      case: "Case",
      total: "Total",
      status: "Status",
      issueDate: "Issue date",
      dueDate: "Due date",
      actions: "Actions",
    },
    statuses: {
      DRAFT: "Draft",
      UNPAID: "Unpaid",
      PAID: "Paid",
      OVERDUE: "Overdue",
      CANCELLED: "Cancelled",
      PARTIALLY_PAID: "Partially paid",
    } as Record<InvoiceStatus, string>,
    modal: {
      title: "Create new invoice",
      subtitle: "Add invoice details and financial items",
      client: "Client",
      chooseClient: "Choose client",
      case: "Case",
      noCase: "No case",
      archivedWarning:
        "This invoice will be created for an archived client. Collection and editing are allowed, but deletion is blocked to protect the financial record.",
      dueDate: "Due date",
      notes: "Notes",
      notesPlaceholder: "Example: first legal-fee installment",
      items: "Invoice items",
      itemType: "Item type",
      chooseItem: "Choose an item",
      customItem: "Custom item",
      customDescription: "Custom item description",
      itemDescription: "Item description",
      quantity: "Quantity",
      quantityPlaceholder: "Example: 1",
      unitPrice: "Unit price (JOD)",
      unitPricePlaceholder: "Example: 250",
      lineTotal: "Line total",
      tax: "Tax",
      taxPlaceholder: "Example: 0",
      discount: "Discount",
      discountPlaceholder: "Example: 0",
      finalTotal: "Final total",
    },
    messages: {
      chooseClient: "Choose a client",
      archivedCreateBlocked:
        "You can create an invoice for an archived client, but it cannot be deleted later to protect the financial record.",
      addOneItem: "Add at least one item",
      createError: "An error occurred while creating the invoice",
      archivedStatusBlocked:
        "You can update the status of an archived-client invoice, but it cannot be deleted to protect the financial record.",
      paidNeedsCase:
        "The invoice cannot be marked as paid because it is not linked to a case",
      paidLinkedPaymentConfirm:
        "This invoice is paid and linked to a payment. The linked payment status will be updated according to the new status. Continue?",
      statusUpdateError: "Could not update invoice status",
      archivedDeleteBlocked:
        "Cannot delete an invoice linked to an archived client",
      linkedPaymentDeleteBlocked:
        "Cannot delete an invoice linked to a payment. Change the invoice status or delete the linked payment first.",
      confirmDelete: "Are you sure you want to delete this invoice?",
      deleteError: "Could not delete invoice",
      noPhone: "No phone number is saved for this client",
      deleteTitleArchived:
        "Cannot delete an invoice linked to an archived client",
      deleteTitlePayment: "Cannot delete an invoice linked to a payment",
      deleteTitle: "Delete invoice",
      changeStatusAria: (invoiceNumber: string) =>
        `Change invoice status ${invoiceNumber}`,
    },
  },
};

const INVOICE_ITEM_PRESETS: Record<
  Locale,
  Array<{ value: string; label: string }>
> = {
  ar: [
    { value: "LEGAL_CONSULTATION", label: "أتعاب استشارة قانونية" },
    { value: "CASE_OPENING", label: "أتعاب فتح ومتابعة قضية" },
    { value: "COURT_SESSION", label: "أتعاب حضور جلسة محكمة" },
    { value: "PLEADING_MEMO", label: "إعداد لائحة دعوى أو مذكرة قانونية" },
    { value: "CONTRACT_DRAFTING", label: "صياغة عقد أو اتفاقية" },
    { value: "DOCUMENT_REVIEW", label: "مراجعة عقد أو مستندات" },
    { value: "LEGAL_NOTICE", label: "إعداد إنذار عدلي أو إخطار قانوني" },
    { value: "LEGAL_REPRESENTATION", label: "تمثيل قانوني ومتابعة إجراءات" },
    { value: "COMPANY_REGISTRATION", label: "تسجيل شركة أو معاملة رسمية" },
    { value: "LEGAL_FEES_INSTALLMENT", label: "دفعة من الأتعاب القانونية" },
    { value: "COURT_FEES", label: "رسوم ومصاريف قضائية" },
    { value: "OTHER_EXPENSES", label: "مصاريف إدارية أو خدمات أخرى" },
  ],
  en: [
    { value: "LEGAL_CONSULTATION", label: "Legal consultation fee" },
    { value: "CASE_OPENING", label: "Case opening and follow-up fee" },
    { value: "COURT_SESSION", label: "Court session attendance fee" },
    {
      value: "PLEADING_MEMO",
      label: "Pleading or legal memorandum preparation",
    },
    { value: "CONTRACT_DRAFTING", label: "Contract or agreement drafting" },
    { value: "DOCUMENT_REVIEW", label: "Contract or document review" },
    { value: "LEGAL_NOTICE", label: "Legal notice preparation" },
    {
      value: "LEGAL_REPRESENTATION",
      label: "Legal representation and follow-up",
    },
    {
      value: "COMPANY_REGISTRATION",
      label: "Company registration or official transaction",
    },
    { value: "LEGAL_FEES_INSTALLMENT", label: "Legal-fee installment" },
    { value: "COURT_FEES", label: "Court fees and expenses" },
    {
      value: "OTHER_EXPENSES",
      label: "Administrative or other service expenses",
    },
  ],
};

const statusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "مسودة",
  UNPAID: "غير مدفوعة",
  PAID: "مدفوعة",
  OVERDUE: "متأخرة",
  CANCELLED: "ملغاة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
};

const STATUS_OPTIONS: Array<{ value: "" | InvoiceStatus; label: string }> = [
  { value: "", label: "كل الحالات" },
  { value: "DRAFT", label: "مسودة" },
  { value: "UNPAID", label: "غير مدفوعة" },
  { value: "PARTIALLY_PAID", label: "مدفوعة جزئيًا" },
  { value: "PAID", label: "مدفوعة" },
  { value: "OVERDUE", label: "متأخرة" },
  { value: "CANCELLED", label: "ملغاة" },
];

function safeList(data: any) {
  const candidates = [
    data,
    data?.data?.data,
    data?.data,
    data?.items,
    data?.clients,
    data?.cases,
    data?.invoices,
    data?.data?.items,
    data?.data?.clients,
    data?.data?.cases,
    data?.data?.invoices,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function getMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback;
}

function isArchivedInvoice(invoice: Invoice) {
  return Boolean(
    invoice.client?.archivedAt || invoice.case?.client?.archivedAt,
  );
}

function money(value: number, locale: Locale) {
  if (!Number.isFinite(value) || value === 0) {
    return locale === "ar" ? "0.000 د.أ" : "JOD 0.000";
  }

  if (locale === "ar") return formatCurrency(value);

  return `JOD ${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

function localizedDate(value: string | Date, locale: Locale) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getBlockFallback(locale: Locale) {
  return locale === "en"
    ? "The subscription has ended. This page is available in read-only mode until renewal."
    : "انتهى الاشتراك. هذه الصفحة متاحة للقراءة فقط إلى حين التجديد.";
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  ariaLabel: string;
  disabled?: boolean;
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isSameCalendarDay(first: Date | null, second: Date) {
  return Boolean(
    first &&
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate(),
  );
}

function DatePicker({
  value,
  onChange,
  locale,
  ariaLabel,
  disabled = false,
}: DatePickerProps) {
  const isRtl = locale === "ar";
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<{ id: string; number?: string; status?: string } | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  const selectedDate = useMemo(() => parseDateValue(value), [value]);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1, 12);
  });

  const pickerCopy =
    locale === "ar"
      ? {
          placeholder: "اختر تاريخ الاستحقاق",
          previousMonth: "الشهر السابق",
          nextMonth: "الشهر التالي",
          clear: "مسح",
          today: "اليوم",
          done: "تم",
          weekdays: ["أح", "إث", "ث", "أر", "خ", "ج", "س"],
        }
      : {
          placeholder: "Select due date",
          previousMonth: "Previous month",
          nextMonth: "Next month",
          clear: "Clear",
          today: "Today",
          done: "Done",
          weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
        };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedDate) return;

    setViewMonth(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12),
    );
  }, [selectedDate]);

  const updatePopoverPosition = useCallback(() => {
    const button = buttonRef.current;

    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const width = Math.min(360, window.innerWidth - viewportPadding * 2);
    const estimatedHeight = Math.min(
      390,
      window.innerHeight - viewportPadding * 2,
    );
    const availableAbove = rect.top - viewportPadding;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const shouldOpenAbove =
      availableAbove > availableBelow && availableAbove >= 280;

    const top = shouldOpenAbove
      ? Math.max(viewportPadding, rect.top - estimatedHeight - gap)
      : Math.min(
          window.innerHeight - estimatedHeight - viewportPadding,
          rect.bottom + gap,
        );

    const preferredLeft = isRtl ? rect.right - width : rect.left;
    const left = Math.max(
      viewportPadding,
      Math.min(preferredLeft, window.innerWidth - width - viewportPadding),
    );

    setPopoverStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight: estimatedHeight,
      zIndex: 10000,
    });
  }, [isRtl]);

  useEffect(() => {
    if (!open) return;

    updatePopoverPosition();

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const handleViewportChange = () => updatePopoverPosition();

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updatePopoverPosition]);

  const calendarDays = useMemo(() => {
    const monthStart = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      1,
      12,
    );
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [viewMonth]);

  const monthLabel = new Intl.DateTimeFormat(
    locale === "ar" ? "ar-JO" : "en-US",
    {
      month: "long",
      year: "numeric",
    },
  ).format(viewMonth);

  const displayValue = selectedDate
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(selectedDate)
    : pickerCopy.placeholder;

  const selectDate = (date: Date) => {
    onChange(toDateValue(date));
  };

  const selectToday = () => {
    const today = new Date();
    onChange(toDateValue(today));
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12));
  };

  const popover =
    open && mounted
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={ariaLabel}
            dir={isRtl ? "rtl" : "ltr"}
            className="overflow-auto rounded-3xl border p-4 shadow-2xl"
            style={{
              ...popoverStyle,
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--text)",
              boxShadow: "0 24px 70px rgba(0, 0, 0, 0.32)",
            }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setViewMonth(
                    (current) =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() - 1,
                        1,
                        12,
                      ),
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-2xl border text-lg font-black"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
                aria-label={pickerCopy.previousMonth}
              >
                {isRtl ? "›" : "‹"}
              </button>

              <p className="text-sm font-black">{monthLabel}</p>

              <button
                type="button"
                onClick={() =>
                  setViewMonth(
                    (current) =>
                      new Date(
                        current.getFullYear(),
                        current.getMonth() + 1,
                        1,
                        12,
                      ),
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-2xl border text-lg font-black"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
                aria-label={pickerCopy.nextMonth}
              >
                {isRtl ? "‹" : "›"}
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {pickerCopy.weekdays.map((weekday) => (
                <span
                  key={weekday}
                  className="py-1 text-[11px] font-black"
                  style={{ color: "var(--text-3)" }}
                >
                  {weekday}
                </span>
              ))}

              {calendarDays.map((day) => {
                const isCurrentMonth =
                  day.getMonth() === viewMonth.getMonth() &&
                  day.getFullYear() === viewMonth.getFullYear();
                const isSelected = isSameCalendarDay(selectedDate, day);
                const isToday = isSameCalendarDay(new Date(), day);

                return (
                  <button
                    key={toDateValue(day)}
                    type="button"
                    onClick={() => selectDate(day)}
                    className="relative flex h-10 items-center justify-center rounded-xl text-sm font-black transition"
                    style={{
                      background: isSelected
                        ? "var(--sidebar)"
                        : isToday
                          ? "var(--green-soft)"
                          : "transparent",
                      color: isSelected
                        ? "#fff"
                        : isCurrentMonth
                          ? "var(--text)"
                          : "var(--text-3)",
                      opacity: isCurrentMonth ? 1 : 0.55,
                      border: isToday
                        ? "1px solid var(--border)"
                        : "1px solid transparent",
                    }}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="btn btn-ghost flex-1"
              >
                {pickerCopy.clear}
              </button>

              <button
                type="button"
                onClick={selectToday}
                className="btn btn-ghost flex-1"
              >
                {pickerCopy.today}
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-primary flex-1"
              >
                {pickerCopy.done}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        disabled={disabled}
        className="input flex w-full items-center justify-between gap-3 text-start disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          className="truncate"
          style={{
            color: selectedDate ? "var(--text)" : "var(--text-3)",
          }}
        >
          {displayValue}
        </span>

        <span aria-hidden="true" className="shrink-0 text-base">
          📅
        </span>
      </button>

      {popover}
    </>
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

export default function InvoicesPage() {
  const router = useRouter();
  const localeState = useLocale() as { locale?: Locale };
  const locale = localeState?.locale === "en" ? "en" : "ar";
  const isRtl = locale === "ar";
  const writeAccess = useTenantWriteAccess(locale);
  const copy = COPY[locale];
  const invoiceItemPresets = INVOICE_ITEM_PRESETS[locale];

  const fieldStyle = {
    textAlign: isRtl ? "right" : "left",
    direction: isRtl ? "rtl" : "ltr",
  } as CSSProperties;

  const numberFieldStyle = {
    // Keep numeric characters LTR, but align the content with the UI language.
    textAlign: isRtl ? "right" : "left",
    direction: "ltr",
  } as CSSProperties;

  const moneyDisplayStyle = {
    textAlign: isRtl ? "right" : "left",
    direction: isRtl ? "rtl" : "ltr",
  } as CSSProperties;

  const statusOptions: Array<{ value: "" | InvoiceStatus; label: string }> = [
    { value: "", label: copy.filters.allStatuses },
    { value: "DRAFT", label: copy.statuses.DRAFT },
    { value: "UNPAID", label: copy.statuses.UNPAID },
    { value: "PARTIALLY_PAID", label: copy.statuses.PARTIALLY_PAID },
    { value: "PAID", label: copy.statuses.PAID },
    { value: "OVERDUE", label: copy.statuses.OVERDUE },
    { value: "CANCELLED", label: copy.statuses.CANCELLED },
  ];

  const formatMoney = (value: number) => money(value, locale);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<{ id: string; number?: string; status?: string } | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const [archivedOnly, setArchivedOnly] = useState(false);

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tax, setTax] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { preset: "", description: "", quantity: "", unitPrice: "" },
  ]);

  const filteredCases = useMemo(() => {
    if (!clientId) return [];

    return cases.filter((item) => item.clientId === clientId);
  }, [cases, clientId]);

  const selectedClient = useMemo(() => {
    return clients.find((client) => client.id === clientId);
  }, [clients, clientId]);

  const selectedCase = useMemo(() => {
    return cases.find((item) => item.id === caseId);
  }, [cases, caseId]);

  const selectedClientArchived = Boolean(selectedClient?.archivedAt);
  const selectedCaseArchived = Boolean(selectedCase?.client?.archivedAt);
  const selectedArchivedContext =
    selectedClientArchived || selectedCaseArchived;

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
    }, 0);
  }, [items]);

  const total = Math.max(
    subtotal + Number(tax || 0) - Number(discount || 0),
    0,
  );

  const visibleInvoices = useMemo(() => {
    if (!archivedOnly) return invoices;

    return invoices.filter(isArchivedInvoice);
  }, [invoices, archivedOnly]);

  const stats = useMemo(() => {
    const totalAmount = invoices.reduce((sum, invoice) => {
      return sum + Number(invoice.total || 0);
    }, 0);

    const paidAmount = invoices.reduce((sum, invoice) => {
      const invoicePaid = invoice.payments
        .filter((payment) => payment.status === "PAID")
        .reduce((paymentSum, payment) => {
          return paymentSum + Number(payment.amount || 0);
        }, 0);

      return sum + invoicePaid;
    }, 0);

    const unpaidAmount = invoices
      .filter((invoice) =>
        ["UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status),
      )
      .reduce((sum, invoice) => {
        const invoicePaid = invoice.payments
          .filter((payment) => payment.status === "PAID")
          .reduce((paymentSum, payment) => {
            return paymentSum + Number(payment.amount || 0);
          }, 0);

        return sum + Math.max(0, Number(invoice.total || 0) - invoicePaid);
      }, 0);

    const overdueCount = invoices.filter(
      (invoice) => invoice.status === "OVERDUE",
    ).length;
    const paidCount = invoices.filter(
      (invoice) => invoice.status === "PAID",
    ).length;
    const archivedCount = invoices.filter(isArchivedInvoice).length;

    return {
      totalAmount,
      paidAmount,
      unpaidAmount,
      overdueCount,
      paidCount,
      archivedCount,
      totalCount: invoices.length,
    };
  }, [invoices]);

  async function load() {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);

      const [invoiceRes, clientRes, caseRes] = await Promise.all([
        fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/clients?limit=100&includeArchivedClients=true", {
          cache: "no-store",
        }),
        fetch("/api/cases?limit=100&includeArchivedClients=true", {
          cache: "no-store",
        }),
      ]);

      if (
        invoiceRes.status === 401 ||
        clientRes.status === 401 ||
        caseRes.status === 401
      ) {
        window.location.href = "/login";
        return;
      }

      const invoiceData = invoiceRes.ok
        ? await invoiceRes.json().catch(() => ({}))
        : {};
      const clientData = clientRes.ok
        ? await clientRes.json().catch(() => ({}))
        : {};
      const caseData = caseRes.ok ? await caseRes.json().catch(() => ({})) : {};

      if (!invoiceRes.ok)
        console.error("Invoices request failed:", invoiceRes.status);
      if (!clientRes.ok)
        console.error("Clients request failed:", clientRes.status);
      if (!caseRes.ok) console.error("Cases request failed:", caseRes.status);

      setInvoices(safeList(invoiceData));
      setClients(safeList(clientData));
      setCases(safeList(caseData));
    } catch (error) {
      console.error("Invoices load failed:", error);
      setInvoices([]);
      setClients([]);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setClientId("");
    setCaseId("");
    setDueDate("");
    setTax("");
    setDiscount("");
    setNotes("");
    setItems([{ preset: "", description: "", quantity: "", unitPrice: "" }]);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    resetForm();
  }

  function updateItem(index: number, key: keyof InvoiceItem, value: string) {
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    );
  }

  function updateItemPreset(index: number, preset: string) {
    const selectedPreset = invoiceItemPresets.find(
      (item) => item.value === preset,
    );

    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              preset,
              description:
                preset === "CUSTOM" ? "" : selectedPreset?.label || "",
            }
          : item,
      ),
    );
  }

  function addItem() {
    setItems((previous) => [
      ...previous,
      { preset: "", description: "", quantity: "", unitPrice: "" },
    ]);
  }

  function removeItem(index: number) {
    setItems((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function createInvoice(event: FormEvent) {
    event.preventDefault();

    if (!writeAccess.canWrite) {
      toast.error(writeAccess.message || getBlockFallback(locale));
      return;
    }

    if (!clientId) {
      toast.error(copy.messages.chooseClient);
      return;
    }

    const cleanItems = items
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
      }));

    if (cleanItems.length === 0) {
      toast.error(copy.messages.addOneItem);
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          caseId: caseId || null,
          dueDate: dueDate || null,
          tax: Number(tax || 0),
          discount: Number(discount || 0),
          notes,
          items: cleanItems,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(getMessage(data, copy.messages.createError));
        return;
      }

      const created = data?.data ?? data?.invoice ?? data;
      const createdId = String(created?.publicId ?? created?.id ?? "");
      setOpen(false);
      resetForm();
      setSuccessInvoice({
        id: createdId,
        number: created?.invoiceNumber,
        status: created?.status || "UNPAID",
      });
      await load();
    } catch {
      toast.error(copy.messages.createError);
    } finally {
      setSaving(false);
    }
  }

  function openInvoice(invoice: Invoice) {
    const invoiceId = invoice.publicId ?? invoice.id;
    if (!invoiceId) return;
    router.push(`/dashboard/finance/invoices/${invoiceId}`);
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setArchivedOnly(false);
    setTimeout(load, 0);
  }

  if (!mounted || loading) {
    return <AppLoader fullScreen={false} />;
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 stagger">
      <SubscriptionReadOnlyBanner
        visible={!writeAccess.canWrite}
        message={writeAccess.message}
        isRtl={isRtl}
      />
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6"
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

        <div className="relative z-10 flex min-h-[126px] flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {copy.hero.badge}
            </div>

            <h1 className="text-2xl font-black text-white">
              {copy.hero.title}
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              {copy.hero.subtitle}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-center xl:self-auto">
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={!writeAccess.canWrite}
              title={
                !writeAccess.canWrite
                  ? writeAccess.message || getBlockFallback(locale)
                  : copy.actions.create
              }
              className="btn disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "#fff",
                color: "var(--sidebar)",
                borderColor: "rgba(255,255,255,0.32)",
              }}
            >
              {copy.actions.create}
            </button>

            <button
              type="button"
              onClick={load}
              className="btn"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.22)",
              }}
            >
              {copy.actions.refresh}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          {
            label: copy.stats.totalInvoices,
            value: stats.totalCount,
            hint: copy.stats.allInvoices,
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: copy.stats.totalAmount,
            value: formatMoney(stats.totalAmount),
            hint: copy.stats.totalValue,
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: copy.stats.paid,
            value: formatMoney(stats.paidAmount),
            hint: copy.stats.invoice(stats.paidCount),
            color: "var(--sidebar)",
            bg: "var(--green-soft)",
          },
          {
            label: copy.stats.unpaid,
            value: formatMoney(stats.unpaidAmount),
            hint: copy.stats.unpaidHint,
            color: stats.unpaidAmount > 0 ? "#92400e" : "var(--text-3)",
            bg: stats.unpaidAmount > 0 ? "var(--amber-soft)" : "var(--card)",
          },
          {
            label: copy.stats.overdue,
            value: stats.overdueCount,
            hint: copy.stats.overdueHint,
            color: stats.overdueCount > 0 ? "#dc2626" : "var(--text)",
            bg: stats.overdueCount > 0 ? "var(--red-soft)" : "var(--card)",
          },
          {
            label: copy.stats.archivedClients,
            value: stats.archivedCount,
            hint: copy.stats.archivedHint,
            color: stats.archivedCount > 0 ? "#b45309" : "var(--text)",
            bg:
              stats.archivedCount > 0
                ? "rgba(180, 83, 9, 0.14)"
                : "var(--card)",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5"
            style={{
              background: item.bg,
              borderColor: "var(--border)",
            }}
          >
            <p className="text-xs font-black" style={{ color: item.color }}>
              {item.label}
            </p>

            <p
              className="mt-2 text-2xl font-black"
              style={{ color: item.color }}
            >
              {item.value}
            </p>

            <p
              className="mt-1 text-xs font-bold"
              style={{ color: "var(--text-3)" }}
            >
              {item.hint}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_.8fr_auto_auto_auto]">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={copy.filters.searchPlaceholder}
            dir={isRtl ? "rtl" : "ltr"}
            style={fieldStyle}
            className="input"
          />

          <select
            aria-label={copy.filters.statusAria}
            dir={isRtl ? "rtl" : "ltr"}
            style={fieldStyle}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "" | InvoiceStatus)
            }
            className="input"
          >
            {statusOptions.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={load}
            className="btn btn-primary whitespace-nowrap"
          >
            {copy.actions.search}
          </button>

          <button
            type="button"
            onClick={() => setArchivedOnly((previous) => !previous)}
            className="btn whitespace-nowrap"
            style={
              archivedOnly
                ? {
                    background: "#b45309",
                    color: "#fff",
                    borderColor: "rgba(180, 83, 9, 0.25)",
                  }
                : {
                    background: "#fff7ed",
                    color: "#b45309",
                    borderColor: "rgba(180, 83, 9, 0.18)",
                  }
            }
          >
            {copy.filters.archivedClient}
          </button>

          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-ghost whitespace-nowrap"
          >
            {copy.actions.clear}
          </button>
        </div>
      </div>

      {/* Content */}
      {visibleInvoices.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="🧾"
            title={copy.empty.title}
            sub={invoices.length === 0 ? copy.empty.first : copy.empty.filtered}
            action={
              invoices.length === 0 ? (
                <button
                  onClick={() => setOpen(true)}
                  disabled={!writeAccess.canWrite}
                  title={
                    !writeAccess.canWrite
                      ? writeAccess.message || getBlockFallback(locale)
                      : copy.actions.create
                  }
                  className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copy.actions.create}
                </button>
              ) : (
                <button onClick={clearFilters} className="btn btn-ghost">
                  {copy.actions.clearFilters}
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div
            className="flex flex-col gap-2 border-b px-5 py-4 md:flex-row md:items-center md:justify-between"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <h2 className="font-black" style={{ color: "var(--text)" }}>
                {copy.list.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                {copy.list.count(visibleInvoices.length)}
              </p>
            </div>

            {archivedOnly ? (
              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: "#fff7ed",
                  color: "#b45309",
                  border: "1px solid rgba(180, 83, 9, 0.18)",
                }}
              >
                {copy.list.archivedOnly}
              </span>
            ) : stats.overdueCount > 0 ? (
              <span className="badge badge-red">
                {copy.list.overdueCount(stats.overdueCount)}
              </span>
            ) : (
              <span className="badge badge-green">{copy.list.noOverdue}</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table
              className={`data-table ${
                isRtl ? "invoice-list-table-rtl" : "invoice-list-table-ltr"
              }`}
            >
              <thead>
                <tr>
                  <th>{copy.table.invoiceNumber}</th>
                  <th>{copy.table.client}</th>
                  <th>{copy.table.case}</th>
                  <th>{copy.table.total}</th>
                  <th>{copy.table.issueDate}</th>
                  <th>{copy.table.dueDate}</th>
                  <th>{copy.table.actions}</th>
                </tr>
              </thead>

              <tbody>
                {visibleInvoices.map((invoice) => {
                  const archivedInvoice = isArchivedInvoice(invoice);
                  const hasPaidPayment = invoice.payments.some(
                    (payment) => payment.status === "PAID",
                  );

                  const hasAnyPayment = invoice.payments.length > 0;

                  return (
                    <tr
                      key={invoice.id}
                      onClick={() => openInvoice(invoice)}
                      className="cursor-pointer"
                    >
                      <td>
                        <p
                          className="font-black"
                          style={{ color: "var(--text)" }}
                        >
                          <span dir="ltr">
                            {formatInvoiceNumber(invoice.invoiceNumber)}
                          </span>
                        </p>

                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {hasAnyPayment && (
                            <span
                              className="text-[11px] font-bold"
                              style={{
                                color: hasPaidPayment
                                  ? "var(--sidebar)"
                                  : "#92400e",
                              }}
                            >
                              {hasPaidPayment
                                ? copy.list.paidPayment
                                : copy.list.pendingPayment}
                              {" · "}
                              {invoice.payments.length}
                            </span>
                          )}

                          {archivedInvoice && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-black"
                              style={{
                                background: "#fff7ed",
                                color: "#b45309",
                                border: "1px solid rgba(180, 83, 9, 0.18)",
                              }}
                            >
                              {copy.list.archivedRecord}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="flex flex-col gap-1">
                          <p
                            className="font-bold"
                            style={{ color: "var(--text)" }}
                          >
                            <span dir="auto">{invoice.client?.name || "-"}</span>
                          </p>

                          {invoice.client?.phone && (
                            <p
                              className="text-xs"
                              style={{ color: "var(--text-3)" }}
                            >
                              <span dir="ltr">{invoice.client.phone}</span>
                            </p>
                          )}

                          {archivedInvoice && (
                            <span
                              className="inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-black"
                              style={{
                                background: "#fff7ed",
                                color: "#b45309",
                                border: "1px solid rgba(180, 83, 9, 0.18)",
                              }}
                            >
                              {copy.list.archivedClient}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        {invoice.case ? (
                          <div>
                            <p
                              className="font-bold"
                              style={{ color: "var(--text)" }}
                            >
                              <span dir="auto">{invoice.case.title}</span>
                            </p>

                            {invoice.case.caseNumber && (
                              <p
                                className="mt-1 font-mono text-xs"
                                style={{ color: "var(--text-3)" }}
                              >
                                <span dir="ltr">{invoice.case.caseNumber}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-3)" }}>-</span>
                        )}
                      </td>

                      <td
                        className="font-black"
                        style={{ color: "var(--sidebar)" }}
                      >
                        <span dir={isRtl ? "rtl" : "ltr"}>
                          {formatMoney(invoice.total)}
                        </span>
                      </td>

                      <td>
                        <span dir={isRtl ? "rtl" : "ltr"}>
                          {localizedDate(invoice.issueDate, locale)}
                        </span>
                      </td>

                      <td>
                        <span dir={isRtl ? "rtl" : "ltr"}>
                          {invoice.dueDate
                            ? localizedDate(invoice.dueDate, locale)
                            : "-"}
                        </span>
                      </td>

                      <td
                        onClick={(event) => event.stopPropagation()}
                        className="w-[110px] min-w-[110px]"
                      >
                        <button
                          type="button"
                          onClick={() => openInvoice(invoice)}
                          className="btn btn-ghost h-10 w-full whitespace-nowrap px-4 text-xs"
                        >
                          {copy.actions.view}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <form
            onSubmit={createInvoice}
            onClick={(event) => event.stopPropagation()}
            dir={isRtl ? "rtl" : "ltr"}
            className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6 text-start"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2
                  className="text-xl font-black"
                  style={{ color: "var(--text)" }}
                >
                  {copy.modal.title}
                </h2>

                <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
                  {copy.modal.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl px-3 py-2 text-sm hover:bg-black/5"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-bold">{copy.modal.client}</span>

                <select
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    setCaseId("");
                  }}
                  className="input"
                  dir={isRtl ? "rtl" : "ltr"}
                  style={fieldStyle}
                  required
                >
                  <option value="">{copy.modal.chooseClient}</option>

                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">{copy.modal.case}</span>

                <select
                  value={caseId}
                  onChange={(event) => setCaseId(event.target.value)}
                  className="input"
                  dir={isRtl ? "rtl" : "ltr"}
                  style={fieldStyle}
                  disabled={!clientId}
                >
                  <option value="">{copy.modal.noCase}</option>

                  {filteredCases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.caseNumber ? ` - ${item.caseNumber}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {selectedArchivedContext && (
                <div
                  className="md:col-span-2 rounded-2xl border p-3 text-xs font-bold"
                  style={{
                    background: "#fff7ed",
                    color: "#b45309",
                    borderColor: "rgba(180, 83, 9, 0.22)",
                  }}
                >
                  {copy.modal.archivedWarning}
                </div>
              )}

              <div className="space-y-2">
                <span className="block text-sm font-bold">
                  {copy.modal.dueDate}
                </span>

                <DatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  locale={locale}
                  ariaLabel={copy.modal.dueDate}
                  disabled={saving}
                />
              </div>

              <label className="space-y-2">
                <span className="text-sm font-bold">{copy.modal.notes}</span>

                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={copy.modal.notesPlaceholder}
                  dir={isRtl ? "rtl" : "ltr"}
                  style={fieldStyle}
                  className="input"
                />
              </label>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black" style={{ color: "var(--text)" }}>
                  {copy.modal.items}
                </h3>

                <button
                  type="button"
                  onClick={addItem}
                  disabled={!writeAccess.canWrite}
                  className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copy.actions.addItem}
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const lineTotal =
                    Number(item.quantity || 0) * Number(item.unitPrice || 0);

                  return (
                    <div
                      key={index}
                      className="rounded-2xl border p-4"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div
                        className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_120px_165px_150px_auto] md:items-end"
                        dir={isRtl ? "rtl" : "ltr"}
                      >
                        <label className="space-y-2 text-start">
                          <span
                            className="block w-full text-start text-xs font-black"
                            style={{ color: "var(--text-2)" }}
                          >
                            {copy.modal.itemType}
                          </span>

                          <select
                            value={item.preset}
                            onChange={(event) =>
                              updateItemPreset(index, event.target.value)
                            }
                            dir={isRtl ? "rtl" : "ltr"}
                            style={fieldStyle}
                            className="input"
                          >
                            <option value="">{copy.modal.chooseItem}</option>

                            {invoiceItemPresets.map((preset) => (
                              <option key={preset.value} value={preset.value}>
                                {preset.label}
                              </option>
                            ))}

                            <option value="CUSTOM">
                              {copy.modal.customItem}
                            </option>
                          </select>
                        </label>

                        <label className="space-y-2 text-start">
                          <span
                            className="block w-full text-start text-xs font-black"
                            style={{ color: "var(--text-2)" }}
                          >
                            {copy.modal.quantity}
                          </span>

                          <input
                            type="number"
                            min="0.01"
                            step="0.001"
                            value={item.quantity}
                            placeholder={copy.modal.quantityPlaceholder}
                            onChange={(event) =>
                              updateItem(index, "quantity", event.target.value)
                            }
                            dir="ltr"
                            style={numberFieldStyle}
                            className="input"
                          />
                        </label>

                        <label className="space-y-2 text-start">
                          <span
                            className="block w-full text-start text-xs font-black"
                            style={{ color: "var(--text-2)" }}
                          >
                            {copy.modal.unitPrice}
                          </span>

                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={item.unitPrice}
                            placeholder={copy.modal.unitPricePlaceholder}
                            onChange={(event) =>
                              updateItem(index, "unitPrice", event.target.value)
                            }
                            dir="ltr"
                            style={numberFieldStyle}
                            className="input"
                          />
                        </label>

                        <div className="space-y-2">
                          <span
                            className="block w-full text-start text-xs font-black"
                            style={{ color: "var(--text-2)" }}
                          >
                            {copy.modal.lineTotal}
                          </span>

                          <div
                            className="input flex items-center"
                            dir={isRtl ? "rtl" : "ltr"}
                            style={{
                              ...moneyDisplayStyle,
                              justifyContent: isRtl
                                ? "flex-start"
                                : "flex-start",
                              background: "var(--green-soft)",
                              color: "var(--sidebar)",
                              fontWeight: 900,
                            }}
                          >
                            {formatMoney(lineTotal)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={!writeAccess.canWrite || items.length === 1}
                          className="btn h-[46px] px-4 text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{
                            background: "transparent",
                            borderColor: "rgba(220, 38, 38, 0.22)",
                          }}
                        >
                          {copy.actions.delete}
                        </button>
                      </div>

                      {item.preset === "CUSTOM" && (
                        <label className="mt-3 block space-y-2">
                          <span
                            className="block text-xs font-black"
                            style={{ color: "var(--text-2)" }}
                          >
                            {copy.modal.customDescription}
                          </span>

                          <input
                            value={item.description}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "description",
                                event.target.value,
                              )
                            }
                            placeholder={copy.modal.itemDescription}
                            dir={isRtl ? "rtl" : "ltr"}
                            style={fieldStyle}
                            className="input"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="mt-6 grid gap-4 md:grid-cols-3"
              dir={isRtl ? "rtl" : "ltr"}
            >
              <label className="space-y-2 text-start">
                <span className="block w-full text-start text-sm font-bold">
                  {copy.modal.tax}
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={tax}
                  placeholder={copy.modal.taxPlaceholder}
                  dir="ltr"
                  style={numberFieldStyle}
                  onChange={(event) => setTax(event.target.value)}
                  className="input"
                />
              </label>

              <label className="space-y-2 text-start">
                <span className="block w-full text-start text-sm font-bold">
                  {copy.modal.discount}
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={discount}
                  placeholder={copy.modal.discountPlaceholder}
                  dir="ltr"
                  style={numberFieldStyle}
                  onChange={(event) => setDiscount(event.target.value)}
                  className="input"
                />
              </label>

              <div
                className="rounded-2xl border p-4 text-start"
                style={{ borderColor: "var(--border)" }}
              >
                <p
                  className="text-start text-sm"
                  style={{ color: "var(--text-3)" }}
                >
                  {copy.modal.finalTotal}
                </p>

                <p
                  className="mt-1 text-start text-2xl font-black"
                  dir={isRtl ? "rtl" : "ltr"}
                  style={{ color: "var(--sidebar)" }}
                >
                  {formatMoney(total)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="btn btn-ghost"
              >
                {copy.actions.clear}
              </button>

              <button
                type="submit"
                disabled={saving || !writeAccess.canWrite}
                title={
                  !writeAccess.canWrite
                    ? writeAccess.message || getBlockFallback(locale)
                    : copy.actions.saveInvoice
                }
                className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? copy.actions.saving : copy.actions.saveInvoice}
              </button>
            </div>
          </form>
        </div>
      )}
      <FinanceSuccessOverlay
        open={!!successInvoice}
        kind="invoice"
        title={locale === "ar" ? "تم إنشاء الفاتورة بنجاح" : "Invoice created successfully"}
        subtitle={
          successInvoice?.number
            ? `${locale === "ar" ? "رقم الفاتورة" : "Invoice"}: ${formatInvoiceNumber(successInvoice.number)}`
            : locale === "ar"
              ? "تم حفظ الفاتورة وتجهيزها للعرض"
              : "The invoice was saved and prepared for viewing"
        }
        status={
          successInvoice?.status
            ? copy.statuses[successInvoice.status as InvoiceStatus] || successInvoice.status
            : undefined
        }
        onComplete={() => {
          const target = successInvoice?.id;
          setSuccessInvoice(null);
          if (target) router.push(`/dashboard/finance/invoices/${target}`);
        }}
      />

    </div>
  );
}
