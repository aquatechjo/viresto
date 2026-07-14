"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FilePlus2,
  FolderOpen,
  ListTodo,
  ReceiptText,
  Sparkles,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import AppLoader from "@/components/ui/AppLoader";

const TENANT_TIME_ZONE = "Asia/Amman";

interface AppointmentItem {
  id: string;
  title: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  type: string;
  status?: string;
  client?: {
    id?: string;
    name: string;
  } | null;
  case?: {
    id?: string;
    title: string;
    caseNumber?: string | null;
  } | null;
}

interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  completed: boolean;
  client?: {
    id?: string;
    name: string;
  } | null;
  case?: {
    id?: string;
    title: string;
    caseNumber?: string | null;
  } | null;
}

interface InvoiceAlertItem {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  total: number;
  paidAmount: number;
  outstandingAmount: number;
  isOverdue: boolean;
  client?: {
    id?: string;
    name: string;
  } | null;
  case?: {
    id?: string;
    title: string;
    caseNumber?: string | null;
  } | null;
}

interface Stats {
  timeZone?: string;
  clientCount: number;
  activeCaseCount: number;
  totalCasesCount: number;
  closedCasesCount: number;
  closedCaseRate: number;
  monthlyRevenue: number;
  todayApptCount: number;
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  newClientsThisMonth: number;
  dueTasksCount: number;
  dueTodayTasksCount: number;
  overdueTasksCount: number;
  unpaidInvoicesCount: number;
  overdueInvoicesCount: number;
  todayAppts: AppointmentItem[];
  upcomingAppointments: AppointmentItem[];
  upcomingTasks: TaskItem[];
  overdueInvoices: InvoiceAlertItem[];
}

interface CaseItem {
  id: string;
  title: string;
  caseNumber?: string;
  status: string;
  client?: {
    name: string;
  };
}

interface DocumentItem {
  id: string;
  fileName: string;
  fileType?: string;
  createdAt: string;
  tags?: string[];
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  message?: string;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: "badge badge-green",
  IN_PROGRESS: "badge badge-blue",
  CLOSED: "badge badge-gray",
  ARCHIVED: "badge badge-gray",
};

const STATUS_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    OPEN: "نشطة",
    IN_PROGRESS: "قيد المتابعة",
    CLOSED: "مغلقة",
    ARCHIVED: "مؤرشفة",
  },
  en: {
    OPEN: "Active",
    IN_PROGRESS: "In progress",
    CLOSED: "Closed",
    ARCHIVED: "Archived",
  },
};

const PRIORITY_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    HIGH: "عالية",
    MEDIUM: "متوسطة",
    LOW: "منخفضة",
  },
  en: {
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
  },
};

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  MEDIUM:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  LOW: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const TYPE_COLOR: Record<string, string> = {
  COURT_SESSION: "var(--sidebar)",
  MEETING: "#2563eb",
  PHONE_CALL: "var(--gold)",
  DEADLINE: "#dc2626",
  OTHER: "var(--text-3)",
};

const ACTIVITY_CONFIG: Record<
  string,
  {
    icon: string;
    color: string;
  }
> = {
  CLIENT_CREATED: {
    icon: "👤",
    color: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  },
  CASE_CREATED: {
    icon: "⚖️",
    color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
  },
  APPOINTMENT_CREATED: {
    icon: "📅",
    color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  },
  PAYMENT_CREATED: {
    icon: "💰",
    color: "bg-green-500/20 text-green-700 border-green-500/30",
  },
  DOCUMENT_UPLOADED: {
    icon: "📄",
    color: "bg-purple-500/20 text-purple-700 border-purple-500/30",
  },
  DOCUMENT_DELETED: {
    icon: "✨",
    color: "bg-red-500/20 text-red-700 border-red-500/30",
  },
  DOCUMENT_UPDATED: {
    icon: "📝",
    color: "bg-purple-500/20 text-purple-700 border-purple-500/30",
  },
  DOCUMENT_OPENED: {
    icon: "📖",
    color: "bg-purple-500/20 text-purple-700 border-purple-500/30",
  },
  USER_CREATED: {
    icon: "👥",
    color: "bg-cyan-500/20 text-cyan-700 border-cyan-500/30",
  },
  AI_ASSISTANT_ENABLED: {
    icon: "✨",
    color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
  },
  AI_ASSISTANT_DISABLED: {
    icon: "✨",
    color: "bg-slate-500/20 text-slate-700 border-slate-500/30",
  },
};

const TEXT = {
  ar: {
    dashboardBadge: "مركز العمل اليومي",
    morning: "صباح الخير",
    afternoon: "مساء الخير",
    evening: "مساء الخير",
    defaultUser: "مرحبًا بك",
    clearDay: "لا توجد عناصر عاجلة تحتاج متابعة اليوم.",
    dailySummary: (appointments: number, tasks: number) =>
      `لديك ${appointments} موعد اليوم و${tasks} مهمة تحتاج متابعة.`,
    quickActions: "إجراءات سريعة",
    addClient: "إضافة موكل",
    addCase: "إضافة قضية",
    addAppointment: "إنشاء موعد",
    createInvoice: "إنشاء فاتورة",

    activeCases: "القضايا النشطة",
    activeCasesSub: "قضايا مفتوحة وقيد المتابعة",
    todayAppointments: "مواعيد اليوم",
    todayAppointmentsSub: "المواعيد المجدولة لهذا اليوم",
    dueTasks: "مهام تحتاج متابعة",
    dueTasksSub: "مستحقة اليوم أو متأخرة",
    receivables: "المبالغ غير المحصلة",
    receivablesSub: "الرصيد المتبقي على الفواتير",

    needsAttention: "يحتاج انتباهك",
    needsAttentionSub: "العناصر الأهم التي تتطلب إجراءً مباشرًا",
    noAttention: "الوضع مستقر",
    noAttentionSub: "لا توجد فواتير أو مهام متأخرة حاليًا.",
    overdueTasksTitle: (count: number) => `${count} مهمة متأخرة`,
    overdueTasksMessage: "تجاوزت موعد الاستحقاق وما تزال غير مكتملة.",
    dueTodayTasksTitle: (count: number) => `${count} مهمة مستحقة اليوم`,
    dueTodayTasksMessage: "راجع المهام قبل نهاية يوم العمل.",
    overdueInvoicesTitle: (count: number) => `${count} فاتورة متأخرة`,
    overdueInvoicesMessage: (amount: string) =>
      `إجمالي الرصيد المتأخر ${amount}.`,
    upcomingAppointmentTitle: "أقرب موعد قادم",
    viewDetails: "عرض التفاصيل",

    todaySchedule: "جدول اليوم",
    todayScheduleSub: "المواعيد المرتبة حسب الوقت",
    noAppointmentsToday: "لا توجد مواعيد اليوم",
    addAppointmentAction: "إنشاء موعد جديد",
    upcomingTasks: "المهام القادمة",
    upcomingTasksSub: "الأقرب استحقاقًا والأعلى أولوية",
    noUpcomingTasks: "لا توجد مهام غير مكتملة",
    addTaskAction: "إنشاء مهمة",
    overdue: "متأخرة",
    dueToday: "اليوم",

    recentCases: "أحدث القضايا",
    recentCasesSub: "آخر القضايا المسجلة أو المحدثة",
    noCases: "لا توجد قضايا",
    noClient: "بدون موكل",
    viewAllCases: "عرض كل القضايا",

    officeSummary: "ملخص المكتب",
    officeSummarySub: "مؤشرات عامة عن العمل والتحصيل",
    clients: "الموكلون",
    thisMonth: "هذا الشهر",
    totalCases: "إجمالي القضايا",
    closedCases: "القضايا المغلقة",
    monthlyRevenue: "تحصيل الشهر",
    totalRevenue: "إجمالي التحصيل",

    recentDocuments: "آخر المستندات",
    recentDocumentsSub: "أحدث الملفات التي رُفعت إلى النظام",
    noDocuments: "لا توجد مستندات بعد",
    viewAllDocuments: "عرض كل المستندات",

    assistant: "المساعد القانوني الذكي",
    assistantSub: "اسأل عن القضايا والمواعيد والعمل اليومي",

    recentActivities: "آخر النشاطات",
    recentActivitiesSub: "أحدث العمليات المسجلة داخل المكتب",
    noActivities: "لا توجد نشاطات حاليًا",
    viewAllActivities: "عرض سجل النشاط",

    viewAll: "عرض الكل",
    loadingFailed: "تعذر تحميل بعض بيانات لوحة التحكم.",
  },
  en: {
    dashboardBadge: "Daily workspace",
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    defaultUser: "Welcome",
    clearDay: "There are no urgent items requiring attention today.",
    dailySummary: (appointments: number, tasks: number) =>
      `You have ${appointments} appointment(s) today and ${tasks} task(s) requiring attention.`,
    quickActions: "Quick actions",
    addClient: "Add client",
    addCase: "Add case",
    addAppointment: "Create appointment",
    createInvoice: "Create invoice",

    activeCases: "Active cases",
    activeCasesSub: "Open and in-progress cases",
    todayAppointments: "Today's appointments",
    todayAppointmentsSub: "Appointments scheduled for today",
    dueTasks: "Tasks requiring attention",
    dueTasksSub: "Due today or overdue",
    receivables: "Outstanding receivables",
    receivablesSub: "Remaining balance on invoices",

    needsAttention: "Needs your attention",
    needsAttentionSub: "Important items requiring direct action",
    noAttention: "Everything is on track",
    noAttentionSub: "There are no overdue invoices or tasks right now.",
    overdueTasksTitle: (count: number) => `${count} overdue task(s)`,
    overdueTasksMessage: "Past the due date and still incomplete.",
    dueTodayTasksTitle: (count: number) => `${count} task(s) due today`,
    dueTodayTasksMessage: "Review these tasks before the end of the workday.",
    overdueInvoicesTitle: (count: number) => `${count} overdue invoice(s)`,
    overdueInvoicesMessage: (amount: string) =>
      `Total overdue balance is ${amount}.`,
    upcomingAppointmentTitle: "Next upcoming appointment",
    viewDetails: "View details",

    todaySchedule: "Today's schedule",
    todayScheduleSub: "Appointments ordered by time",
    noAppointmentsToday: "No appointments today",
    addAppointmentAction: "Create an appointment",
    upcomingTasks: "Upcoming tasks",
    upcomingTasksSub: "Nearest due dates and highest priorities",
    noUpcomingTasks: "No incomplete tasks",
    addTaskAction: "Create task",
    overdue: "Overdue",
    dueToday: "Today",

    recentCases: "Recent cases",
    recentCasesSub: "Latest registered or updated cases",
    noCases: "No cases found",
    noClient: "No client",
    viewAllCases: "View all cases",

    officeSummary: "Office summary",
    officeSummarySub: "General work and collection indicators",
    clients: "Clients",
    thisMonth: "this month",
    totalCases: "Total cases",
    closedCases: "Closed cases",
    monthlyRevenue: "Monthly collections",
    totalRevenue: "Total collections",

    recentDocuments: "Recent documents",
    recentDocumentsSub: "Latest files uploaded to the system",
    noDocuments: "No documents yet",
    viewAllDocuments: "View all documents",

    assistant: "AI legal assistant",
    assistantSub: "Ask about cases, appointments, and daily work",

    recentActivities: "Recent activities",
    recentActivitiesSub: "Latest actions logged in the office",
    noActivities: "No activities yet",
    viewAllActivities: "View activity log",

    viewAll: "View all",
    loadingFailed: "Some dashboard data could not be loaded.",
  },
} as const;

const ACTIVITY_TEXT: Record<
  Locale,
  Record<string, { title: string; message?: string }>
> = {
  ar: {
    LOGIN_SUCCESS: { title: "تم تسجيل الدخول بنجاح" },
    LOGIN_NEW_IP: { title: "تسجيل دخول من جهاز أو IP جديد" },
    NEW_IP_LOGIN: { title: "تسجيل دخول من جهاز أو IP جديد" },
    NEW_DEVICE_LOGIN: { title: "تسجيل دخول من جهاز أو IP جديد" },
    SECURITY_LOGIN: { title: "تسجيل دخول من جهاز أو IP جديد" },
    SUSPICIOUS_LOGIN: { title: "تسجيل دخول من جهاز أو IP جديد" },

    CLIENT_CREATED: { title: "تم إنشاء موكل جديد" },
    CLIENT_UPDATED: { title: "تم تعديل بيانات موكل" },
    CLIENT_DELETED: { title: "تم حذف موكل" },

    CASE_CREATED: { title: "تم إنشاء قضية جديدة" },
    CASE_UPDATED: { title: "تم تعديل قضية" },
    CASE_DELETED: { title: "تم حذف قضية" },

    APPOINTMENT_CREATED: { title: "تم إنشاء موعد جديد" },
    APPOINTMENT_UPDATED: { title: "تم تعديل موعد" },
    APPOINTMENT_DELETED: { title: "تم حذف موعد" },

    PAYMENT_CREATED: { title: "تم تسجيل دفعة جديدة" },
    PAYMENT_ADDED: { title: "تم تسجيل دفعة جديدة" },
    PAYMENT_UPDATED: { title: "تم تعديل دفعة" },
    PAYMENT_DELETED: { title: "تم حذف دفعة" },

    DOCUMENT_UPLOADED: { title: "تم رفع مستند جديد" },
    DOCUMENT_CREATED: { title: "تم رفع مستند جديد" },
    DOCUMENT_UPDATED: { title: "تم تعديل مستند" },
    DOCUMENT_DELETED: { title: "تم حذف مستند" },
    DOCUMENT_OPENED: { title: "تم فتح مستند" },
    DOCUMENT_VIEWED: { title: "تم فتح مستند" },
    DOCUMENT_PREVIEWED: { title: "تم فتح مستند" },

    USER_CREATED: { title: "تم إنشاء مستخدم جديد" },
    USER_UPDATED: { title: "تم تعديل مستخدم" },
    USER_DISABLED: { title: "تم تعطيل مستخدم" },
    USER_ENABLED: { title: "تم تفعيل مستخدم" },

    AI_ASSISTANT_ENABLED: { title: "تم تفعيل المساعد الذكي" },
    AI_ASSISTANT_DISABLED: { title: "تم تعطيل المساعد الذكي" },
  },
  en: {
    LOGIN_SUCCESS: { title: "Signed in successfully" },
    LOGIN_NEW_IP: { title: "New device or IP sign-in" },
    NEW_IP_LOGIN: { title: "New device or IP sign-in" },
    NEW_DEVICE_LOGIN: { title: "New device or IP sign-in" },
    SECURITY_LOGIN: { title: "New device or IP sign-in" },
    SUSPICIOUS_LOGIN: { title: "New device or IP sign-in" },

    CLIENT_CREATED: { title: "New client created" },
    CLIENT_UPDATED: { title: "Client updated" },
    CLIENT_DELETED: { title: "Client deleted" },

    CASE_CREATED: { title: "New case created" },
    CASE_UPDATED: { title: "Case updated" },
    CASE_DELETED: { title: "Case deleted" },

    APPOINTMENT_CREATED: { title: "New appointment created" },
    APPOINTMENT_UPDATED: { title: "Appointment updated" },
    APPOINTMENT_DELETED: { title: "Appointment deleted" },

    PAYMENT_CREATED: { title: "New payment recorded" },
    PAYMENT_ADDED: { title: "New payment recorded" },
    PAYMENT_UPDATED: { title: "Payment updated" },
    PAYMENT_DELETED: { title: "Payment deleted" },

    DOCUMENT_UPLOADED: { title: "New document uploaded" },
    DOCUMENT_CREATED: { title: "New document uploaded" },
    DOCUMENT_UPDATED: { title: "Document updated" },
    DOCUMENT_DELETED: { title: "Document deleted" },
    DOCUMENT_OPENED: { title: "Document opened" },
    DOCUMENT_VIEWED: { title: "Document opened" },
    DOCUMENT_PREVIEWED: { title: "Document opened" },

    USER_CREATED: { title: "New user created" },
    USER_UPDATED: { title: "User updated" },
    USER_DISABLED: { title: "User disabled" },
    USER_ENABLED: { title: "User enabled" },

    AI_ASSISTANT_ENABLED: { title: "AI assistant enabled" },
    AI_ASSISTANT_DISABLED: { title: "AI assistant disabled" },
  },
};

function containsAny(source: string, patterns: string[]) {
  return patterns.some((pattern) => source.includes(pattern));
}
function normalizeActivityType(activity: ActivityItem) {
  const source = `${activity.type ?? ""} ${activity.title ?? ""} ${activity.message ?? ""}`;
  const normalized = source.toLowerCase();

  if (
    containsAny(source, ["LOGIN_SUCCESS", "تم تسجيل الدخول بنجاح"]) ||
    containsAny(normalized, ["signed in successfully", "login success"])
  ) {
    return "LOGIN_SUCCESS";
  }

  if (
    containsAny(source, [
      "LOGIN_NEW_IP",
      "NEW_IP_LOGIN",
      "NEW_DEVICE_LOGIN",
      "SECURITY_LOGIN",
      "SUSPICIOUS_LOGIN",
      "جديد IP",
      "IP جديد",
    ]) ||
    containsAny(normalized, ["new device", "new ip", "suspicious login"])
  ) {
    return "LOGIN_NEW_IP";
  }

  if (
    containsAny(source, [
      "DOCUMENT_OPENED",
      "DOCUMENT_VIEWED",
      "DOCUMENT_PREVIEWED",
      "OPEN_DOCUMENT",
      "VIEW_DOCUMENT",
      "PREVIEW_DOCUMENT",
      "فتح مستند",
      "عرض مستند",
      "معاينة مستند",
    ]) ||
    containsAny(normalized, [
      "document opened",
      "opened document",
      "document viewed",
      "viewed document",
      "document previewed",
      "previewed document",
    ])
  ) {
    return "DOCUMENT_OPENED";
  }

  if (
    containsAny(source, [
      "DOCUMENT_DELETED",
      "DOCUMENT_DELETE",
      "DELETE_DOCUMENT",
      "حذف مستند",
    ]) ||
    containsAny(normalized, ["document deleted", "deleted document"])
  ) {
    return "DOCUMENT_DELETED";
  }

  if (
    containsAny(source, [
      "DOCUMENT_UPDATED",
      "UPDATE_DOCUMENT",
      "تعديل مستند",
      "تحديث مستند",
    ]) ||
    containsAny(normalized, ["document updated", "updated document"])
  ) {
    return "DOCUMENT_UPDATED";
  }

  if (
    containsAny(source, [
      "DOCUMENT_UPLOADED",
      "DOCUMENT_CREATED",
      "UPLOAD_DOCUMENT",
      "رفع مستند",
      "مستند جديد",
    ]) ||
    containsAny(normalized, [
      "new document uploaded",
      "document uploaded",
      "uploaded document",
    ])
  ) {
    return "DOCUMENT_UPLOADED";
  }

  if (
    containsAny(source, ["CLIENT_DELETED", "DELETE_CLIENT", "حذف موكل"]) ||
    containsAny(normalized, ["client deleted", "deleted client"])
  ) {
    return "CLIENT_DELETED";
  }

  if (
    containsAny(source, [
      "CLIENT_UPDATED",
      "UPDATE_CLIENT",
      "تعديل موكل",
      "تحديث موكل",
    ]) ||
    containsAny(normalized, ["client updated", "updated client"])
  ) {
    return "CLIENT_UPDATED";
  }

  if (
    containsAny(source, [
      "CLIENT_CREATED",
      "CREATE_CLIENT",
      "موكل جديد",
      "إنشاء موكل",
    ]) ||
    containsAny(normalized, ["new client", "client created", "created client"])
  ) {
    return "CLIENT_CREATED";
  }

  if (
    containsAny(source, ["CASE_DELETED", "DELETE_CASE", "حذف قضية"]) ||
    containsAny(normalized, ["case deleted", "deleted case"])
  ) {
    return "CASE_DELETED";
  }

  if (
    containsAny(source, [
      "CASE_UPDATED",
      "UPDATE_CASE",
      "تعديل قضية",
      "تحديث قضية",
    ]) ||
    containsAny(normalized, ["case updated", "updated case"])
  ) {
    return "CASE_UPDATED";
  }

  if (
    containsAny(source, [
      "CASE_CREATED",
      "CREATE_CASE",
      "قضية جديدة",
      "إنشاء قضية",
    ]) ||
    containsAny(normalized, ["new case", "case created", "created case"])
  ) {
    return "CASE_CREATED";
  }

  if (
    containsAny(source, [
      "APPOINTMENT_DELETED",
      "DELETE_APPOINTMENT",
      "حذف موعد",
    ]) ||
    containsAny(normalized, ["appointment deleted", "deleted appointment"])
  ) {
    return "APPOINTMENT_DELETED";
  }

  if (
    containsAny(source, [
      "APPOINTMENT_UPDATED",
      "UPDATE_APPOINTMENT",
      "تعديل موعد",
      "تحديث موعد",
    ]) ||
    containsAny(normalized, ["appointment updated", "updated appointment"])
  ) {
    return "APPOINTMENT_UPDATED";
  }

  if (
    containsAny(source, [
      "APPOINTMENT_CREATED",
      "CREATE_APPOINTMENT",
      "موعد جديد",
      "إنشاء موعد",
    ]) ||
    containsAny(normalized, [
      "new appointment",
      "appointment created",
      "created appointment",
    ])
  ) {
    return "APPOINTMENT_CREATED";
  }

  if (
    containsAny(source, ["PAYMENT_DELETED", "DELETE_PAYMENT", "حذف دفعة"]) ||
    containsAny(normalized, ["payment deleted", "deleted payment"])
  ) {
    return "PAYMENT_DELETED";
  }

  if (
    containsAny(source, [
      "PAYMENT_UPDATED",
      "UPDATE_PAYMENT",
      "تعديل دفعة",
      "تحديث دفعة",
    ]) ||
    containsAny(normalized, ["payment updated", "updated payment"])
  ) {
    return "PAYMENT_UPDATED";
  }

  if (
    containsAny(source, [
      "PAYMENT_CREATED",
      "PAYMENT_ADDED",
      "CREATE_PAYMENT",
      "دفعة جديدة",
      "تسجيل دفعة",
    ]) ||
    containsAny(normalized, [
      "new payment",
      "payment recorded",
      "payment created",
      "payment added",
    ])
  ) {
    return "PAYMENT_CREATED";
  }

  if (
    containsAny(source, [
      "AI_ASSISTANT_ENABLED",
      "ENABLE_AI_ASSISTANT",
      "AI_ENABLED",
      "تفعيل المساعد الذكي",
      "تم تفعيل المساعد الذكي",
    ]) ||
    containsAny(normalized, ["ai assistant enabled", "enabled ai assistant"])
  ) {
    return "AI_ASSISTANT_ENABLED";
  }

  if (
    containsAny(source, [
      "AI_ASSISTANT_DISABLED",
      "DISABLE_AI_ASSISTANT",
      "AI_DISABLED",
      "تعطيل المساعد الذكي",
      "تم تعطيل المساعد الذكي",
    ]) ||
    containsAny(normalized, ["ai assistant disabled", "disabled ai assistant"])
  ) {
    return "AI_ASSISTANT_DISABLED";
  }

  if (
    containsAny(source, ["USER_DISABLED", "DISABLE_USER", "تعطيل مستخدم"]) ||
    containsAny(normalized, ["user disabled", "disabled user"])
  ) {
    return "USER_DISABLED";
  }

  if (
    containsAny(source, ["USER_ENABLED", "ENABLE_USER", "تفعيل مستخدم"]) ||
    containsAny(normalized, ["user enabled", "enabled user"])
  ) {
    return "USER_ENABLED";
  }

  if (
    containsAny(source, ["USER_UPDATED", "UPDATE_USER", "تعديل مستخدم"]) ||
    containsAny(normalized, ["user updated", "updated user"])
  ) {
    return "USER_UPDATED";
  }

  if (
    containsAny(source, [
      "USER_CREATED",
      "CREATE_USER",
      "مستخدم جديد",
      "إنشاء مستخدم",
    ]) ||
    containsAny(normalized, ["new user", "user created", "created user"])
  ) {
    return "USER_CREATED";
  }

  return activity.type;
}
function getActivityText(activity: ActivityItem, locale: Locale) {
  const activityType = normalizeActivityType(activity);
  const translated = ACTIVITY_TEXT[locale][activityType];
  const oppositeLocale = locale === "ar" ? "en" : "ar";
  const oppositeTitle = ACTIVITY_TEXT[oppositeLocale][activityType]?.title;
  const rawMessage = activity.message?.trim();
  const rawTitle = activity.title?.trim();

  return {
    title: translated?.title ?? rawTitle ?? activityType,
    message:
      rawMessage &&
      rawMessage !== rawTitle &&
      rawMessage !== translated?.title &&
      rawMessage !== oppositeTitle
        ? rawMessage
        : undefined,
  };
}

function formatMoney(value: number, locale: Locale) {
  const normalizedValue = Math.abs(Number(value) || 0) < 0.005 ? 0 : Number(value);

  if (locale === "en") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "JOD",
      maximumFractionDigits: 2,
    }).format(normalizedValue);
  }

  return `${new Intl.NumberFormat("ar-JO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(normalizedValue)} د.أ`;
}

function extractItems<T>(payload: unknown): T[] {
  if (!payload || typeof payload !== "object") return [];

  const root = payload as {
    data?: unknown;
    items?: unknown;
    results?: unknown;
  };

  if (Array.isArray(root.data)) return root.data as T[];
  if (Array.isArray(root.items)) return root.items as T[];
  if (Array.isArray(root.results)) return root.results as T[];

  if (root.data && typeof root.data === "object") {
    const nested = root.data as {
      data?: unknown;
      items?: unknown;
      results?: unknown;
    };

    if (Array.isArray(nested.data)) return nested.data as T[];
    if (Array.isArray(nested.items)) return nested.items as T[];
    if (Array.isArray(nested.results)) return nested.results as T[];
  }

  return [];
}

function getDocumentIcon(fileType?: string) {
  if (fileType === "application/pdf") return "📄";
  if (fileType?.startsWith("image/")) return "🖼️";
  return "📁";
}

function formatDate(date: string, locale: Locale) {
  return new Date(date).toLocaleDateString(locale === "ar" ? "ar-JO" : "en-US");
}

function formatAppointmentDateTime(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-JO-u-nu-latn" : "en-US",
    {
    timeZone: TENANT_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    },
  ).format(new Date(date));
}

function formatAppointmentTime(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-JO-u-nu-latn" : "en-US",
    {
    timeZone: TENANT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    },
  ).format(new Date(date));
}

function isPastDate(date?: string | null) {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}

function isTodayDate(date?: string | null) {
  if (!date) return false;

  const value = new Date(date);
  const today = new Date();

  return (
    value.getFullYear() === today.getFullYear() &&
    value.getMonth() === today.getMonth() &&
    value.getDate() === today.getDate()
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  href?: string;
  linkLabel?: string;
  isRtl: boolean;
}

function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel,
  isRtl,
}: SectionHeaderProps) {
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2
          className="text-base font-black sm:text-lg"
          style={{ color: "var(--text)" }}
        >
          {title}
        </h2>
        <p
          className="mt-1 text-xs leading-5 sm:text-sm"
          style={{ color: "var(--text-3)" }}
        >
          {subtitle}
        </p>
      </div>

      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-black transition hover:bg-black/5 dark:hover:bg-white/5"
          style={{ color: "var(--sidebar)" }}
        >
          {linkLabel}
          <ArrowIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  actionLabel?: string;
  href?: string;
}

function EmptyState({ icon, title, actionLabel, href }: EmptyStateProps) {
  return (
    <div
      className="flex min-h-[122px] flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center"
      style={{ borderColor: "var(--border)" }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: "var(--green-soft)", color: "var(--sidebar)" }}
      >
        {icon}
      </div>

      <p className="mt-2.5 text-sm font-bold" style={{ color: "var(--text-2)" }}>
        {title}
      </p>

      {href && actionLabel && (
        <Link
          href={href}
          className="mt-2.5 rounded-xl px-3 py-2 text-xs font-black"
          style={{ background: "var(--green-soft)", color: "var(--sidebar)" }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: ReactNode;
  href: string;
  alert?: boolean;
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  href,
  alert = false,
}: MetricCardProps) {
  return (
    <Link
      href={href}
      className="group card min-w-0 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: alert ? "var(--red-soft)" : "var(--green-soft)",
            color: alert ? "#dc2626" : "var(--sidebar)",
          }}
        >
          {icon}
        </div>

        <ArrowRight
          className="h-4 w-4 opacity-0 transition group-hover:opacity-100 rtl:rotate-180"
          style={{ color: "var(--text-3)" }}
        />
      </div>

      <p className="mt-3 text-xs font-bold" style={{ color: "var(--text-3)" }}>
        {label}
      </p>

      <p
        className="mt-1 truncate text-2xl font-black"
        style={{ color: alert ? "#dc2626" : "var(--text)" }}
      >
        {value}
      </p>

      <p
        className="mt-1.5 line-clamp-2 text-xs leading-5"
        style={{ color: "var(--text-3)" }}
      >
        {sub}
      </p>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const t = TEXT[locale];
  const statusLabels = STATUS_LABELS[locale];
  const priorityLabels = PRIORITY_LABELS[locale];

  const [stats, setStats] = useState<Stats | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [userName, setUserName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          if (!cancelled) {
            router.replace("/login");
            router.refresh();
          }
          return;
        }

        const body = await res.json();

        if (!cancelled) {
          setUserName(body?.data?.name ?? "");
          setOfficeName(body?.data?.tenant?.name ?? "");
        }
      } catch {
        if (!cancelled) {
          router.replace("/login");
          router.refresh();
        }
      }
    }

    verifySession();

    const handlePageShow = () => {
      verifySession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verifySession();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setHasLoadError(false);

        const responses = await Promise.all([
          fetch(
            `/api/dashboard-stats?tz=${encodeURIComponent(TENANT_TIME_ZONE)}`,
            {
              cache: "no-store",
              credentials: "include",
            },
          ),
          fetch("/api/cases?limit=4", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/activity?limit=4", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/documents?limit=5", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const hadFailure = responses.some((response) => !response.ok);

        const json = await Promise.all(
          responses.map(async (response) => {
            if (!response.ok) {
              console.warn(
                "Dashboard API failed:",
                response.url,
                response.status,
              );
              return { data: [] };
            }

            try {
              return await response.json();
            } catch {
              return { data: [] };
            }
          }),
        );

        if (cancelled) return;

        const [statsData, casesData, activitiesData, documentsData] = json;

        setStats(
          statsData?.data && !Array.isArray(statsData.data)
            ? statsData.data
            : null,
        );
        setCases(extractItems<CaseItem>(casesData).slice(0, 4));
        setActivities(extractItems<ActivityItem>(activitiesData).slice(0, 4));
        setDocuments(extractItems<DocumentItem>(documentsData).slice(0, 5));
        setHasLoadError(hadFailure);
      } catch (error) {
        console.error("Dashboard load failed:", error);

        if (!cancelled) {
          setStats(null);
          setCases([]);
          setActivities([]);
          setDocuments([]);
          setHasLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const recentDocuments = useMemo(() => documents.slice(0, 5), [documents]);

  const firstAppointment = useMemo(() => {
    const upcoming = stats?.upcomingAppointments ?? [];

    return [...upcoming].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    )[0];
  }, [stats?.upcomingAppointments]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return t.morning;
    if (hour < 18) return t.afternoon;
    return t.evening;
  }, [t]);

  const greetingName = useMemo(() => {
    const preferred = officeName.trim() || userName.trim();
    if (!preferred) return "";

    return officeName.trim() ? preferred : preferred.split(/\s+/)[0];
  }, [officeName, userName]);

  const summaryText =
    (stats?.todayApptCount ?? 0) === 0 &&
    (stats?.dueTasksCount ?? 0) === 0 &&
    (stats?.overdueInvoicesCount ?? 0) === 0
      ? t.clearDay
      : t.dailySummary(stats?.todayApptCount ?? 0, stats?.dueTasksCount ?? 0);

  const attentionItems = useMemo(() => {
    const items: Array<{
      key: string;
      title: string;
      message: string;
      href: string;
      icon: ReactNode;
      tone: "danger" | "warning" | "info";
    }> = [];

    if ((stats?.overdueTasksCount ?? 0) > 0) {
      items.push({
        key: "overdue-tasks",
        title: t.overdueTasksTitle(stats?.overdueTasksCount ?? 0),
        message: t.overdueTasksMessage,
        href: "/dashboard/tasks",
        icon: <ListTodo className="h-5 w-5" />,
        tone: "danger",
      });
    }

    if ((stats?.dueTodayTasksCount ?? 0) > 0) {
      items.push({
        key: "today-tasks",
        title: t.dueTodayTasksTitle(stats?.dueTodayTasksCount ?? 0),
        message: t.dueTodayTasksMessage,
        href: "/dashboard/tasks",
        icon: <Clock3 className="h-5 w-5" />,
        tone: "warning",
      });
    }

    if ((stats?.overdueInvoicesCount ?? 0) > 0) {
      items.push({
        key: "overdue-invoices",
        title: t.overdueInvoicesTitle(stats?.overdueInvoicesCount ?? 0),
        message: t.overdueInvoicesMessage(
          formatMoney(stats?.overdueAmount ?? 0, locale),
        ),
        href: "/dashboard/invoices",
        icon: <ReceiptText className="h-5 w-5" />,
        tone: "danger",
      });
    }

    if (firstAppointment) {
      items.push({
        key: "next-appointment",
        title: t.upcomingAppointmentTitle,
        message: `${formatAppointmentDateTime(
          firstAppointment.startTime,
          locale,
        )} · ${firstAppointment.title}`,
        href: "/dashboard/appointments",
        icon: <CalendarDays className="h-5 w-5" />,
        tone: "info",
      });
    }

    return items.slice(0, 4);
  }, [
    firstAppointment,
    locale,
    stats?.dueTodayTasksCount,
    stats?.overdueAmount,
    stats?.overdueInvoicesCount,
    stats?.overdueTasksCount,
    t,
  ]);

  if (loading) {
    return <AppLoader fullScreen={false} />;
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="stagger w-full min-w-0 max-w-full space-y-4 overflow-x-hidden text-start sm:space-y-5"
    >
      {hasLoadError && (
        <div
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-200"
          role="status"
        >
          {t.loadingFailed}
        </div>
      )}

      {/* Compact daily header */}
      <section
        className="relative min-w-0 overflow-hidden rounded-[24px] border p-4 sm:p-5"
        style={{
          background:
            "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 58%, var(--sidebar-dark) 100%)",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 20px 55px rgba(15, 61, 62, 0.20)",
        }}
      >
        <div
          className="absolute -end-16 -top-20 h-48 w-48 rounded-full"
          style={{ background: "rgba(184, 115, 51, 0.17)" }}
        />
        <div
          className="absolute -bottom-24 start-1/4 h-52 w-52 rounded-full"
          style={{ background: "rgba(255, 255, 255, 0.06)" }}
        />

        <div className="relative z-10 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black text-white sm:text-xs"
              style={{
                background: "rgba(255,255,255,0.12)",
                borderColor: "rgba(255,255,255,0.18)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t.dashboardBadge}
            </div>

            <h1 className="mt-3 text-xl font-black leading-relaxed text-white sm:text-2xl">
              {greeting}
              {greetingName ? `، ${greetingName}` : ""}
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {summaryText}
            </p>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-xs font-black text-white/70">
              {t.quickActions}
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
              <Link
                href="/dashboard/clients"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <UserPlus className="h-4 w-4" />
                {t.addClient}
              </Link>

              <Link
                href="/dashboard/cases"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition hover:brightness-105"
                style={{
                  background: "var(--gold)",
                  color: "#102d2e",
                }}
              >
                <FilePlus2 className="h-4 w-4" />
                {t.addCase}
              </Link>

              <Link
                href="/dashboard/appointments"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <CalendarPlus className="h-4 w-4" />
                {t.addAppointment}
              </Link>

              <Link
                href="/dashboard/invoices"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black text-white transition hover:bg-white/15"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  borderColor: "rgba(255,255,255,0.18)",
                }}
              >
                <ReceiptText className="h-4 w-4" />
                {t.createInvoice}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Primary metrics */}
      <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t.activeCases}
          value={stats?.activeCaseCount ?? 0}
          sub={t.activeCasesSub}
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          href="/dashboard/cases"
        />

        <MetricCard
          label={t.todayAppointments}
          value={stats?.todayApptCount ?? 0}
          sub={t.todayAppointmentsSub}
          icon={<CalendarDays className="h-5 w-5" />}
          href="/dashboard/appointments"
        />

        <MetricCard
          label={t.dueTasks}
          value={stats?.dueTasksCount ?? 0}
          sub={t.dueTasksSub}
          icon={<ListTodo className="h-5 w-5" />}
          href="/dashboard/tasks"
          alert={(stats?.overdueTasksCount ?? 0) > 0}
        />

        <MetricCard
          label={t.receivables}
          value={formatMoney(stats?.pendingAmount ?? 0, locale)}
          sub={t.receivablesSub}
          icon={<WalletCards className="h-5 w-5" />}
          href="/dashboard/invoices"
          alert={(stats?.overdueInvoicesCount ?? 0) > 0}
        />
      </section>

      {/* Attention */}
      {attentionItems.length === 0 ? (
        <section
          className="card flex min-w-0 items-center gap-3 p-3.5 sm:px-4"
          aria-label={t.needsAttention}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2
                className="text-sm font-black sm:text-base"
                style={{ color: "var(--text)" }}
              >
                {t.noAttention}
              </h2>
              <span
                className="hidden text-xs sm:inline"
                style={{ color: "var(--text-3)" }}
              >
                · {t.noAttentionSub}
              </span>
            </div>

            <p
              className="mt-1 text-xs sm:hidden"
              style={{ color: "var(--text-3)" }}
            >
              {t.noAttentionSub}
            </p>
          </div>
        </section>
      ) : (
        <section className="card h-fit min-w-0 p-4 sm:p-5">
          <SectionHeader
            title={t.needsAttention}
            subtitle={t.needsAttentionSub}
            isRtl={isRtl}
          />

          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {attentionItems.map((item) => {
              const toneStyles = {
                danger: {
                  background: "rgba(220,38,38,0.08)",
                  border: "rgba(220,38,38,0.22)",
                  icon: "text-red-600 dark:text-red-300 bg-red-500/15",
                },
                warning: {
                  background: "rgba(245,158,11,0.08)",
                  border: "rgba(245,158,11,0.22)",
                  icon:
                    "text-amber-700 dark:text-amber-300 bg-amber-500/15",
                },
                info: {
                  background: "var(--green-soft)",
                  border: "var(--border)",
                  icon:
                    "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15",
                },
              }[item.tone];

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group flex min-w-0 items-center gap-3 rounded-2xl border p-3.5 transition hover:-translate-y-0.5"
                  style={{
                    background: toneStyles.background,
                    borderColor: toneStyles.border,
                  }}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneStyles.icon}`}
                  >
                    {item.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-black"
                      style={{ color: "var(--text)" }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="mt-1 line-clamp-2 text-xs leading-5"
                      style={{ color: "var(--text-3)" }}
                    >
                      {item.message}
                    </p>
                  </div>

                  {isRtl ? (
                    <ArrowLeft className="h-4 w-4 shrink-0 opacity-60 transition group-hover:-translate-x-0.5" />
                  ) : (
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition group-hover:translate-x-0.5" />
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Daily operations */}
      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Today's appointments */}
        <div className="card h-fit min-w-0 p-4 sm:p-5">
          <SectionHeader
            title={t.todaySchedule}
            subtitle={t.todayScheduleSub}
            href="/dashboard/appointments"
            linkLabel={t.viewAll}
            isRtl={isRtl}
          />

          {!stats?.todayAppts?.length ? (
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title={t.noAppointmentsToday}
              href="/dashboard/appointments"
              actionLabel={t.addAppointmentAction}
            />
          ) : (
            <div className="space-y-3">
              {stats.todayAppts.slice(0, 5).map((appointment) => (
                <Link
                  key={appointment.id}
                  href="/dashboard/appointments"
                  className="group flex min-w-0 gap-3 rounded-2xl border p-3 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div
                    className="w-1 shrink-0 self-stretch rounded-full"
                    style={{
                      background:
                        TYPE_COLOR[appointment.type] ?? "var(--text-3)",
                      minHeight: 52,
                    }}
                  />

                  <div
                    className="flex h-11 min-w-[68px] shrink-0 items-center justify-center rounded-xl px-2 text-sm font-black"
                    style={{
                      background: "var(--green-soft)",
                      color: "var(--sidebar)",
                    }}
                  >
                    {formatAppointmentTime(appointment.startTime, locale)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-black"
                      style={{ color: "var(--text)" }}
                    >
                      {appointment.title}
                    </p>

                    <p
                      className="mt-1 truncate text-xs"
                      style={{ color: "var(--text-3)" }}
                    >
                      {appointment.client?.name ??
                        appointment.case?.title ??
                        appointment.location ??
                        "—"}
                    </p>
                  </div>

                  {isRtl ? (
                    <ArrowLeft className="mt-1 h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
                  ) : (
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming tasks */}
        <div className="card h-fit min-w-0 p-4 sm:p-5">
          <SectionHeader
            title={t.upcomingTasks}
            subtitle={t.upcomingTasksSub}
            href="/dashboard/tasks"
            linkLabel={t.viewAll}
            isRtl={isRtl}
          />

          {!stats?.upcomingTasks?.length ? (
            <EmptyState
              icon={<ListTodo className="h-5 w-5" />}
              title={t.noUpcomingTasks}
              href="/dashboard/tasks"
              actionLabel={t.addTaskAction}
            />
          ) : (
            <div className="space-y-3">
              {stats.upcomingTasks.slice(0, 5).map((task) => {
                const overdue =
                  isPastDate(task.dueDate) && !isTodayDate(task.dueDate);
                const dueToday = isTodayDate(task.dueDate);

                return (
                  <Link
                    key={task.id}
                    href="/dashboard/tasks"
                    className="group flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: overdue
                          ? "var(--red-soft)"
                          : "var(--green-soft)",
                        color: overdue ? "#dc2626" : "var(--sidebar)",
                      }}
                    >
                      {overdue ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-black"
                        style={{ color: "var(--text)" }}
                      >
                        {task.title}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            PRIORITY_STYLES[task.priority] ??
                            PRIORITY_STYLES.MEDIUM
                          }`}
                        >
                          {priorityLabels[task.priority] ?? task.priority}
                        </span>

                        {task.dueDate && (
                          <span
                            className="text-[11px]"
                            style={{
                              color: overdue ? "#dc2626" : "var(--text-3)",
                            }}
                          >
                            {overdue
                              ? t.overdue
                              : dueToday
                                ? t.dueToday
                                : formatDate(task.dueDate, locale)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isRtl ? (
                      <ArrowLeft className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Lower dashboard: independent columns prevent empty row gaps */}
      <section className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <div className="min-w-0 space-y-4">
          <div className="card min-w-0 p-4 sm:p-5">
            <SectionHeader
              title={t.recentCases}
              subtitle={t.recentCasesSub}
              href="/dashboard/cases"
              linkLabel={t.viewAllCases}
              isRtl={isRtl}
            />

            {cases.length === 0 ? (
              <EmptyState
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                title={t.noCases}
                href="/dashboard/cases"
                actionLabel={t.addCase}
              />
            ) : (
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                {cases.map((caseItem) => (
                  <Link
                    key={caseItem.id}
                    href={`/dashboard/cases/${caseItem.id}`}
                    className="group min-w-0 rounded-2xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--card)",
                    }}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-black"
                          style={{ color: "var(--text)" }}
                        >
                          {caseItem.title}
                        </p>
                        <p
                          className="mt-1 truncate text-xs"
                          style={{ color: "var(--text-3)" }}
                        >
                          {caseItem.client?.name ?? t.noClient}
                        </p>
                      </div>

                      <span
                        className={
                          STATUS_BADGE[caseItem.status] ?? "badge badge-gray"
                        }
                      >
                        {statusLabels[caseItem.status] ?? caseItem.status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--text-3)" }}
                      >
                        #
                        {caseItem.caseNumber?.split("/").pop() ??
                          caseItem.id.slice(-4)}
                      </span>

                      {isRtl ? (
                        <ArrowLeft className="h-4 w-4 opacity-0 transition group-hover:opacity-60" />
                      ) : (
                        <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-60" />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card min-w-0 p-4 sm:p-5">
            <SectionHeader
              title={t.recentDocuments}
              subtitle={t.recentDocumentsSub}
              href="/dashboard/documents"
              linkLabel={t.viewAllDocuments}
              isRtl={isRtl}
            />

            {recentDocuments.length === 0 ? (
              <EmptyState
                icon={<FolderOpen className="h-5 w-5" />}
                title={t.noDocuments}
                href="/dashboard/documents"
                actionLabel={t.viewAllDocuments}
              />
            ) : (
              <div className="space-y-3">
                {recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href="/dashboard/documents"
                    className="group flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: "var(--green-soft)" }}
                    >
                      {getDocumentIcon(doc.fileType)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-bold"
                        style={{ color: "var(--text)" }}
                      >
                        {doc.fileName}
                      </p>

                      <div className="mt-1 flex min-w-0 items-center gap-2">
                        <span
                          className="shrink-0 text-[11px]"
                          style={{ color: "var(--text-3)" }}
                        >
                          {formatDate(doc.createdAt, locale)}
                        </span>

                        {!!doc.tags?.length && (
                          <span
                            className="truncate text-[10px]"
                            style={{ color: "var(--text-3)" }}
                          >
                            {doc.tags.slice(0, 2).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {isRtl ? (
                      <ArrowLeft className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-60" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

        <section className="card min-w-0 p-4 sm:p-5">
          <SectionHeader
            title={t.recentActivities}
            subtitle={t.recentActivitiesSub}
            href="/dashboard/activity"
            linkLabel={t.viewAllActivities}
            isRtl={isRtl}
          />

          {activities.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title={t.noActivities}
            />
          ) : (
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {activities.slice(0, 4).map((activity) => {
                const activityType = normalizeActivityType(activity);
                const config = ACTIVITY_CONFIG[activityType] ?? {
                  icon: "✨",
                  color: "",
                };
                const activityText = getActivityText(activity, locale);

                return (
                  <Link
                    key={activity.id}
                    href="/dashboard/activity"
                    className="group flex min-w-0 items-start gap-3 rounded-2xl border p-3 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base ${config.color}`}
                    >
                      {config.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <p
                          className="line-clamp-2 text-sm font-bold"
                          style={{ color: "var(--text)" }}
                        >
                          {activityText.title}
                        </p>

                        <span
                          className="shrink-0 whitespace-nowrap text-[10px]"
                          style={{ color: "var(--text-3)" }}
                        >
                          {formatDate(activity.createdAt, locale)}
                        </span>
                      </div>

                      {activityText.message && (
                        <p
                          className="mt-1 line-clamp-2 text-xs leading-5"
                          style={{ color: "var(--text-3)" }}
                        >
                          {activityText.message}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        </div>

        <aside className="min-w-0 space-y-4">
<div className="card min-w-0 p-4 sm:p-5">
            <SectionHeader
              title={t.officeSummary}
              subtitle={t.officeSummarySub}
              isRtl={isRtl}
            />

            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-2xl border p-3.5"
                style={{ borderColor: "var(--border)" }}
              >
                <Users className="h-4 w-4" style={{ color: "var(--sidebar)" }} />
                <p
                  className="mt-3 text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {t.clients}
                </p>
                <p
                  className="mt-1 text-xl font-black"
                  style={{ color: "var(--text)" }}
                >
                  {stats?.clientCount ?? 0}
                </p>
                <p
                  className="mt-1 text-[10px]"
                  style={{ color: "var(--text-3)" }}
                >
                  +{stats?.newClientsThisMonth ?? 0} {t.thisMonth}
                </p>
              </div>

              <div
                className="rounded-2xl border p-3.5"
                style={{ borderColor: "var(--border)" }}
              >
                <BriefcaseBusiness
                  className="h-4 w-4"
                  style={{ color: "var(--sidebar)" }}
                />
                <p
                  className="mt-3 text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {t.totalCases}
                </p>
                <p
                  className="mt-1 text-xl font-black"
                  style={{ color: "var(--text)" }}
                >
                  {stats?.totalCasesCount ?? 0}
                </p>
              </div>

              <div
                className="rounded-2xl border p-3.5"
                style={{ borderColor: "var(--border)" }}
              >
                <CheckCircle2
                  className="h-4 w-4"
                  style={{ color: "var(--sidebar)" }}
                />
                <p
                  className="mt-3 text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {t.closedCases}
                </p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p
                    className="text-xl font-black"
                    style={{ color: "var(--text)" }}
                  >
                    {stats?.closedCasesCount ?? 0}
                  </p>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: "var(--text-3)" }}
                  >
                    {stats?.closedCaseRate ?? 0}%
                  </span>
                </div>
              </div>

              <div
                className="rounded-2xl border p-3.5"
                style={{ borderColor: "var(--border)" }}
              >
                <CircleDollarSign
                  className="h-4 w-4"
                  style={{ color: "var(--sidebar)" }}
                />
                <p
                  className="mt-3 text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {t.monthlyRevenue}
                </p>
                <p
                  className="mt-1 truncate text-base font-black"
                  style={{ color: "var(--sidebar)" }}
                >
                  {formatMoney(stats?.monthlyRevenue ?? 0, locale)}
                </p>
              </div>
            </div>

            <div
              className="mt-3 flex items-center justify-between gap-3 rounded-2xl border p-3.5"
              style={{
                borderColor: "var(--border)",
                background: "var(--green-soft)",
              }}
            >
              <div>
                <p
                  className="text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {t.totalRevenue}
                </p>
                <p
                  className="mt-1 text-lg font-black"
                  style={{ color: "var(--sidebar)" }}
                >
                  {formatMoney(stats?.totalRevenue ?? 0, locale)}
                </p>
              </div>

              <CircleDollarSign
                className="h-6 w-6"
                style={{ color: "var(--sidebar)" }}
              />
            </div>
          </div>

        </aside>
      </section>
    </div>
  );
}