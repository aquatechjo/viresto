"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ListTodo,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import { getCurrentUser } from "@/lib/client-session";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import MetricCard from "@/components/dashboard/MetricCard";
import AttentionPanel from "@/components/dashboard/AttentionPanel";
import TodayAppointments from "@/components/dashboard/TodayAppointments";
import UpcomingTasks from "@/components/dashboard/UpcomingTasks";
import OfficeSummary from "@/components/dashboard/OfficeSummary";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import RecentCases from "@/components/dashboard/RecentCases";
import RecentDocuments from "@/components/dashboard/RecentDocuments";
import ActivityFeed, {
  type ActivityViewItem,
} from "@/components/dashboard/ActivityFeed";

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
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
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
  role?: "ADMIN" | "LAWYER" | "STAFF";
  permissions?: {
    canViewFinance: boolean;
  };
  clientCount: number;
  activeCaseCount: number;
  totalCasesCount: number;
  closedCasesCount: number;
  closedCaseRate: number;
  archivedCasesCount: number;
  resolvedCasesCount: number;
  resolvedCaseRate: number;
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
  recentCases: CaseItem[];
  recentActivities: ActivityItem[];
  recentDocuments: DocumentItem[];
}

interface AccountAccess {
  canWrite: boolean;
  message?: string | null;
  billing?: {
    subscriptionStatus: string;
    plan: {
      name: string;
    };
  } | null;
}

interface CaseItem {
  id: string;
  publicId?: number;
  title: string;
  caseNumber?: string | null;
  status: string;
  client?: {
    name: string;
  } | null;
}

interface DocumentItem {
  id: string;
  fileName: string;
  fileType?: string | null;
  createdAt: string;
  tags?: string[];
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: "inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-200",
  IN_PROGRESS:
    "inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/15 px-2.5 py-1 text-[11px] font-black text-blue-700 dark:text-blue-200",
  CLOSED:
    "inline-flex items-center rounded-full border border-slate-500/25 bg-slate-500/15 px-2.5 py-1 text-[11px] font-black text-slate-700 dark:text-slate-200",
  ARCHIVED:
    "inline-flex items-center rounded-full border border-slate-500/25 bg-slate-500/15 px-2.5 py-1 text-[11px] font-black text-slate-700 dark:text-slate-200",
};

const DEFAULT_STATUS_BADGE =
  "inline-flex items-center rounded-full border border-slate-500/25 bg-slate-500/15 px-2.5 py-1 text-[11px] font-black text-slate-700 dark:text-slate-200";

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

const SUBSCRIPTION_STATUS_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    ACTIVE: "نشط",
    TRIALING: "فترة تجريبية",
    PAST_DUE: "متأخر الدفع",
    CANCELLED: "ملغي",
    EXPIRED: "منتهي",
    UNPAID: "غير مدفوع",
    MISSING: "لا يوجد اشتراك",
  },
  en: {
    ACTIVE: "Active",
    TRIALING: "Trial",
    PAST_DUE: "Past due",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    UNPAID: "Unpaid",
    MISSING: "No subscription",
  },
};

const ACCOUNT_ACCESS_MESSAGES: Record<Locale, Record<string, string>> = {
  ar: {
    CANCELLED: "تم إلغاء الاشتراك. يرجى تجديد الاشتراك للمتابعة.",
    EXPIRED: "انتهى الاشتراك. يرجى تجديد الاشتراك للمتابعة.",
    UNPAID: "الاشتراك غير مدفوع. يرجى إتمام الدفع للمتابعة.",
    PAST_DUE: "يوجد تأخير في الدفع. يرجى تجديد الاشتراك للمتابعة.",
    MISSING: "لا يوجد اشتراك مفعّل لهذا المكتب.",
  },
  en: {
    CANCELLED:
      "Your subscription has been cancelled. Please renew it to continue.",
    EXPIRED:
      "Your subscription has expired. Please renew it to continue using the system.",
    UNPAID:
      "Your subscription is unpaid. Please complete the payment to continue.",
    PAST_DUE:
      "Your payment is overdue. Please renew your subscription to continue.",
    MISSING: "No active subscription was found for this office.",
  },
};

const PRIORITY_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    URGENT: "عاجلة",
    HIGH: "عالية",
    MEDIUM: "متوسطة",
    LOW: "منخفضة",
  },
  en: {
    URGENT: "Urgent",
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
  },
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
    uploadDocument: "رفع مستند",
    refresh: "تحديث",
    refreshing: "جارٍ التحديث",
    refreshSuccess: "تم تحديث البيانات",
    refreshError: "تعذر تحديث بعض البيانات",
    priorityCritical: "عاجل",
    priorityToday: "اليوم",
    priorityUpcoming: "قريب",
    resolveNow: "معالجة الآن",
    reviewNow: "مراجعة الآن",
    viewAppointment: "عرض الموعد",
    securityActivity: "أمني",
    updatedNow: "آخر تحديث الآن",
    updatedSeconds: (seconds: number) => `آخر تحديث قبل ${seconds} ثانية`,
    updatedMinutes: (minutes: number) => `آخر تحديث قبل ${minutes} دقيقة`,
    activeOfTotal: (active: number, total: number) =>
      `${active} من أصل ${total} قضية`,
    appointmentsReady: "جدول اليوم جاهز",
    tasksOverdue: (count: number) => `${count} متأخرة`,
    tasksOnTrack: "المهام ضمن المسار",
    invoicesOverdue: (count: number) => `${count} فاتورة متأخرة`,
    receivablesCurrent: "لا توجد فواتير متأخرة",
    clientsThisMonth: (count: number) => `${count} موكل جديد هذا الشهر`,

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
    resolvedCases: "القضايا المحسومة",
    monthlyRevenue: "تحصيل الشهر",
    totalRevenue: "إجمالي التحصيل",

    accountHealthy: "حالة الحساب سليمة",
    accountNeedsAttention: "حالة الحساب تحتاج متابعة",
    manageSubscription: "إدارة الاشتراك",

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
    uploadDocument: "Upload document",
    refresh: "Refresh",
    refreshing: "Refreshing",
    refreshSuccess: "Dashboard updated",
    refreshError: "Some data could not be refreshed",
    priorityCritical: "Critical",
    priorityToday: "Today",
    priorityUpcoming: "Upcoming",
    resolveNow: "Resolve now",
    reviewNow: "Review now",
    viewAppointment: "View appointment",
    securityActivity: "Security",
    updatedNow: "Updated just now",
    updatedSeconds: (seconds: number) => `Updated ${seconds}s ago`,
    updatedMinutes: (minutes: number) => `Updated ${minutes}m ago`,
    activeOfTotal: (active: number, total: number) =>
      `${active} of ${total} cases`,
    appointmentsReady: "Today’s schedule is ready",
    tasksOverdue: (count: number) => `${count} overdue`,
    tasksOnTrack: "Tasks are on track",
    invoicesOverdue: (count: number) => `${count} overdue invoice(s)`,
    receivablesCurrent: "No overdue invoices",
    clientsThisMonth: (count: number) => `${count} new client(s) this month`,

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
    resolvedCases: "Resolved cases",
    monthlyRevenue: "Monthly collections",
    totalRevenue: "Total collections",

    accountHealthy: "Account is in good standing",
    accountNeedsAttention: "Account needs attention",
    manageSubscription: "Manage subscription",

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
  const normalizedValue =
    Math.abs(Number(value) || 0) < 0.0005 ? 0 : Number(value);

  if (locale === "en") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "JOD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(normalizedValue);
  }

  return `${new Intl.NumberFormat("ar-JO", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(normalizedValue)} د.أ`;
}

function getDocumentIcon(fileType?: string | null) {
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

export default function DashboardPage() {
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const t = TEXT[locale];
  const statusLabels = STATUS_LABELS[locale];
  const priorityLabels = PRIORITY_LABELS[locale];

  const [stats, setStats] = useState<Stats | null>(null);
  const [accountAccess, setAccountAccess] = useState<AccountAccess | null>(
    null,
  );
  const [userName, setUserName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      try {
        const result = await getCurrentUser();

        if (!result.ok || !result.user) {
          if (!cancelled) {
            router.replace("/login");
            router.refresh();
          }
          return;
        }

        if (!cancelled) {
          setUserName(result.user.name ?? "");
          setOfficeName(result.user.tenant?.name ?? "");
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

  const loadDashboard = useCallback(async (manualRefresh = false) => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    if (manualRefresh) {
      setIsRefreshing(true);
      setRefreshStatus("idle");
    }

    try {
      setHasLoadError(false);

      const response = await fetch(
        `/api/dashboard-stats?tz=${encodeURIComponent(TENANT_TIME_ZONE)}`,
        {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        },
      );

      const body = await response.json().catch(() => null);
      const nextStats =
        response.ok && body?.data && !Array.isArray(body.data)
          ? (body.data as Stats)
          : null;

      if (!nextStats) {
        throw new Error(`Dashboard API failed with status ${response.status}`);
      }

      if (controller.signal.aborted) return;

      setStats(nextStats);
      setHasLoadError(false);
      setLastUpdatedAt(new Date());
      if (manualRefresh) setRefreshStatus("success");
    } catch (error) {
      if (controller.signal.aborted) return;

      console.error("Dashboard load failed:", error);
      setHasLoadError(true);
      if (manualRefresh) setRefreshStatus("error");
    } finally {
      if (loadAbortRef.current === controller) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard();

    return () => {
      loadAbortRef.current?.abort();
      loadAbortRef.current = null;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (refreshStatus === "idle") return;

    const timeout = window.setTimeout(() => {
      setRefreshStatus("idle");
    }, 2800);

    return () => window.clearTimeout(timeout);
  }, [refreshStatus]);

  useEffect(() => {
    if (stats?.role !== "ADMIN") {
      setAccountAccess(null);
      return;
    }

    let cancelled = false;

    async function loadAccountAccess() {
      try {
        const response = await fetch("/api/billing/access", {
          cache: "no-store",
          credentials: "include",
        });
        const body = await response.json().catch(() => ({}));

        if (!cancelled && response.ok && body?.success) {
          setAccountAccess(body.data as AccountAccess);
        }
      } catch {
        if (!cancelled) setAccountAccess(null);
      }
    }

    loadAccountAccess();

    return () => {
      cancelled = true;
    };
  }, [stats?.role]);

  const recentDocuments = stats?.recentDocuments ?? [];
  const recentActivityItems = useMemo<ActivityViewItem[]>(() => {
    return (stats?.recentActivities ?? []).map((activity) => {
      const activityType = normalizeActivityType(activity);
      const config = ACTIVITY_CONFIG[activityType] ?? { icon: "✨", color: "" };
      const activityText = getActivityText(activity, locale);

      return {
        id: activity.id,
        icon: config.icon,
        color: config.color,
        title: activityText.title,
        message: activityText.message,
        createdAt: activity.createdAt,
        href: "/dashboard/activity",
        isSecurity: [
          "LOGIN_NEW_IP",
          "NEW_IP_LOGIN",
          "NEW_DEVICE_LOGIN",
          "SECURITY_LOGIN",
          "SUSPICIOUS_LOGIN",
        ].includes(activityType),
      };
    });
  }, [locale, stats?.recentActivities]);

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

  const canViewFinance = stats?.permissions?.canViewFinance === true;
  const subscriptionStatus = accountAccess?.billing?.subscriptionStatus ?? "";

  const subscriptionStatusLabel =
    SUBSCRIPTION_STATUS_LABELS[locale][subscriptionStatus] ??
    (subscriptionStatus || "—");

  const accountStatusMessage =
    ACCOUNT_ACCESS_MESSAGES[locale][subscriptionStatus] ??
    (locale === "ar" ? accountAccess?.message : null) ??
    `${accountAccess?.billing?.plan.name ?? "—"} · ${subscriptionStatusLabel}`;

  const attentionItems = useMemo(() => {
    const items: Array<{
      key: string;
      title: string;
      message: string;
      href: string;
      icon: ReactNode;
      tone: "danger" | "warning" | "info";
      priority: "critical" | "today" | "upcoming";
      badgeLabel: string;
      actionLabel: string;
    }> = [];

    if ((stats?.overdueTasksCount ?? 0) > 0) {
      items.push({
        key: "overdue-tasks",
        title: t.overdueTasksTitle(stats?.overdueTasksCount ?? 0),
        message: t.overdueTasksMessage,
        href: "/dashboard/tasks",
        icon: <ListTodo className="h-5 w-5" />,
        tone: "danger",
        priority: "critical",
        badgeLabel: t.priorityCritical,
        actionLabel: t.resolveNow,
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
        priority: "today",
        badgeLabel: t.priorityToday,
        actionLabel: t.reviewNow,
      });
    }

    if (canViewFinance && (stats?.overdueInvoicesCount ?? 0) > 0) {
      items.push({
        key: "overdue-invoices",
        title: t.overdueInvoicesTitle(stats?.overdueInvoicesCount ?? 0),
        message: t.overdueInvoicesMessage(
          formatMoney(stats?.overdueAmount ?? 0, locale),
        ),
        href: "/dashboard/invoices",
        icon: <ReceiptText className="h-5 w-5" />,
        tone: "danger",
        priority: "critical",
        badgeLabel: t.priorityCritical,
        actionLabel: t.resolveNow,
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
        priority: "upcoming",
        badgeLabel: t.priorityUpcoming,
        actionLabel: t.viewAppointment,
      });
    }

    const priorityRank = { critical: 0, today: 1, upcoming: 2 } as const;

    return items
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
      .slice(0, 4);
  }, [
    firstAppointment,
    locale,
    stats?.dueTodayTasksCount,
    stats?.overdueAmount,
    stats?.overdueInvoicesCount,
    stats?.overdueTasksCount,
    canViewFinance,
    t,
  ]);

  if (loading) {
    return <DashboardSkeleton isRtl={isRtl} />;
  }

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="animate-fade w-full min-w-0 max-w-full space-y-4 overflow-x-hidden text-start sm:space-y-5"
    >
      {hasLoadError && (
        <div
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-200"
          role="status"
        >
          {t.loadingFailed}
        </div>
      )}

      {stats?.role === "ADMIN" && accountAccess && (
        <Link
          href="/dashboard/billing"
          className={`flex min-w-0 items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition hover:brightness-105 ${
            accountAccess.canWrite
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-amber-500/35 bg-amber-500/10"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {accountAccess.canWrite ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0">
              <p
                className="text-sm font-black"
                style={{ color: "var(--text)" }}
              >
                {accountAccess.canWrite
                  ? t.accountHealthy
                  : t.accountNeedsAttention}
              </p>
              <p
                className="mt-0.5 truncate text-xs font-semibold"
                style={{ color: "var(--text-3)" }}
              >
                {accountStatusMessage}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-black text-teal-700 dark:text-teal-200">
            {t.manageSubscription}
          </span>
        </Link>
      )}

      <DashboardHeader
        greeting={greeting}
        greetingName={greetingName}
        summaryText={summaryText}
        canViewFinance={canViewFinance}
        lastUpdatedAt={lastUpdatedAt}
        updatedNowLabel={t.updatedNow}
        formatUpdatedSeconds={t.updatedSeconds}
        formatUpdatedMinutes={t.updatedMinutes}
        refreshLabel={t.refresh}
        refreshingLabel={t.refreshing}
        refreshSuccessLabel={t.refreshSuccess}
        refreshErrorLabel={t.refreshError}
        refreshStatus={refreshStatus}
        isRefreshing={isRefreshing}
        onRefresh={() => void loadDashboard(true)}
        labels={{
          badge: t.dashboardBadge,
          quickActions: t.quickActions,
          addClient: t.addClient,
          addCase: t.addCase,
          addAppointment: t.addAppointment,
          createInvoice: t.createInvoice,
          uploadDocument: t.uploadDocument,
        }}
      />

      {/* Primary metrics */}
      <div className="stagger grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t.activeCases}
          value={stats?.activeCaseCount ?? 0}
          sub={t.activeCasesSub}
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          href="/dashboard/cases"
          insight={t.activeOfTotal(
            stats?.activeCaseCount ?? 0,
            stats?.totalCasesCount ?? 0,
          )}
          trend="neutral"
        />

        <MetricCard
          label={t.todayAppointments}
          value={stats?.todayApptCount ?? 0}
          sub={t.todayAppointmentsSub}
          icon={<CalendarDays className="h-5 w-5" />}
          href="/dashboard/appointments"
          insight={t.appointmentsReady}
          trend={(stats?.todayApptCount ?? 0) > 0 ? "up" : "neutral"}
        />

        <MetricCard
          label={t.dueTasks}
          value={stats?.dueTasksCount ?? 0}
          sub={t.dueTasksSub}
          icon={<ListTodo className="h-5 w-5" />}
          href="/dashboard/tasks"
          alert={(stats?.overdueTasksCount ?? 0) > 0}
          insight={
            (stats?.overdueTasksCount ?? 0) > 0
              ? t.tasksOverdue(stats?.overdueTasksCount ?? 0)
              : t.tasksOnTrack
          }
          trend={(stats?.overdueTasksCount ?? 0) > 0 ? "down" : "up"}
        />

        {canViewFinance ? (
          <MetricCard
            label={t.receivables}
            value={formatMoney(stats?.pendingAmount ?? 0, locale)}
            sub={t.receivablesSub}
            icon={<WalletCards className="h-5 w-5" />}
            href="/dashboard/invoices"
            alert={(stats?.overdueInvoicesCount ?? 0) > 0}
            insight={
              (stats?.overdueInvoicesCount ?? 0) > 0
                ? t.invoicesOverdue(stats?.overdueInvoicesCount ?? 0)
                : t.receivablesCurrent
            }
            trend={(stats?.overdueInvoicesCount ?? 0) > 0 ? "down" : "up"}
          />
        ) : (
          <MetricCard
            label={t.clients}
            value={stats?.clientCount ?? 0}
            sub={t.officeSummarySub}
            icon={<Users className="h-5 w-5" />}
            href="/dashboard/clients"
            insight={t.clientsThisMonth(stats?.newClientsThisMonth ?? 0)}
            trend={(stats?.newClientsThisMonth ?? 0) > 0 ? "up" : "neutral"}
          />
        )}
      </div>

      <AttentionPanel
        items={attentionItems}
        isRtl={isRtl}
        title={t.needsAttention}
        subtitle={t.needsAttentionSub}
        emptyTitle={t.noAttention}
        emptySubtitle={t.noAttentionSub}
      />

      {/* Daily operations */}
      <div className="animate-slide">
        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <TodayAppointments
            appointments={stats?.todayAppts ?? []}
            locale={locale}
            isRtl={isRtl}
            title={t.todaySchedule}
            subtitle={t.todayScheduleSub}
            viewAllLabel={t.viewAll}
            emptyTitle={t.noAppointmentsToday}
            actionLabel={t.addAppointmentAction}
          />
          <UpcomingTasks
            tasks={stats?.upcomingTasks ?? []}
            locale={locale}
            isRtl={isRtl}
            priorityLabels={priorityLabels}
            title={t.upcomingTasks}
            subtitle={t.upcomingTasksSub}
            viewAllLabel={t.viewAll}
            emptyTitle={t.noUpcomingTasks}
            actionLabel={t.addTaskAction}
            overdueLabel={t.overdue}
            todayLabel={t.dueToday}
          />
        </section>
      </div>

      {/* Lower dashboard: independent columns prevent empty row gaps */}
      <div className="animate-slide">
        <section className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
          <div className="min-w-0 space-y-4">
            <RecentCases
              cases={stats?.recentCases ?? []}
              isRtl={isRtl}
              statusLabels={statusLabels}
              statusBadgeClasses={STATUS_BADGE}
              defaultStatusBadgeClass={DEFAULT_STATUS_BADGE}
              labels={{
                title: t.recentCases,
                subtitle: t.recentCasesSub,
                viewAll: t.viewAllCases,
                empty: t.noCases,
                addCase: t.addCase,
                noClient: t.noClient,
              }}
            />

            <RecentDocuments
              documents={recentDocuments}
              isRtl={isRtl}
              formatDate={(value) => formatDate(value, locale)}
              getDocumentIcon={getDocumentIcon}
              labels={{
                title: t.recentDocuments,
                subtitle: t.recentDocumentsSub,
                viewAll: t.viewAllDocuments,
                empty: t.noDocuments,
              }}
            />

            <ActivityFeed
              activities={recentActivityItems}
              isRtl={isRtl}
              locale={locale}
              labels={{
                title: t.recentActivities,
                subtitle: t.recentActivitiesSub,
                viewAll: t.viewAllActivities,
                empty: t.noActivities,
                security: t.securityActivity,
              }}
            />
          </div>

          <aside className="min-w-0 space-y-4">
            <OfficeSummary
              isRtl={isRtl}
              canViewFinance={canViewFinance}
              clientCount={stats?.clientCount ?? 0}
              newClientsThisMonth={stats?.newClientsThisMonth ?? 0}
              totalCasesCount={stats?.totalCasesCount ?? 0}
              resolvedCasesCount={stats?.resolvedCasesCount ?? 0}
              resolvedCaseRate={stats?.resolvedCaseRate ?? 0}
              monthlyRevenue={formatMoney(stats?.monthlyRevenue ?? 0, locale)}
              totalRevenue={formatMoney(stats?.totalRevenue ?? 0, locale)}
              labels={{
                title: t.officeSummary,
                subtitle: t.officeSummarySub,
                clients: t.clients,
                thisMonth: t.thisMonth,
                totalCases: t.totalCases,
                resolvedCases: t.resolvedCases,
                monthlyRevenue: t.monthlyRevenue,
                totalRevenue: t.totalRevenue,
              }}
            />
          </aside>
        </section>
      </div>
    </main>
  );
}
