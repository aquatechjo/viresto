"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import AppLoader from "@/components/ui/AppLoader";
import PageLoader from "@/components/ui/PageLoader";
import Modal from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import { fileSizeLabel, formatDate, formatTime } from "@/lib/utils";
import { useLocale } from "@/lib/useLocale";

interface Payment {
  id: string;
  amount: number;
  status: string;
  method: string;
  paidAt: string;
  notes?: string | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    total: number;
  } | null;
}

interface Appointment {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  type: string;
  status: string;
  location?: string | null;
}

interface DocumentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  fileUrl?: string | null;
  notes?: string | null;
  tags?: string[];
  createdAt: string;
}

interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: string;
  completed: boolean;
  createdAt: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string | null;
  items: InvoiceItem[];
  payment?: {
    id: string;
    status: string;
    amount: number;
  } | null;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
}

interface CaseDetail {
  id: string;
  title: string;
  caseNumber?: string | null;
  court?: string | null;
  status: string;
  feeAgreed: number;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    nationalId?: string | null;
    address?: string | null;
    archivedAt?: string | null;
  };
  payments: Payment[];
  appointments: Appointment[];
  documents: DocumentItem[];
  tasks: TaskItem[];
  invoices: Invoice[];
  activities: Activity[];
}

const STATUS_AR: Record<string, string> = {
  OPEN: "نشطة",
  IN_PROGRESS: "قيد المتابعة",
  CLOSED: "مغلقة",
  ARCHIVED: "مؤرشفة",
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: "badge badge-green",
  IN_PROGRESS: "badge badge-blue",
  CLOSED: "badge badge-gray",
  ARCHIVED: "badge badge-gray",
};

const STATUSES = [
  ["OPEN", "نشطة"],
  ["IN_PROGRESS", "قيد المتابعة"],
  ["CLOSED", "مغلقة"],
  ["ARCHIVED", "مؤرشفة"],
] as const;

const METHOD_AR: Record<string, string> = {
  CASH: "نقدًا",
  BANK_TRANSFER: "تحويل بنكي",
  CHECK: "شيك",
  ONLINE: "إلكتروني",
};

const PMT_STATUS: Record<string, string> = {
  PAID: "badge badge-green",
  PENDING: "badge badge-amber",
  OVERDUE: "badge badge-red",
  CANCELLED: "badge badge-gray",
};

const PMT_AR: Record<string, string> = {
  PAID: "مدفوع",
  PENDING: "معلق",
  OVERDUE: "متأخر",
  CANCELLED: "ملغي",
};

const INVOICE_STATUS_AR: Record<string, string> = {
  DRAFT: "مسودة",
  UNPAID: "غير مدفوعة",
  PAID: "مدفوعة",
  OVERDUE: "متأخرة",
  CANCELLED: "ملغاة",
};

const INVOICE_STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge badge-gray",
  UNPAID: "badge badge-amber",
  PAID: "badge badge-green",
  OVERDUE: "badge badge-red",
  CANCELLED: "badge badge-gray",
};

const TASK_PRIORITY_AR: Record<string, string> = {
  URGENT: "عاجلة",
  HIGH: "عالية",
  MEDIUM: "متوسطة",
  LOW: "منخفضة",
};

const TASK_PRIORITY_BADGE: Record<string, string> = {
  URGENT: "badge badge-red",
  HIGH: "badge badge-red",
  MEDIUM: "badge badge-amber",
  LOW: "badge badge-gray",
};

const APPT_TYPE_AR: Record<string, string> = {
  MEETING: "اجتماع",
  COURT_SESSION: "جلسة محكمة",
  PHONE_CALL: "مكالمة",
  DEADLINE: "موعد نهائي",
  OTHER: "أخرى",
};

const APPT_STATUS_AR: Record<string, string> = {
  SCHEDULED: "مجدول",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
};

const ACTIVITY_ICON: Record<string, string> = {
  CLIENT_CREATED: "👤",
  CASE_CREATED: "⚖️",
  APPOINTMENT_CREATED: "📅",
  PAYMENT_CREATED: "💰",
  DOCUMENT_UPLOADED: "📄",
  TASK_CREATED: "✅",
  INVOICE_CREATED: "🧾",
  USER_CREATED: "👥",
};

const ACTIVITY_TITLE_EN: Record<string, string> = {
  CLIENT_CREATED: "New client was created",
  CASE_CREATED: "New case was created",
  APPOINTMENT_CREATED: "New appointment was created",
  PAYMENT_CREATED: "New payment was recorded",
  DOCUMENT_UPLOADED: "New document was uploaded",
  TASK_CREATED: "New task was created",
  INVOICE_CREATED: "New invoice was created",
  USER_CREATED: "New user was created",
};

const ACTIVITY_ENTITY_EN: Record<string, string> = {
  CLIENT_CREATED: "Client",
  CASE_CREATED: "Case",
  APPOINTMENT_CREATED: "Appointment",
  PAYMENT_CREATED: "Payment",
  DOCUMENT_UPLOADED: "Document",
  TASK_CREATED: "Task",
  INVOICE_CREATED: "Invoice",
  USER_CREATED: "User",
};

function activityTitle(activity: Activity, isArabic: boolean) {
  if (isArabic) return activity.title;
  return ACTIVITY_TITLE_EN[activity.type] || activity.title;
}

function activityMessage(activity: Activity, isArabic: boolean) {
  if (isArabic) return activity.message;
  return (
    ACTIVITY_ENTITY_EN[activity.type] || activity.entityType || activity.message
  );
}

function activityDate(value: string, isArabic: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(isArabic ? "ar-JO" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

const DOCUMENT_TAGS = ["عقد", "قضية", "هوية", "حكم", "إثبات", "لائحة", "مالية"];

const PMT_INIT = {
  amount: "",
  method: "CASH",
  status: "PAID",
  notes: "",
  paidAt: "",
};

const APPOINTMENT_INIT = {
  title: "",
  type: "COURT_SESSION",
  startTime: "",
  endTime: "",
  location: "",
  description: "",
};

const TASK_INIT = {
  title: "",
  priority: "MEDIUM",
  dueDate: "",
  description: "",
};

const INVOICE_INIT = {
  description: "أتعاب قانونية",
  amount: "",
  tax: "0",
  discount: "0",
  dueDate: "",
  notes: "",
};

const DOCUMENT_INIT = {
  tag: "قضية",
  notes: "",
};

function getApiMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback;
}

function safeNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value: number) {
  const amount = Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `JOD ${amount}`;
}

function documentIcon(fileType?: string | null) {
  if (fileType === "application/pdf") return "📄";
  if (fileType?.startsWith("image/")) return "🖼️";
  if (fileType?.includes("word")) return "📝";
  return "📁";
}

function displayDate(value?: string | null, isArabic = true) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(isArabic ? "ar-JO" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const isArabic = locale === "ar";
  const pageText = {
    back: isArabic ? "رجوع" : "Back",
    caseFile: isArabic ? "ملف القضية" : "Case file",
    caseNumber: isArabic ? "رقم القضية" : "Case number",
    noCourt: isArabic ? "بدون محكمة محددة" : "No court selected",
    added: isArabic ? "أُضيفت" : "Added",
    payment: isArabic ? "+ دفعة" : "+ Payment",
    invoice: isArabic ? "+ فاتورة" : "+ Invoice",
    appointment: isArabic ? "+ موعد" : "+ Appointment",
    task: isArabic ? "+ مهمة" : "+ Task",
    document: isArabic ? "+ مستند" : "+ Document",
    agreedFees: isArabic ? "الأتعاب المتفق عليها" : "Agreed fees",
    collected: isArabic ? "المحصّل" : "Collected",
    remaining: isArabic ? "المتبقي" : "Remaining",
    collectionRate: isArabic ? "نسبة التحصيل" : "Collection rate",
    client: isArabic ? "الموكل" : "Client",
    openClient: isArabic ? "عرض ملف الموكل" : "Open client file",
    phone: isArabic ? "الهاتف" : "Phone",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    nationalId: isArabic ? "الرقم الوطني / الهوية" : "National ID",
    address: isArabic ? "العنوان" : "Address",
    notAdded: isArabic ? "غير مضاف" : "Not added",
    invoices: isArabic ? "الفواتير" : "Invoices",
    unpaid: isArabic ? "غير مدفوع" : "Unpaid",
    changeStatus: isArabic ? "تغيير حالة القضية" : "Change case status",
    appointmentsSection: isArabic
      ? "المواعيد والجلسات"
      : "Appointments and sessions",
    tasksSection: isArabic ? "المهام" : "Tasks",
    invoicesSection: isArabic ? "الفواتير" : "Invoices",
    paymentsSection: isArabic ? "المدفوعات" : "Payments",
    documentsSection: isArabic ? "المستندات" : "Documents",
    latestActivities: isArabic ? "آخر النشاطات" : "Latest activities",
    latestActivitiesHint: isArabic
      ? "أحدث العمليات على هذه القضية"
      : "Recent actions on this case",
    noActivities: isArabic
      ? "لا توجد نشاطات مسجلة."
      : "No activities recorded.",
    item: isArabic ? "عنصر" : "item",
    delete: isArabic ? "حذف" : "Delete",
    open: isArabic ? "فتح" : "Open",
    preview: isArabic ? "معاينة" : "Preview",
    cancel: isArabic ? "إلغاء" : "Cancel",
    save: isArabic ? "حفظ" : "Save",
    amount: isArabic ? "المبلغ" : "Amount",
    status: isArabic ? "الحالة" : "Status",
    method: isArabic ? "طريقة الدفع" : "Payment method",
    notes: isArabic ? "ملاحظات" : "Notes",
    description: isArabic ? "الوصف" : "Description",
    title: isArabic ? "العنوان" : "Title",
    type: isArabic ? "النوع" : "Type",
    location: isArabic ? "المكان" : "Location",
    noLocation: isArabic ? "بدون موقع" : "No location",
    dueDate: isArabic ? "تاريخ الاستحقاق" : "Due date",
    noDate: isArabic ? "بدون تاريخ" : "No date",
    priority: isArabic ? "الأولوية" : "Priority",
    paymentDate: isArabic ? "تاريخ الدفع" : "Payment date",
    startTime: isArabic ? "وقت البداية" : "Start time",
    endTime: isArabic ? "وقت الانتهاء" : "End time",
    itemDescription: isArabic ? "وصف البند" : "Item description",
    tax: isArabic ? "الضريبة" : "Tax",
    discount: isArabic ? "الخصم" : "Discount",
    documentCategory: isArabic ? "تصنيف المستند" : "Document category",
    invoiceNumber: isArabic ? "رقم الفاتورة" : "Invoice number",
    total: isArabic ? "الإجمالي" : "Total",
    date: isArabic ? "التاريخ" : "Date",
    savePayment: isArabic ? "حفظ الدفعة" : "Save payment",
    saveAppointment: isArabic ? "حفظ الموعد" : "Save appointment",
    saveTask: isArabic ? "حفظ المهمة" : "Save task",
    createInvoice: isArabic ? "إنشاء الفاتورة" : "Create invoice",
    saving: isArabic ? "جاري الحفظ..." : "Saving...",
    creating: isArabic ? "جاري الإنشاء..." : "Creating...",
    deleting: isArabic ? "جاري الحذف..." : "Deleting...",
    uploading: isArabic ? "جاري رفع المستند..." : "Uploading document...",
    addPaymentTitle: isArabic ? "إضافة دفعة" : "Add payment",
    addAppointmentTitle: isArabic ? "إضافة موعد" : "Add appointment",
    addTaskTitle: isArabic ? "إضافة مهمة" : "Add task",
    createInvoiceTitle: isArabic ? "إنشاء فاتورة" : "Create invoice",
    uploadDocumentTitle: isArabic ? "رفع مستند للقضية" : "Upload case document",
    deletePaymentTitle: isArabic ? "حذف الدفعة" : "Delete payment",
    deletePaymentConfirm: isArabic
      ? "هل أنت متأكد من حذف هذه الدفعة؟ لا يمكن التراجع عن هذه العملية."
      : "Are you sure you want to delete this payment? This action cannot be undone.",
    documentUploadHint: isArabic
      ? "سيتم ربط المستند تلقائيًا بهذه القضية وبالموكل المرتبط بها. الحد الأقصى لحجم الملف 10MB."
      : "The document will be linked automatically to this case and its client. Maximum file size is 10MB.",
    noAppointments: isArabic
      ? "لا توجد مواعيد مرتبطة بهذه القضية."
      : "No appointments are linked to this case.",
    noTasks: isArabic
      ? "لا توجد مهام مرتبطة بهذه القضية."
      : "No tasks are linked to this case.",
    noInvoices: isArabic
      ? "لا توجد فواتير مرتبطة بهذه القضية."
      : "No invoices are linked to this case.",
    noPayments: isArabic
      ? "لا توجد دفعات مرتبطة بهذه القضية."
      : "No payments are linked to this case.",
    noDocuments: isArabic
      ? "لا توجد مستندات مرتبطة بهذه القضية."
      : "No documents are linked to this case.",
    notFoundTitle: isArabic ? "القضية غير موجودة" : "Case not found",
    notFoundDescription: isArabic
      ? "تعذر العثور على بيانات هذه القضية."
      : "Could not find this case data.",
    archivedClient: isArabic ? "موكل مؤرشف" : "Archived client",
    archivedCaseWarning: isArabic
      ? "هذه القضية مرتبطة بموكل مؤرشف. السجل متاح للعرض والتحصيل وإصدار الفواتير، ولا يمكن إضافة مواعيد أو مهام أو مستندات جديدة."
      : "This case is linked to an archived client. The record is available for viewing, collections, and invoicing. New appointments, tasks, and documents cannot be added.",
    archivedStatusBlocked: isArabic
      ? "لا يمكن تغيير حالة قضية مرتبطة بموكل مؤرشف"
      : "You cannot change the status of a case linked to an archived client",
    archivedAppointmentBlocked: isArabic
      ? "لا يمكن إضافة أو حذف مواعيد لقضية مرتبطة بموكل مؤرشف"
      : "You cannot add or delete appointments for a case linked to an archived client",
    archivedTaskBlocked: isArabic
      ? "لا يمكن إضافة أو حذف مهام لقضية مرتبطة بموكل مؤرشف"
      : "You cannot add or delete tasks for a case linked to an archived client",
    archivedInvoiceBlocked: isArabic
      ? "لا يمكن حذف فاتورة مرتبطة بموكل مؤرشف"
      : "You cannot delete an invoice linked to an archived client",
    archivedDocumentBlocked: isArabic
      ? "لا يمكن رفع أو حذف مستندات لقضية مرتبطة بموكل مؤرشف"
      : "You cannot upload or delete documents for a case linked to an archived client",
    archivedPaymentDeleteBlocked: isArabic
      ? "لا يمكن حذف دفعة مرتبطة بموكل مؤرشف"
      : "You cannot delete a payment linked to an archived client",
    archivedPaymentHint: isArabic
      ? "مسموح تسجيل دفعة تحصيل قديم لهذا الموكل المؤرشف، لكن لا يمكن حذف الدفعة بعد تسجيلها."
      : "You may record an old collection for this archived client, but the payment cannot be deleted afterward.",
  };

  const statusText: Record<string, string> = {
    OPEN: isArabic ? "نشطة" : "Open",
    IN_PROGRESS: isArabic ? "قيد المتابعة" : "In progress",
    CLOSED: isArabic ? "مغلقة" : "Closed",
    ARCHIVED: isArabic ? "مؤرشفة" : "Archived",
  };

  const statuses = [
    ["OPEN", statusText.OPEN],
    ["IN_PROGRESS", statusText.IN_PROGRESS],
    ["CLOSED", statusText.CLOSED],
    ["ARCHIVED", statusText.ARCHIVED],
  ] as const;

  const methodText: Record<string, string> = {
    CASH: isArabic ? "نقدًا" : "Cash",
    BANK_TRANSFER: isArabic ? "تحويل بنكي" : "Bank transfer",
    CHECK: isArabic ? "شيك" : "Check",
    ONLINE: isArabic ? "إلكتروني" : "Online",
  };

  const paymentStatusText: Record<string, string> = {
    PAID: isArabic ? "مدفوع" : "Paid",
    PENDING: isArabic ? "معلق" : "Pending",
    OVERDUE: isArabic ? "متأخر" : "Overdue",
    CANCELLED: isArabic ? "ملغي" : "Cancelled",
  };

  const invoiceStatusText: Record<string, string> = {
    DRAFT: isArabic ? "مسودة" : "Draft",
    UNPAID: isArabic ? "غير مدفوعة" : "Unpaid",
    PAID: isArabic ? "مدفوعة" : "Paid",
    OVERDUE: isArabic ? "متأخرة" : "Overdue",
    CANCELLED: isArabic ? "ملغاة" : "Cancelled",
  };

  const taskPriorityText: Record<string, string> = {
    URGENT: isArabic ? "عاجلة" : "Urgent",
    HIGH: isArabic ? "عالية" : "High",
    MEDIUM: isArabic ? "متوسطة" : "Medium",
    LOW: isArabic ? "منخفضة" : "Low",
  };

  const appointmentTypeText: Record<string, string> = {
    MEETING: isArabic ? "اجتماع" : "Meeting",
    COURT_SESSION: isArabic ? "جلسة محكمة" : "Court session",
    PHONE_CALL: isArabic ? "مكالمة" : "Phone call",
    DEADLINE: isArabic ? "موعد نهائي" : "Deadline",
    OTHER: isArabic ? "أخرى" : "Other",
  };

  const appointmentStatusText: Record<string, string> = {
    SCHEDULED: isArabic ? "مجدول" : "Scheduled",
    COMPLETED: isArabic ? "مكتمل" : "Completed",
    CANCELLED: isArabic ? "ملغي" : "Cancelled",
  };

  const [c, setC] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);

  const [paymentForm, setPaymentForm] = useState(PMT_INIT);
  const [appointmentForm, setAppointmentForm] = useState(APPOINTMENT_INIT);
  const [taskForm, setTaskForm] = useState(TASK_INIT);
  const [invoiceForm, setInvoiceForm] = useState(INVOICE_INIT);
  const [documentForm, setDocumentForm] = useState(DOCUMENT_INIT);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const documentInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!id || id === "undefined") {
      setLoading(false);
      toast.error("رقم القضية غير موجود");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`/api/cases/${id}`);
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setC(data.data);
      } else {
        toast.error(getApiMessage(data, "القضية غير موجودة"));
      }
    } catch {
      toast.error("تعذر تحميل بيانات القضية");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const totalPaid =
      c?.payments
        ?.filter((payment) => payment.status === "PAID")
        .reduce((sum, payment) => sum + payment.amount, 0) ?? 0;

    const invoicesTotal =
      c?.invoices
        ?.filter((invoice) => invoice.status !== "CANCELLED")
        .reduce((sum, invoice) => sum + invoice.total, 0) ?? 0;

    const unpaidInvoicesTotal =
      c?.invoices
        ?.filter(
          (invoice) =>
            invoice.status !== "PAID" && invoice.status !== "CANCELLED",
        )
        .reduce((sum, invoice) => sum + invoice.total, 0) ?? 0;

    const remaining = Math.max(0, (c?.feeAgreed ?? 0) - totalPaid);

    const pct =
      (c?.feeAgreed ?? 0) > 0
        ? Math.min((totalPaid / (c?.feeAgreed ?? 1)) * 100, 100)
        : 0;

    return {
      totalPaid,
      invoicesTotal,
      unpaidInvoicesTotal,
      remaining,
      pct,
    };
  }, [c]);

  const upcomingAppointments = useMemo(() => {
    const now = Date.now();

    return (c?.appointments ?? [])
      .filter(
        (appointment) =>
          appointment.status !== "CANCELLED" &&
          new Date(appointment.startTime).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      )
      .slice(0, 5);
  }, [c]);

  const overdueTasks = useMemo(() => {
    const now = Date.now();

    return (c?.tasks ?? []).filter(
      (task) =>
        !task.completed &&
        task.dueDate &&
        new Date(task.dueDate).getTime() < now,
    ).length;
  }, [c]);

  const caseArchived = Boolean(c?.client?.archivedAt);

  function blockArchivedAction(message: string) {
    if (!caseArchived) return false;

    toast.error(message);
    return true;
  }

  function confirmToast(message: string) {
    return new Promise<boolean>((resolve) => {
      let settled = false;

      const toastId = toast(message, {
        duration: 10000,
        action: {
          label: isArabic ? "تأكيد" : "Confirm",
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

  async function updateStatus(status: string) {
    if (!id || id === "undefined") {
      toast.error("رقم القضية غير موجود");
      return;
    }

    if (c?.status === status) return;

    if (blockArchivedAction(pageText.archivedStatusBlocked)) {
      return;
    }

    const response = await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      toast.success("تم تحديث حالة القضية");
      load();
    } else {
      toast.error(getApiMessage(data, "تعذر تحديث الحالة"));
    }
  }

  async function addPayment(event: FormEvent) {
    event.preventDefault();

    if (!paymentForm.amount) {
      toast.error("المبلغ مطلوب");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...paymentForm,
          caseId: id,
          amount: safeNumber(paymentForm.amount),
          paidAt: paymentForm.paidAt || new Date().toISOString(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success("تمت إضافة الدفعة");
        setPaymentOpen(false);
        setPaymentForm(PMT_INIT);
        load();
      } else {
        toast.error(getApiMessage(data, "تعذر إضافة الدفعة"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function addAppointment(event: FormEvent) {
    event.preventDefault();

    if (blockArchivedAction(pageText.archivedAppointmentBlocked)) {
      return;
    }

    if (!appointmentForm.title.trim()) {
      toast.error("عنوان الموعد مطلوب");
      return;
    }

    if (!appointmentForm.startTime) {
      toast.error("وقت بداية الموعد مطلوب");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: appointmentForm.title.trim(),
          type: appointmentForm.type,
          startTime: appointmentForm.startTime,
          endTime: appointmentForm.endTime || undefined,
          location: appointmentForm.location || undefined,
          description: appointmentForm.description || undefined,
          clientId: c?.client.id,
          caseId: id,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success("تمت إضافة الموعد");
        setAppointmentOpen(false);
        setAppointmentForm(APPOINTMENT_INIT);
        load();
      } else {
        toast.error(getApiMessage(data, "تعذر إضافة الموعد"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment(appointment: Appointment) {
    if (blockArchivedAction(pageText.archivedAppointmentBlocked)) {
      return;
    }

    const confirmed = await confirmToast(
      `هل تريد حذف الموعد: ${appointment.title}؟`,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/appointments/${appointment.id}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      toast.success("تم حذف الموعد");
      load();
    } else {
      toast.error(getApiMessage(data, "تعذر حذف الموعد"));
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();

    if (blockArchivedAction(pageText.archivedTaskBlocked)) {
      return;
    }

    if (!taskForm.title.trim()) {
      toast.error("عنوان المهمة مطلوب");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || undefined,
          description: taskForm.description || undefined,
          clientId: c?.client.id,
          caseId: id,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success("تمت إضافة المهمة");
        setTaskOpen(false);
        setTaskForm(TASK_INIT);
        load();
      } else {
        toast.error(getApiMessage(data, "تعذر إضافة المهمة"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: TaskItem) {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      toast.success(
        task.completed ? "تمت إعادة فتح المهمة" : "تم إكمال المهمة",
      );
      load();
    } else {
      toast.error(getApiMessage(data, "تعذر تحديث المهمة"));
    }
  }

  async function deleteTask(task: TaskItem) {
    if (blockArchivedAction(pageText.archivedTaskBlocked)) {
      return;
    }

    const confirmed = await confirmToast(`هل تريد حذف المهمة: ${task.title}؟`);
    if (!confirmed) return;

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      toast.success("تم حذف المهمة");
      load();
    } else {
      toast.error(getApiMessage(data, "تعذر حذف المهمة"));
    }
  }

  async function createInvoice(event: FormEvent) {
    event.preventDefault();

    if (!invoiceForm.description.trim()) {
      toast.error("وصف البند مطلوب");
      return;
    }

    if (!invoiceForm.amount) {
      toast.error("المبلغ مطلوب");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: c?.client.id,
          caseId: id,
          dueDate: invoiceForm.dueDate || undefined,
          tax: safeNumber(invoiceForm.tax),
          discount: safeNumber(invoiceForm.discount),
          notes: invoiceForm.notes || undefined,
          items: [
            {
              description: invoiceForm.description.trim(),
              quantity: 1,
              unitPrice: safeNumber(invoiceForm.amount),
            },
          ],
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success("تم إنشاء الفاتورة");
        setInvoiceOpen(false);
        setInvoiceForm(INVOICE_INIT);
        load();

        if (data.data?.id) {
          router.push(`/dashboard/invoices/${data.data.id}`);
        }
      } else {
        toast.error(getApiMessage(data, "تعذر إنشاء الفاتورة"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(invoice: Invoice) {
    if (blockArchivedAction(pageText.archivedInvoiceBlocked)) {
      return;
    }

    if (invoice.payment) {
      toast.error(
        "لا يمكن حذف فاتورة مرتبطة بدفعة. افتح الفاتورة وغيّر حالتها أولًا.",
      );
      return;
    }

    const confirmed = await confirmToast(
      `هل تريد حذف الفاتورة ${invoice.invoiceNumber}؟`,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      toast.success("تم حذف الفاتورة");
      load();
    } else {
      toast.error(getApiMessage(data, "تعذر حذف الفاتورة"));
    }
  }

  async function uploadCaseDocument(file?: File | null) {
    if (!file) {
      toast.error("اختر ملفًا أولًا");
      return;
    }

    if (!c) {
      toast.error("بيانات القضية غير جاهزة");
      return;
    }

    if (blockArchivedAction(pageText.archivedDocumentBlocked)) {
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الملف يتجاوز 10 ميجابايت");
      return;
    }

    try {
      setUploadingDocument(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("caseId", id);
      formData.append("clientId", c.client.id);
      formData.append(
        "tags",
        JSON.stringify(documentForm.tag ? [documentForm.tag] : ["قضية"]),
      );

      if (documentForm.notes.trim()) {
        formData.append("notes", documentForm.notes.trim());
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        toast.success("تم رفع المستند وربطه بالقضية");
        setDocumentOpen(false);
        setDocumentForm(DOCUMENT_INIT);

        if (documentInputRef.current) {
          documentInputRef.current.value = "";
        }

        load();
      } else {
        toast.error(getApiMessage(data, "تعذر رفع المستند"));
      }
    } catch {
      toast.error("حدث خطأ أثناء رفع المستند");
    } finally {
      setUploadingDocument(false);
    }
  }

  async function deleteDocument(doc: DocumentItem) {
    if (blockArchivedAction(pageText.archivedDocumentBlocked)) {
      return;
    }

    const confirmed = await confirmToast(
      `هل تريد حذف المستند: ${doc.fileName}؟`,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/documents/${doc.id}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      toast.success("تم حذف المستند");
      load();
    } else {
      toast.error(getApiMessage(data, "تعذر حذف المستند"));
    }
  }

  async function confirmDeletePayment() {
    if (!deleteId) return;

    if (blockArchivedAction(pageText.archivedPaymentDeleteBlocked)) {
      setDeleteId(null);
      return;
    }

    try {
      setDeleteLoading(true);

      const response = await fetch(`/api/payments/${deleteId}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(getApiMessage(data, "فشل حذف الدفعة"));
        return;
      }

      toast.success("تم حذف الدفعة");
      setDeleteId(null);
      load();
    } catch {
      toast.error("حدث خطأ أثناء حذف الدفعة");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return <AppLoader fullScreen={false} />;
  }
  if (!c) {
    return (
      <div className="space-y-5 stagger" dir={isRtl ? "rtl" : "ltr"}>
        <div className="card p-10 text-center">
          <h1 className="text-2xl font-black" style={{ color: "var(--text)" }}>
            {pageText.notFoundTitle}
          </h1>

          <p className="mt-2 text-sm" style={{ color: "var(--text-3)" }}>
            {pageText.notFoundDescription}
          </p>

          <button
            onClick={() => router.back()}
            className="btn btn-primary mt-5"
          >
            {pageText.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-w-0 max-w-full space-y-5 overflow-x-hidden stagger"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6"
        style={{
          background:
            "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 18px 50px rgba(45, 74, 62, 0.18)",
        }}
      >
        <div
          className={`absolute -top-14 h-40 w-40 rounded-full ${isRtl ? "-right-14" : "-left-14"}`}
          style={{ background: "rgba(245, 200, 66, 0.16)" }}
        />

        <div
          className={`absolute -bottom-20 h-52 w-52 rounded-full ${isRtl ? "left-16" : "right-16"}`}
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {pageText.caseFile}
              </span>

              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: "#fff",
                  color: "var(--sidebar)",
                }}
              >
                {statusText[c.status] || c.status}
              </span>

              {caseArchived && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-black"
                  style={{
                    background: "#fff7ed",
                    color: "#b45309",
                    border: "1px solid rgba(180, 83, 9, 0.22)",
                  }}
                >
                  {pageText.archivedClient}
                </span>
              )}

              {c.caseNumber && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    color: "#fff",
                  }}
                >
                  {pageText.caseNumber}: {c.caseNumber}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-white">{c.title}</h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              {c.court || pageText.noCourt} · {pageText.added}{" "}
              {displayDate(c.createdAt, isArabic)}
            </p>

            {c.description && (
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/75">
                {c.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn"
              style={{
                background: "#fff",
                color: "var(--sidebar)",
                borderColor: "rgba(255,255,255,0.32)",
              }}
            >
              {pageText.back}
            </button>

            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="btn"
              style={{
                background: "rgba(245,200,66,0.18)",
                color: "#fff",
                borderColor: "rgba(245,200,66,0.35)",
              }}
            >
              {pageText.payment}
            </button>

            <button
              type="button"
              onClick={() => setInvoiceOpen(true)}
              className="btn"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.22)",
              }}
            >
              {pageText.invoice}
            </button>
          </div>
        </div>
      </div>

      {caseArchived && (
        <div
          className="rounded-3xl border p-5 text-sm font-bold leading-7"
          style={{
            background: "#fff7ed",
            color: "#b45309",
            borderColor: "rgba(180, 83, 9, 0.22)",
          }}
        >
          {pageText.archivedCaseWarning}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: pageText.agreedFees,
            value: formatMoney(c.feeAgreed || 0),
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: pageText.collected,
            value: formatMoney(totals.totalPaid),
            color: "var(--sidebar)",
            bg: "var(--green-soft)",
          },
          {
            label: pageText.remaining,
            value: formatMoney(totals.remaining),
            color: totals.remaining > 0 ? "#dc2626" : "var(--text-3)",
            bg: totals.remaining > 0 ? "var(--red-soft)" : "var(--card)",
          },
          {
            label: pageText.collectionRate,
            value: `${Math.round(totals.pct)}%`,
            color: totals.pct >= 80 ? "var(--sidebar)" : "#92400e",
            bg: totals.pct >= 80 ? "var(--green-soft)" : "var(--amber-soft)",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5"
            style={{ background: item.bg, borderColor: "var(--border)" }}
          >
            <p className="text-xs font-black" style={{ color: item.color }}>
              {item.label}
            </p>

            <p
              dir="ltr"
              className={`mt-2 whitespace-nowrap text-xl font-black leading-tight ${
                isRtl ? "text-right" : "text-left"
              }`}
              style={{ color: item.color }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card p-4">
        <div
          className={`flex flex-wrap gap-2 ${isRtl ? "justify-end" : "justify-start"}`}
        >
          <button
            onClick={() => setAppointmentOpen(true)}
            disabled={caseArchived}
            title={
              caseArchived ? pageText.archivedAppointmentBlocked : undefined
            }
            className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pageText.appointment}
          </button>
          <button
            onClick={() => setTaskOpen(true)}
            disabled={caseArchived}
            title={caseArchived ? pageText.archivedTaskBlocked : undefined}
            className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pageText.task}
          </button>
          <button
            onClick={() => setDocumentOpen(true)}
            disabled={caseArchived}
            title={caseArchived ? pageText.archivedDocumentBlocked : undefined}
            className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pageText.document}
          </button>
          <button
            onClick={() => setPaymentOpen(true)}
            className="btn btn-ghost"
          >
            {pageText.payment}
          </button>
          <button
            onClick={() => setInvoiceOpen(true)}
            className="btn btn-ghost"
          >
            {pageText.invoice}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Sidebar */}
        <div className="space-y-5 xl:col-span-4">
          <div className="card p-5">
            <div className="mb-4">
              <p
                className="text-xs font-black"
                style={{ color: "var(--text-3)" }}
              >
                {pageText.client}
              </p>
              <h2
                className="mt-1 text-xl font-black"
                style={{ color: "var(--text)" }}
              >
                {c.client.name}
              </h2>

              {caseArchived && (
                <span
                  className="mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black"
                  style={{
                    background: "#fff7ed",
                    color: "#b45309",
                    borderColor: "rgba(180, 83, 9, 0.22)",
                  }}
                >
                  {pageText.archivedClient}
                </span>
              )}
            </div>

            <Link
              href={`/dashboard/clients/${c.client.id}`}
              className="block rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{
                borderColor: "var(--border)",
                background: "var(--green-soft)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-xs font-black"
                    style={{ color: "var(--text-2)" }}
                  >
                    {pageText.client}
                  </p>

                  <h3
                    className="mt-1 text-lg font-black"
                    style={{ color: "var(--sidebar)" }}
                  >
                    {c.client.name || pageText.notAdded}
                  </h3>
                </div>

                <span
                  className="rounded-full px-3 py-1 text-xs font-black"
                  style={{
                    background: "var(--card)",
                    color: "var(--sidebar)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {pageText.openClient}
                </span>
              </div>

              <div
                className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p
                    className="text-xs font-black"
                    style={{ color: "var(--text-3)" }}
                  >
                    {pageText.phone}
                  </p>
                  <p
                    dir="ltr"
                    className={`mt-1 truncate text-sm font-bold ${isRtl ? "text-right" : "text-left"}`}
                    style={{ color: "var(--text)" }}
                  >
                    {c.client.phone || pageText.notAdded}
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-black"
                    style={{ color: "var(--text-3)" }}
                  >
                    {pageText.email}
                  </p>
                  <p
                    dir="ltr"
                    className={`mt-1 truncate text-sm font-bold ${isRtl ? "text-right" : "text-left"}`}
                    style={{ color: "var(--text)" }}
                  >
                    {c.client.email || pageText.notAdded}
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-black"
                    style={{ color: "var(--text-3)" }}
                  >
                    {pageText.nationalId}
                  </p>
                  <p
                    dir="ltr"
                    className={`mt-1 truncate text-sm font-bold ${isRtl ? "text-right" : "text-left"}`}
                    style={{ color: "var(--text)" }}
                  >
                    {c.client.nationalId || pageText.notAdded}
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-black"
                    style={{ color: "var(--text-3)" }}
                  >
                    {pageText.address}
                  </p>
                  <p
                    className="mt-1 line-clamp-2 break-words text-sm font-bold"
                    style={{ color: "var(--text)" }}
                  >
                    {c.client.address || pageText.notAdded}
                  </p>
                </div>
              </div>
            </Link>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex justify-between text-xs font-black">
              <span style={{ color: "var(--sidebar)" }}>
                {Math.round(totals.pct)}% {pageText.collected}
              </span>
              <span style={{ color: "var(--text-3)" }}>
                {pageText.collectionRate}
              </span>
            </div>

            <div
              className="h-2.5 overflow-hidden rounded-full"
              style={{ background: "var(--input-bg)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${totals.pct}%`,
                  background:
                    totals.pct >= 100
                      ? "var(--sidebar)"
                      : totals.pct >= 60
                        ? "#f59e0b"
                        : "#dc2626",
                }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric
                label={pageText.invoices}
                value={formatMoney(totals.invoicesTotal)}
              />
              <MiniMetric
                label={pageText.unpaid}
                value={formatMoney(totals.unpaidInvoicesTotal)}
                danger={totals.unpaidInvoicesTotal > 0}
              />
            </div>
          </div>

          <div className="card p-5">
            <p
              className="mb-3 text-xs font-black"
              style={{ color: "var(--text-3)" }}
            >
              {pageText.changeStatus}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {statuses.map(([status, label]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateStatus(status)}
                  disabled={caseArchived}
                  title={
                    caseArchived ? pageText.archivedStatusBlocked : undefined
                  }
                  className="rounded-2xl px-3 py-2 text-xs font-black transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  style={
                    c.status === status
                      ? {
                          background: "var(--sidebar)",
                          color: "#fff",
                        }
                      : {
                          background: "var(--green-soft)",
                          color: "var(--text-2)",
                        }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Timeline
            activities={c.activities}
            text={pageText}
            isArabic={isArabic}
          />
        </div>

        {/* Main sections */}
        <div className="space-y-5 xl:col-span-8">
          <SectionCard
            title={pageText.appointmentsSection}
            count={c.appointments.length}
            countLabel={pageText.item}
            action={
              <button
                onClick={() => setAppointmentOpen(true)}
                disabled={caseArchived}
                title={
                  caseArchived ? pageText.archivedAppointmentBlocked : undefined
                }
                className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pageText.appointment}
              </button>
            }
          >
            {c.appointments.length === 0 ? (
              <EmptyLine text={pageText.noAppointments} />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {(upcomingAppointments.length
                  ? upcomingAppointments
                  : c.appointments.slice(0, 6)
                ).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--card)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="badge badge-blue">
                        {appointmentTypeText[appointment.type] ||
                          appointment.type}
                      </span>

                      <div className="text-right">
                        <p
                          className="font-black"
                          style={{ color: "var(--text)" }}
                        >
                          {appointment.title}
                        </p>

                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--text-3)" }}
                        >
                          {formatDate(appointment.startTime)} ·{" "}
                          {formatTime(appointment.startTime)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      style={{ color: "var(--text-2)" }}
                    >
                      <span>
                        {appointmentStatusText[appointment.status] ||
                          appointment.status}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => deleteAppointment(appointment)}
                          disabled={caseArchived}
                          title={
                            caseArchived
                              ? pageText.archivedAppointmentBlocked
                              : undefined
                          }
                          className="rounded-xl px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {pageText.delete}
                        </button>

                        <span>
                          {appointment.location || pageText.noLocation}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={pageText.tasksSection}
            count={c.tasks.length}
            countLabel={pageText.item}
            action={
              <button
                onClick={() => setTaskOpen(true)}
                disabled={caseArchived}
                title={caseArchived ? pageText.archivedTaskBlocked : undefined}
                className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pageText.task}
              </button>
            }
          >
            {c.tasks.length === 0 ? (
              <EmptyLine text={pageText.noTasks} />
            ) : (
              <div className="space-y-2">
                {c.tasks.slice(0, 8).map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      task.completed ? "opacity-60" : ""
                    }`}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTask(task)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black"
                      style={{
                        borderColor: "var(--sidebar)",
                        background: task.completed
                          ? "var(--sidebar)"
                          : "transparent",
                        color: task.completed ? "#fff" : "transparent",
                      }}
                    >
                      ✓
                    </button>

                    <div className="min-w-0 flex-1 text-right">
                      <p
                        className="font-black"
                        style={{ color: "var(--text)" }}
                      >
                        {task.title}
                      </p>

                      <p className="text-xs" style={{ color: "var(--text-3)" }}>
                        {task.dueDate
                          ? `${pageText.dueDate}: ${formatDate(task.dueDate)}`
                          : pageText.noDate}
                      </p>
                    </div>

                    <span
                      className={
                        TASK_PRIORITY_BADGE[task.priority] || "badge badge-gray"
                      }
                    >
                      {taskPriorityText[task.priority] || task.priority}
                    </span>

                    <button
                      type="button"
                      onClick={() => deleteTask(task)}
                      disabled={caseArchived}
                      title={
                        caseArchived ? pageText.archivedTaskBlocked : undefined
                      }
                      className="rounded-xl px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {pageText.delete}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={pageText.invoicesSection}
            count={c.invoices.length}
            countLabel={pageText.item}
            action={
              <button
                onClick={() => setInvoiceOpen(true)}
                className="btn btn-ghost"
              >
                {pageText.invoice}
              </button>
            }
          >
            {c.invoices.length === 0 ? (
              <EmptyLine text={pageText.noInvoices} />
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>{pageText.invoiceNumber}</th>
                      <th>{pageText.status}</th>
                      <th>{pageText.total}</th>
                      <th>{pageText.dueDate}</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {c.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="font-mono font-bold">
                          {invoice.invoiceNumber}
                        </td>

                        <td>
                          <span
                            className={
                              INVOICE_STATUS_BADGE[invoice.status] ||
                              "badge badge-gray"
                            }
                          >
                            {invoiceStatusText[invoice.status] ||
                              invoice.status}
                          </span>
                        </td>

                        <td
                          dir="ltr"
                          className={`whitespace-nowrap font-bold ${isRtl ? "text-right" : "text-left"}`}
                        >
                          {formatMoney(invoice.total)}
                        </td>

                        <td>
                          {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
                        </td>

                        <td>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/invoices/${invoice.id}`}
                              className="text-xs font-bold hover:underline"
                              style={{ color: "var(--sidebar)" }}
                            >
                              {pageText.open}
                            </Link>

                            <button
                              type="button"
                              onClick={() => deleteInvoice(invoice)}
                              disabled={!!invoice.payment || caseArchived}
                              title={
                                caseArchived
                                  ? pageText.archivedInvoiceBlocked
                                  : invoice.payment
                                    ? isArabic
                                      ? "لا يمكن حذف فاتورة مرتبطة بدفعة"
                                      : "Cannot delete an invoice linked to a payment"
                                    : isArabic
                                      ? "حذف الفاتورة"
                                      : "Delete invoice"
                              }
                              className="rounded-xl px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {pageText.delete}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={pageText.paymentsSection}
            count={c.payments.length}
            countLabel={pageText.item}
            action={
              <button
                onClick={() => setPaymentOpen(true)}
                className="btn btn-ghost"
              >
                {pageText.payment}
              </button>
            }
          >
            {c.payments.length === 0 ? (
              <EmptyLine text={pageText.noPayments} />
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>{pageText.date}</th>
                      <th>{pageText.amount}</th>
                      <th>{pageText.method}</th>
                      <th>{pageText.status}</th>
                      <th>{pageText.invoice}</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {c.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="text-sm">
                          {formatDate(payment.paidAt)}
                        </td>

                        <td
                          dir="ltr"
                          className={`whitespace-nowrap font-bold ${isRtl ? "text-right" : "text-left"}`}
                        >
                          {formatMoney(payment.amount)}
                        </td>

                        <td style={{ color: "var(--text-2)" }}>
                          {methodText[payment.method] || payment.method}
                        </td>

                        <td>
                          <span
                            className={
                              PMT_STATUS[payment.status] || "badge badge-gray"
                            }
                          >
                            {paymentStatusText[payment.status] ||
                              payment.status}
                          </span>
                        </td>

                        <td>
                          {payment.invoice ? (
                            <Link
                              href={`/dashboard/invoices/${payment.invoice.id}`}
                              className="text-xs font-bold hover:underline"
                              style={{ color: "var(--sidebar)" }}
                            >
                              {payment.invoice.invoiceNumber}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              if (caseArchived) {
                                toast.error(
                                  pageText.archivedPaymentDeleteBlocked,
                                );
                                return;
                              }

                              if (payment.invoice) {
                                toast.error(
                                  isArabic
                                    ? isArabic
                                      ? "لا يمكن حذف دفعة مرتبطة بفاتورة. افتح الفاتورة وغيّر حالتها أولًا."
                                      : "Cannot delete a payment linked to an invoice. Open the invoice and change its status first."
                                    : "Cannot delete a payment linked to an invoice. Open the invoice and change its status first.",
                                );
                                return;
                              }

                              setDeleteId(payment.id);
                            }}
                            title={
                              caseArchived
                                ? pageText.archivedPaymentDeleteBlocked
                                : payment.invoice
                                  ? isArabic
                                    ? "دفعة مرتبطة بفاتورة"
                                    : "Payment linked to an invoice"
                                  : isArabic
                                    ? "حذف الدفعة"
                                    : "Delete payment"
                            }
                            className={`text-sm transition-colors ${
                              payment.invoice || caseArchived
                                ? "cursor-not-allowed text-gray-300"
                                : "text-red-400 hover:text-red-600"
                            }`}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={pageText.documentsSection}
            count={c.documents.length}
            countLabel={pageText.item}
            action={
              <button
                onClick={() => setDocumentOpen(true)}
                disabled={caseArchived}
                title={
                  caseArchived ? pageText.archivedDocumentBlocked : undefined
                }
                className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pageText.document}
              </button>
            }
          >
            {c.documents.length === 0 ? (
              <EmptyLine text={pageText.noDocuments} />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {c.documents.slice(0, 8).map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl border p-4 transition-all hover:-translate-y-0.5"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--card)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-2xl">
                        {documentIcon(doc.fileType)}
                      </span>

                      <div className="min-w-0 text-right">
                        <p
                          className="truncate font-black"
                          style={{ color: "var(--text)" }}
                        >
                          {doc.fileName}
                        </p>

                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--text-3)" }}
                        >
                          {formatDate(doc.createdAt)}
                          {doc.fileSize
                            ? ` · ${fileSizeLabel(doc.fileSize)}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {!!doc.tags?.length && (
                      <div className="mt-3 flex flex-wrap justify-end gap-1">
                        {doc.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="badge badge-gray">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex justify-end gap-2">
                      <a
                        href={`/api/documents/${doc.id}/preview`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost text-xs"
                      >
                        {pageText.preview}
                      </a>

                      <button
                        type="button"
                        onClick={() => deleteDocument(doc)}
                        disabled={caseArchived}
                        title={
                          caseArchived
                            ? pageText.archivedDocumentBlocked
                            : undefined
                        }
                        className="btn text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          background: "var(--red-soft)",
                          color: "#dc2626",
                        }}
                      >
                        {pageText.delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        open={paymentOpen}
        onClose={() => {
          setPaymentOpen(false);
          setPaymentForm(PMT_INIT);
        }}
        title={pageText.addPaymentTitle}
      >
        <form
          onSubmit={addPayment}
          className="space-y-3"
          dir={isRtl ? "rtl" : "ltr"}
        >
          {caseArchived && (
            <div
              className="rounded-2xl border p-3 text-xs font-bold leading-6"
              style={{
                background: "#fff7ed",
                color: "#b45309",
                borderColor: "rgba(180, 83, 9, 0.22)",
              }}
            >
              {pageText.archivedPaymentHint}
            </div>
          )}

          <FormField label={pageText.amount} required>
            <input
              dir="ltr"
              type="number"
              className="input text-start"
              value={paymentForm.amount}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  amount: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={pageText.method}>
              <select
                className="input"
                value={paymentForm.method}
                onChange={(event) =>
                  setPaymentForm((previous) => ({
                    ...previous,
                    method: event.target.value,
                  }))
                }
              >
                <option value="CASH">{methodText.CASH}</option>
                <option value="BANK_TRANSFER">
                  {methodText.BANK_TRANSFER}
                </option>
                <option value="CHECK">{methodText.CHECK}</option>
                <option value="ONLINE">{methodText.ONLINE}</option>
              </select>
            </FormField>

            <FormField label={pageText.status}>
              <select
                className="input"
                value={paymentForm.status}
                onChange={(event) =>
                  setPaymentForm((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))
                }
              >
                <option value="PAID">{paymentStatusText.PAID}</option>
                <option value="PENDING">{paymentStatusText.PENDING}</option>
                <option value="OVERDUE">{paymentStatusText.OVERDUE}</option>
                <option value="CANCELLED">{paymentStatusText.CANCELLED}</option>
              </select>
            </FormField>
          </div>

          <FormField label={pageText.paymentDate}>
            <input
              type="datetime-local"
              className="input"
              value={paymentForm.paidAt}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  paidAt: event.target.value,
                }))
              }
            />
          </FormField>

          <FormField label={pageText.notes}>
            <textarea
              className="input resize-none text-start"
              rows={3}
              value={paymentForm.notes}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPaymentOpen(false)}
              className="btn btn-ghost flex-1"
            >
              {pageText.cancel}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? pageText.saving : pageText.savePayment}
            </button>
          </div>
        </form>
      </Modal>

      {/* Appointment Modal */}
      <Modal
        open={appointmentOpen}
        onClose={() => {
          setAppointmentOpen(false);
          setAppointmentForm(APPOINTMENT_INIT);
        }}
        title={pageText.addAppointmentTitle}
      >
        <form
          onSubmit={addAppointment}
          className="space-y-3"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <FormField label={pageText.title} required>
            <input
              className="input"
              value={appointmentForm.title}
              onChange={(event) =>
                setAppointmentForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={pageText.type}>
              <select
                className="input"
                value={appointmentForm.type}
                onChange={(event) =>
                  setAppointmentForm((previous) => ({
                    ...previous,
                    type: event.target.value,
                  }))
                }
              >
                <option value="COURT_SESSION">
                  {appointmentTypeText.COURT_SESSION}
                </option>
                <option value="MEETING">{appointmentTypeText.MEETING}</option>
                <option value="PHONE_CALL">
                  {appointmentTypeText.PHONE_CALL}
                </option>
                <option value="DEADLINE">{appointmentTypeText.DEADLINE}</option>
                <option value="OTHER">{appointmentTypeText.OTHER}</option>
              </select>
            </FormField>

            <FormField label={pageText.location}>
              <input
                className="input"
                value={appointmentForm.location}
                onChange={(event) =>
                  setAppointmentForm((previous) => ({
                    ...previous,
                    location: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={pageText.startTime} required>
              <input
                type="datetime-local"
                className="input"
                value={appointmentForm.startTime}
                onChange={(event) =>
                  setAppointmentForm((previous) => ({
                    ...previous,
                    startTime: event.target.value,
                  }))
                }
              />
            </FormField>

            <FormField label={pageText.endTime}>
              <input
                type="datetime-local"
                className="input"
                value={appointmentForm.endTime}
                onChange={(event) =>
                  setAppointmentForm((previous) => ({
                    ...previous,
                    endTime: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <FormField label={pageText.description}>
            <textarea
              className="input resize-none text-start"
              rows={3}
              value={appointmentForm.description}
              onChange={(event) =>
                setAppointmentForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAppointmentOpen(false)}
              className="btn btn-ghost flex-1"
            >
              {pageText.cancel}
            </button>

            <button
              type="submit"
              disabled={saving || caseArchived}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? pageText.saving : pageText.saveAppointment}
            </button>
          </div>
        </form>
      </Modal>

      {/* Task Modal */}
      <Modal
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false);
          setTaskForm(TASK_INIT);
        }}
        title={pageText.addTaskTitle}
      >
        <form
          onSubmit={addTask}
          className="space-y-3"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <FormField label={pageText.title} required>
            <input
              className="input"
              value={taskForm.title}
              onChange={(event) =>
                setTaskForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={pageText.priority}>
              <select
                className="input"
                value={taskForm.priority}
                onChange={(event) =>
                  setTaskForm((previous) => ({
                    ...previous,
                    priority: event.target.value,
                  }))
                }
              >
                <option value="URGENT">{taskPriorityText.URGENT}</option>
                <option value="HIGH">{taskPriorityText.HIGH}</option>
                <option value="MEDIUM">{taskPriorityText.MEDIUM}</option>
                <option value="LOW">{taskPriorityText.LOW}</option>
              </select>
            </FormField>

            <FormField label={pageText.dueDate}>
              <input
                type="date"
                className="input"
                value={taskForm.dueDate}
                onChange={(event) =>
                  setTaskForm((previous) => ({
                    ...previous,
                    dueDate: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <FormField label={pageText.description}>
            <textarea
              className="input resize-none text-start"
              rows={3}
              value={taskForm.description}
              onChange={(event) =>
                setTaskForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTaskOpen(false)}
              className="btn btn-ghost flex-1"
            >
              {pageText.cancel}
            </button>

            <button
              type="submit"
              disabled={saving || caseArchived}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? pageText.saving : pageText.saveTask}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice Modal */}
      <Modal
        open={invoiceOpen}
        onClose={() => {
          setInvoiceOpen(false);
          setInvoiceForm(INVOICE_INIT);
        }}
        title={pageText.createInvoiceTitle}
      >
        <form
          onSubmit={createInvoice}
          className="space-y-3"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <FormField label={pageText.itemDescription} required>
            <input
              className="input"
              value={invoiceForm.description}
              onChange={(event) =>
                setInvoiceForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label={pageText.amount} required>
              <input
                type="number"
                className="input"
                value={invoiceForm.amount}
                onChange={(event) =>
                  setInvoiceForm((previous) => ({
                    ...previous,
                    amount: event.target.value,
                  }))
                }
              />
            </FormField>

            <FormField label={pageText.tax}>
              <input
                type="number"
                className="input"
                value={invoiceForm.tax}
                onChange={(event) =>
                  setInvoiceForm((previous) => ({
                    ...previous,
                    tax: event.target.value,
                  }))
                }
              />
            </FormField>

            <FormField label={pageText.discount}>
              <input
                type="number"
                className="input"
                value={invoiceForm.discount}
                onChange={(event) =>
                  setInvoiceForm((previous) => ({
                    ...previous,
                    discount: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <FormField label={pageText.dueDate}>
            <input
              type="date"
              className="input"
              value={invoiceForm.dueDate}
              onChange={(event) =>
                setInvoiceForm((previous) => ({
                  ...previous,
                  dueDate: event.target.value,
                }))
              }
            />
          </FormField>

          <FormField label={pageText.notes}>
            <textarea
              className="input resize-none text-start"
              rows={3}
              value={invoiceForm.notes}
              onChange={(event) =>
                setInvoiceForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setInvoiceOpen(false)}
              className="btn btn-ghost flex-1"
            >
              {pageText.cancel}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? pageText.creating : pageText.createInvoice}
            </button>
          </div>
        </form>
      </Modal>

      {/* Document Modal */}
      <Modal
        open={documentOpen}
        onClose={() => {
          setDocumentOpen(false);
          setDocumentForm(DOCUMENT_INIT);
          if (documentInputRef.current) documentInputRef.current.value = "";
        }}
        title={pageText.uploadDocumentTitle}
      >
        <div className="space-y-3">
          <FormField label={pageText.documentCategory}>
            <select
              className="input"
              value={documentForm.tag}
              onChange={(event) =>
                setDocumentForm((previous) => ({
                  ...previous,
                  tag: event.target.value,
                }))
              }
            >
              {DOCUMENT_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={pageText.notes}>
            <textarea
              className="input resize-none text-start"
              rows={3}
              value={documentForm.notes}
              onChange={(event) =>
                setDocumentForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
            />
          </FormField>

          <input
            ref={documentInputRef}
            type="file"
            className="input disabled:cursor-not-allowed disabled:opacity-50"
            disabled={caseArchived}
            onChange={(event) => uploadCaseDocument(event.target.files?.[0])}
          />

          <div
            className="rounded-2xl border p-3 text-xs leading-6"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-3)",
              background: "var(--green-soft)",
            }}
          >
            {caseArchived
              ? pageText.archivedDocumentBlocked
              : pageText.documentUploadHint}
          </div>

          {uploadingDocument && (
            <div
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--text-2)" }}
            >
              <span className="spinner spinner-sm" />
              {pageText.uploading}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Payment Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => {
          if (!deleteLoading) setDeleteId(null);
        }}
        title={pageText.deletePaymentTitle}
      >
        <div className="space-y-4">
          <p className="text-sm leading-7" style={{ color: "var(--text-2)" }}>
            {pageText.deletePaymentConfirm}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={deleteLoading}
              onClick={() => setDeleteId(null)}
              className="btn btn-ghost flex-1"
            >
              {pageText.cancel}
            </button>

            <button
              type="button"
              disabled={deleteLoading}
              onClick={confirmDeletePayment}
              className="btn flex-1"
              style={{ background: "#dc2626", color: "#fff" }}
            >
              {deleteLoading ? pageText.deleting : pageText.delete}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
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
        dir="ltr"
        className="mt-1 whitespace-nowrap text-sm font-black"
        style={{ color: danger ? "#dc2626" : "var(--text)" }}
      >
        {value}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  count,
  action,
  children,
  countLabel,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
  countLabel: string;
}) {
  return (
    <div className="card overflow-hidden p-0">
      <div
        className="flex items-center justify-between gap-4 border-b px-5 py-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <h2 className="font-black" style={{ color: "var(--text)" }}>
            {title}
          </h2>

          <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
            {count} {countLabel}
          </p>
        </div>

        {action}
      </div>

      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div
      className="rounded-2xl border border-dashed p-6 text-center text-sm font-bold"
      style={{
        borderColor: "var(--border)",
        color: "var(--text-3)",
      }}
    >
      {text}
    </div>
  );
}

function Timeline({
  activities,
  text,
  isArabic,
}: {
  activities: Activity[];
  text: {
    latestActivities: string;
    latestActivitiesHint: string;
    noActivities: string;
  };
  isArabic: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h2 className="font-black" style={{ color: "var(--text)" }}>
          {text.latestActivities}
        </h2>

        <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
          {text.latestActivitiesHint}
        </p>
      </div>

      {activities.length === 0 ? (
        <EmptyLine text={text.noActivities} />
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 8).map((activity) => (
            <div
              key={activity.id}
              className="rounded-2xl border p-3"
              style={{
                borderColor: "var(--border)",
                background: "var(--card)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: "var(--green-soft)" }}
                >
                  {ACTIVITY_ICON[activity.type] || "✨"}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold" style={{ color: "var(--text)" }}>
                    {activityTitle(activity, isArabic)}
                  </p>

                  {activityMessage(activity, isArabic) && (
                    <p
                      className="mt-1 text-xs leading-6"
                      style={{ color: "var(--text-3)" }}
                    >
                      {activityMessage(activity, isArabic)}
                    </p>
                  )}

                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--text-3)" }}
                  >
                    {activityDate(activity.createdAt, isArabic)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
