"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity as ActivityIcon,
  CalendarClock,
  FileText,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  VDSBadge,
  VDSDataTable,
  type VDSDataTableColumn,
  type VDSTone,
} from "@/components/ui/vds";
import { FilterBar, FilterSelect, PageHeader, PageHeaderAction, PageStats } from "@/components/page";
import { useLocale } from "@/lib/useLocale";
import AppLoader from "@/components/ui/AppLoader";
import { formatInZone } from "@/lib/datetime";
type Locale = "ar" | "en";

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

const COPY = {
  ar: {
    hero: {
      title: "سجل النشاط",
      subtitle:
        "متابعة العمليات التي تمت داخل المكتب حسب المستخدم والنوع والوقت.",
      refresh: "تحديث",
    },
    stats: {
      total: "كل الأنشطة",
      today: "اليوم",
      security: "أمان وجلسات",
      finance: "حركات مالية",
    },
    filters: {
      typeAria: "فلترة نوع النشاط",
      periodAria: "فلترة الفترة",
      periodAll: "كل الأوقات",
      periodToday: "اليوم",
      period7d: "آخر 7 أيام",
      period30d: "آخر 30 يومًا",
      period90d: "آخر 90 يومًا",
      memberAria: "فلترة المستخدم",
      memberAll: "كل المستخدمين",
      inactive: "معطّل",
      clear: "مسح الفلاتر",
      all: "كل الأنشطة",
      clients: "الموكلون",
      cases: "القضايا",
      appointments: "المواعيد",
      tasks: "المهام",
      documents: "المستندات",
      payments: "الدفعات",
      invoices: "الفواتير",
      security: "الأمان",
    },
    table: {
      activity: "النشاط",
      user: "المستخدم",
      entity: "الكيان",
      time: "الوقت",
      ip: "IP",
      action: "الإجراء",
      system: "النظام",
      local: "محلي",
      unavailable: "غير متاح",
      view: "عرض",
      loadMore: "عرض المزيد",
      loadingMore: "جاري تحميل المزيد...",
      previous: "السابق",
      next: "التالي",
      showing: "إظهار",
      to: "إلى",
      of: "من أصل",
      activityRecord: "نشاط",
      noRecords: "لا توجد نشاطات",
    },
    empty: {
      title: "لا توجد أنشطة",
      sub: "ستظهر العمليات هنا بعد تنفيذ أي إجراء داخل المكتب",
    },
    messages: {
      loadError: "تعذر تحميل سجل النشاط",
      loadException: "حدث خطأ أثناء تحميل سجل النشاط",
      refreshed: "تم تحديث سجل النشاط",
    },
    entities: {
      CASE: "قضية",
      CLIENT: "موكل",
      DOCUMENT: "مستند",
      PAYMENT: "دفعة",
      INVOICE: "فاتورة",
      TASK: "مهمة",
      APPOINTMENT: "موعد",
      USER: "مستخدم",
      SESSION: "جلسة",
      TENANT: "مكتب",
      AUTH: "المصادقة",
    },
    activities: {
      CLIENT_CREATED: "إضافة موكل",
      CLIENT_UPDATED: "تعديل موكل",
      CLIENT_DELETED: "حذف موكل",
      CASE_CREATED: "إضافة قضية",
      CASE_UPDATED: "تعديل قضية",
      CASE_STATUS_CHANGED: "تغيير حالة قضية",
      CASE_DELETED: "حذف قضية",
      APPOINTMENT_CREATED: "إضافة موعد",
      APPOINTMENT_UPDATED: "تعديل موعد",
      APPOINTMENT_RESCHEDULED: "تغيير وقت موعد",
      APPOINTMENT_DELETED: "حذف موعد",
      TASK_CREATED: "إضافة مهمة",
      TASK_COMPLETED: "إنجاز مهمة",
      TASK_REOPENED: "إعادة فتح مهمة",
      TASK_DELETED: "حذف مهمة",
      DOCUMENT_UPLOADED: "رفع مستند",
      DOCUMENT_VIEWED: "فتح مستند",
      DOCUMENT_OPENED: "فتح مستند",
      DOCUMENT_PREVIEWED: "معاينة مستند",
      DOCUMENT_DELETED: "حذف مستند",
      PAYMENT_ADDED: "إضافة دفعة",
      PAYMENT_CREATED: "إضافة دفعة",
      PAYMENT_UPDATED: "تعديل دفعة",
      PAYMENT_DELETED: "حذف دفعة",
      INVOICE_CREATED: "إنشاء فاتورة",
      INVOICE_UPDATED: "تعديل فاتورة",
      INVOICE_DELETED: "حذف فاتورة",
      INVOICE_ISSUED: "إصدار فاتورة",
      INVOICE_CANCELLED: "إلغاء فاتورة",
      USER_LOGIN: "تسجيل دخول",
      USER_LOGOUT: "تسجيل خروج",
      LOGIN_SUCCESS: "تم تسجيل الدخول بنجاح",
      SUSPICIOUS_LOGIN: "تسجيل دخول من جهاز أو IP جديد",
      LOGIN_FAILED: "فشل تسجيل الدخول",
      PASSWORD_CHANGED: "تغيير كلمة المرور",
      PASSWORD_RESET: "إعادة تعيين كلمة المرور",
      PASSWORD_RESET_REQUEST: "طلب إعادة تعيين كلمة المرور",
      "2FA_ENABLED": "تفعيل التحقق الثنائي",
      "2FA_DISABLED": "تعطيل التحقق الثنائي",
      TWO_FACTOR_ENABLED: "تفعيل التحقق الثنائي",
      TWO_FACTOR_DISABLED: "تعطيل التحقق الثنائي",
      USER_CREATED: "إضافة مستخدم",
      USER_UPDATED: "تعديل مستخدم",
      USER_DISABLED: "تعطيل مستخدم",
      USER_ENABLED: "تفعيل مستخدم",
      USER_DEACTIVATED: "تعطيل مستخدم",
      USER_ACTIVATED: "تفعيل مستخدم",
      SESSION_REVOKED: "إلغاء جلسة",
      SESSIONS_REVOKED: "إلغاء الجلسات",
      DATA_EXPORTED: "تصدير بيانات المكتب",
      DOCUMENT_FILE_EXPORTED: "تنزيل ملف مستند (تصدير)",
      OFFICE_DELETION_REQUESTED: "طلب حذف المكتب",
      TENANT_SUSPENDED: "تعليق المكتب",
      TENANT_ACTIVATED: "تفعيل المكتب",
      BILLING_STATUS_CHANGED: "تغيير حالة الاشتراك",
      PLAN_CHANGED: "تغيير الخطة",
      CLIENT_ARCHIVED: "تم أرشفة موكل",
      CLIENT_RESTORED: "تم استعادة موكل",
    },
  },
  en: {
    hero: {
      title: "Activity log",
      subtitle:
        "Track actions performed in the office by user, type, and time.",
      refresh: "Refresh",
    },
    stats: {
      total: "All activities",
      today: "Today",
      security: "Security and sessions",
      finance: "Financial actions",
    },
    filters: {
      typeAria: "Filter activity type",
      periodAria: "Filter period",
      periodAll: "All time",
      periodToday: "Today",
      period7d: "Last 7 days",
      period30d: "Last 30 days",
      period90d: "Last 90 days",
      memberAria: "Filter user",
      memberAll: "All users",
      inactive: "Inactive",
      clear: "Clear filters",
      all: "All activities",
      clients: "Clients",
      cases: "Cases",
      appointments: "Appointments",
      tasks: "Tasks",
      documents: "Documents",
      payments: "Payments",
      invoices: "Invoices",
      security: "Security",
    },
    table: {
      activity: "Activity",
      user: "User",
      entity: "Entity",
      time: "Time",
      ip: "IP",
      action: "Action",
      system: "System",
      local: "Local",
      unavailable: "Unavailable",
      view: "View",
      loadMore: "Load more",
      loadingMore: "Loading more...",
      previous: "Previous",
      next: "Next",
      showing: "Showing",
      to: "to",
      of: "of",
      activityRecord: "activities",
      noRecords: "No activities",
    },
    empty: {
      title: "No activities",
      sub: "Actions will appear here after activity is performed in the office.",
    },
    messages: {
      loadError: "Unable to load the activity log",
      loadException: "An error occurred while loading the activity log",
      refreshed: "Activity log refreshed",
    },
    entities: {
      CASE: "Case",
      CLIENT: "Client",
      DOCUMENT: "Document",
      PAYMENT: "Payment",
      INVOICE: "Invoice",
      TASK: "Task",
      APPOINTMENT: "Appointment",
      USER: "User",
      SESSION: "Session",
      TENANT: "Office",
      AUTH: "Authentication",
    },
    activities: {
      CLIENT_CREATED: "Client created",
      CLIENT_UPDATED: "Client updated",
      CLIENT_DELETED: "Client deleted",
      CASE_CREATED: "Case created",
      CASE_UPDATED: "Case updated",
      CASE_STATUS_CHANGED: "Case status changed",
      CASE_DELETED: "Case deleted",
      APPOINTMENT_CREATED: "Appointment created",
      APPOINTMENT_UPDATED: "Appointment updated",
      APPOINTMENT_RESCHEDULED: "Appointment time changed",
      APPOINTMENT_DELETED: "Appointment deleted",
      TASK_CREATED: "Task created",
      TASK_COMPLETED: "Task completed",
      TASK_REOPENED: "Task reopened",
      TASK_DELETED: "Task deleted",
      DOCUMENT_UPLOADED: "Document uploaded",
      DOCUMENT_VIEWED: "Document opened",
      DOCUMENT_OPENED: "Document opened",
      DOCUMENT_PREVIEWED: "Document previewed",
      DOCUMENT_DELETED: "Document deleted",
      PAYMENT_ADDED: "Payment added",
      PAYMENT_CREATED: "Payment added",
      PAYMENT_UPDATED: "Payment updated",
      PAYMENT_DELETED: "Payment deleted",
      INVOICE_CREATED: "Invoice created",
      INVOICE_UPDATED: "Invoice updated",
      INVOICE_DELETED: "Invoice deleted",
      INVOICE_ISSUED: "Invoice issued",
      INVOICE_CANCELLED: "Invoice cancelled",
      USER_LOGIN: "User signed in",
      USER_LOGOUT: "User signed out",
      LOGIN_SUCCESS: "Login successful",
      SUSPICIOUS_LOGIN: "Login from a new device or IP",
      LOGIN_FAILED: "Login failed",
      PASSWORD_CHANGED: "Password changed",
      PASSWORD_RESET: "Password reset",
      PASSWORD_RESET_REQUEST: "Password reset requested",
      "2FA_ENABLED": "Two-factor authentication enabled",
      "2FA_DISABLED": "Two-factor authentication disabled",
      TWO_FACTOR_ENABLED: "Two-factor authentication enabled",
      TWO_FACTOR_DISABLED: "Two-factor authentication disabled",
      USER_CREATED: "User created",
      USER_UPDATED: "User updated",
      USER_DISABLED: "User disabled",
      USER_ENABLED: "User enabled",
      USER_DEACTIVATED: "User deactivated",
      USER_ACTIVATED: "User activated",
      SESSION_REVOKED: "Session revoked",
      SESSIONS_REVOKED: "Sessions revoked",
      DATA_EXPORTED: "Office data exported",
      DOCUMENT_FILE_EXPORTED: "Document file downloaded (export)",
      OFFICE_DELETION_REQUESTED: "Office deletion requested",
      TENANT_SUSPENDED: "Office suspended",
      TENANT_ACTIVATED: "Office activated",
      BILLING_STATUS_CHANGED: "Billing status changed",
      PLAN_CHANGED: "Plan changed",
      CLIENT_ARCHIVED: "Client archived",
      CLIENT_RESTORED: "Client restored",
    },
  },
} as const;

const RAW_ACTIVITY_ALIASES: Record<string, keyof typeof COPY.ar.activities> = {
  "تم أرشفة موكل": "CLIENT_ARCHIVED",
  CLIENT_ARCHIVED: "CLIENT_ARCHIVED",
  "CLIENT ARCHIVED": "CLIENT_ARCHIVED",
  "Client archived": "CLIENT_ARCHIVED",

  "تم استعادة موكل": "CLIENT_RESTORED",
  CLIENT_RESTORED: "CLIENT_RESTORED",
  "CLIENT RESTORED": "CLIENT_RESTORED",
  "Client restored": "CLIENT_RESTORED",
  "إضافة موكل": "CLIENT_CREATED",
  "انشاء موكل": "CLIENT_CREATED",
  "إنشاء موكل": "CLIENT_CREATED",
  "تعديل موكل": "CLIENT_UPDATED",
  "حذف موكل": "CLIENT_DELETED",

  "إضافة قضية": "CASE_CREATED",
  "انشاء قضية": "CASE_CREATED",
  "إنشاء قضية": "CASE_CREATED",
  "تعديل قضية": "CASE_UPDATED",
  "تغيير حالة قضية": "CASE_STATUS_CHANGED",
  "حذف قضية": "CASE_DELETED",

  "إضافة موعد": "APPOINTMENT_CREATED",
  "انشاء موعد": "APPOINTMENT_CREATED",
  "إنشاء موعد": "APPOINTMENT_CREATED",
  "تعديل موعد": "APPOINTMENT_UPDATED",
  "تغيير وقت موعد": "APPOINTMENT_RESCHEDULED",
  "حذف موعد": "APPOINTMENT_DELETED",

  "إضافة مهمة": "TASK_CREATED",
  "انشاء مهمة": "TASK_CREATED",
  "إنشاء مهمة": "TASK_CREATED",
  "إنجاز مهمة": "TASK_COMPLETED",
  "إعادة فتح مهمة": "TASK_REOPENED",
  "حذف مهمة": "TASK_DELETED",

  "تم رفع مستند": "DOCUMENT_UPLOADED",
  "رفع مستند": "DOCUMENT_UPLOADED",
  "New document uploaded": "DOCUMENT_UPLOADED",
  "Document uploaded": "DOCUMENT_UPLOADED",
  "تم فتح مستند": "DOCUMENT_OPENED",
  "فتح مستند": "DOCUMENT_OPENED",
  "Document opened": "DOCUMENT_OPENED",
  "تم عرض مستند": "DOCUMENT_VIEWED",
  "عرض مستند": "DOCUMENT_VIEWED",
  "Document viewed": "DOCUMENT_VIEWED",
  "تمت معاينة مستند": "DOCUMENT_PREVIEWED",
  "معاينة مستند": "DOCUMENT_PREVIEWED",
  "Document previewed": "DOCUMENT_PREVIEWED",
  "تم حذف مستند": "DOCUMENT_DELETED",
  "حذف مستند": "DOCUMENT_DELETED",
  "Document deleted": "DOCUMENT_DELETED",

  "إضافة دفعة": "PAYMENT_ADDED",
  "انشاء دفعة": "PAYMENT_CREATED",
  "إنشاء دفعة": "PAYMENT_CREATED",
  "تعديل دفعة": "PAYMENT_UPDATED",
  "حذف دفعة": "PAYMENT_DELETED",

  "إنشاء فاتورة": "INVOICE_CREATED",
  "انشاء فاتورة": "INVOICE_CREATED",
  "تعديل فاتورة": "INVOICE_UPDATED",
  "حذف فاتورة": "INVOICE_DELETED",
  "إصدار فاتورة": "INVOICE_ISSUED",
  "إلغاء فاتورة": "INVOICE_CANCELLED",

  "تسجيل دخول": "USER_LOGIN",
  "User signed in": "USER_LOGIN",
  "تسجيل خروج": "USER_LOGOUT",
  "User signed out": "USER_LOGOUT",

  "تم تسجيل الدخول بنجاح": "LOGIN_SUCCESS",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  "LOGIN SUCCESS": "LOGIN_SUCCESS",
  "Login successful": "LOGIN_SUCCESS",

  "جديد IP تسجيل دخول من جهاز أو": "SUSPICIOUS_LOGIN",
  "تسجيل دخول من جهاز أو IP جديد": "SUSPICIOUS_LOGIN",
  SUSPICIOUS_LOGIN: "SUSPICIOUS_LOGIN",
  "SUSPICIOUS LOGIN": "SUSPICIOUS_LOGIN",
  "Login from a new device or IP": "SUSPICIOUS_LOGIN",

  "فشل تسجيل الدخول": "LOGIN_FAILED",
  LOGIN_FAILED: "LOGIN_FAILED",
  "LOGIN FAILED": "LOGIN_FAILED",
  "Login failed": "LOGIN_FAILED",

  "تغيير كلمة المرور": "PASSWORD_CHANGED",
  "Password changed": "PASSWORD_CHANGED",
  "إعادة تعيين كلمة المرور": "PASSWORD_RESET",
  "Password reset": "PASSWORD_RESET",
  "طلب إعادة تعيين كلمة المرور": "PASSWORD_RESET_REQUEST",
  "Password reset requested": "PASSWORD_RESET_REQUEST",

  "تفعيل التحقق الثنائي": "TWO_FACTOR_ENABLED",
  "تعطيل التحقق الثنائي": "TWO_FACTOR_DISABLED",
  "Two-factor authentication enabled": "TWO_FACTOR_ENABLED",
  "Two-factor authentication disabled": "TWO_FACTOR_DISABLED",

  "إلغاء جلسة": "SESSION_REVOKED",
  "إلغاء الجلسات": "SESSIONS_REVOKED",
  "Session revoked": "SESSION_REVOKED",
  "Sessions revoked": "SESSIONS_REVOKED",

  "تصدير بيانات المكتب": "DATA_EXPORTED",
  "Office data exported": "DATA_EXPORTED",
  "تنزيل ملف مستند (تصدير)": "DOCUMENT_FILE_EXPORTED",
  "Document file downloaded (export)": "DOCUMENT_FILE_EXPORTED",
  "طلب حذف المكتب": "OFFICE_DELETION_REQUESTED",
  "Office deletion requested": "OFFICE_DELETION_REQUESTED",
};

const TYPE_OPTIONS = [
  ["all", "all"],
  ["clients", "clients"],
  ["cases", "cases"],
  ["appointments", "appointments"],
  ["tasks", "tasks"],
  ["documents", "documents"],
  ["payments", "payments"],
  ["invoices", "invoices"],
  ["security", "security"],
] as const;

const PERIOD_OPTIONS = [
  ["all", "periodAll"],
  ["today", "periodToday"],
  ["7d", "period7d"],
  ["30d", "period30d"],
  ["90d", "period90d"],
] as const;

interface ActivityMember {
  id: string;
  name: string;
  isActive: boolean;
}

function resolveActivityKey(
  value?: string | null,
): keyof typeof COPY.ar.activities | null {
  if (!value) return null;

  const trimmed = value.trim();
  const direct = trimmed as keyof typeof COPY.ar.activities;
  if (direct in COPY.ar.activities) return direct;

  const normalizedKey = trimmed
    .replace(/[\s-]+/g, "_")
    .toUpperCase() as keyof typeof COPY.ar.activities;

  if (normalizedKey in COPY.ar.activities) return normalizedKey;

  if (trimmed in RAW_ACTIVITY_ALIASES) return RAW_ACTIVITY_ALIASES[trimmed];

  const compact = trimmed
    .replace(/^تم\s+/u, "")
    .replace(/^New\s+/iu, "")
    .replace(/\s+/g, " ")
    .trim();

  const compactDirect = compact as keyof typeof COPY.ar.activities;
  if (compactDirect in COPY.ar.activities) return compactDirect;

  const compactNormalized = compact
    .replace(/[\s-]+/g, "_")
    .toUpperCase() as keyof typeof COPY.ar.activities;

  if (compactNormalized in COPY.ar.activities) return compactNormalized;

  if (compact in RAW_ACTIVITY_ALIASES) return RAW_ACTIVITY_ALIASES[compact];

  return null;
}

function activityLabel(value: string | null | undefined, locale: Locale) {
  const key = resolveActivityKey(value);
  if (key) return COPY[locale].activities[key];
  return value ? value.replaceAll("_", " ") : "-";
}

function displayActivityTitle(activity: ActivityItem, locale: Locale) {
  const fromType = resolveActivityKey(activity.type);
  if (fromType) return COPY[locale].activities[fromType];

  const fromTitle = resolveActivityKey(activity.title);
  if (fromTitle) return COPY[locale].activities[fromTitle];

  return activity.title || activityLabel(activity.type, locale);
}

function displayActivityMessage(activity: ActivityItem, locale: Locale) {
  if (!activity.message) return activityLabel(activity.type, locale);

  const key = resolveActivityKey(activity.message);
  if (key) return COPY[locale].activities[key];

  return activity.message;
}

function entityLabel(entityType: string | null | undefined, locale: Locale) {
  if (!entityType) return "-";
  const key = entityType.toUpperCase() as keyof typeof COPY.ar.entities;
  return COPY[locale].entities[key] ?? entityType;
}

function entityHref(activity: ActivityItem) {
  if (!activity.entityId || !activity.entityType) return null;

  if (activity.entityType === "CASE")
    return `/dashboard/cases/${activity.entityId}`;
  if (activity.entityType === "CLIENT")
    return `/dashboard/clients/${activity.entityId}`;
  if (activity.entityType === "INVOICE")
    return `/dashboard/invoices/${activity.entityId}`;

  return null;
}

function categoryOf(type: string, title?: string | null) {
  const normalized = `${type} ${title ?? ""}`.toUpperCase();

  if (
    normalized.includes("LOGIN") ||
    normalized.includes("LOGOUT") ||
    normalized.includes("SESSION") ||
    normalized.includes("PASSWORD") ||
    normalized.includes("2FA") ||
    normalized.includes("TWO_FACTOR") ||
    normalized.includes("AUTH") ||
    normalized.includes("تسجيل دخول") ||
    normalized.includes("تسجيل خروج") ||
    normalized.includes("كلمة المرور") ||
    normalized.includes("التحقق الثنائي")
  ) {
    return "security";
  }

  if (normalized.includes("PAYMENT") || normalized.includes("دفعة"))
    return "payments";

  if (normalized.includes("INVOICE") || normalized.includes("فاتورة"))
    return "invoices";

  if (normalized.includes("CLIENT") || normalized.includes("موكل"))
    return "clients";

  if (normalized.includes("CASE") || normalized.includes("قضية"))
    return "cases";

  if (normalized.includes("APPOINTMENT") || normalized.includes("موعد"))
    return "appointments";

  if (normalized.includes("TASK") || normalized.includes("مهمة"))
    return "tasks";

  if (normalized.includes("DOCUMENT") || normalized.includes("مستند"))
    return "documents";

  return "other";
}

function categoryTone(type: string, title?: string | null): VDSTone {
  const category = categoryOf(type, title);

  if (category === "security") return "purple";
  if (category === "payments" || category === "invoices") return "gold";
  if (category === "clients") return "blue";
  if (category === "cases") return "teal";
  if (category === "appointments") return "purple";
  if (category === "documents") return "blue";

  return "slate";
}

interface ActivityPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

interface ActivityStats {
  total: number;
  today: number;
  security: number;
  finance: number;
}

const EMPTY_PAGINATION: ActivityPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
  from: 0,
  to: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

function safeActivityPayload(data: any): {
  items: ActivityItem[];
  pagination: ActivityPagination;
} {
  const payload = data?.data ?? data;

  const candidates = [
    payload?.items,
    payload?.activities,
    data?.items,
    data?.activities,
    data,
  ];

  const items = candidates.find(Array.isArray) ?? [];
  const rawPagination = payload?.pagination ?? data?.pagination ?? {};

  const page = Number(rawPagination.page ?? 1);
  const limit = Number(rawPagination.limit ?? 10);
  const total = Number(rawPagination.total ?? items.length);
  const totalPages = Number(
    rawPagination.totalPages ?? Math.ceil(total / limit),
  );
  const from = Number(
    rawPagination.from ?? (total === 0 ? 0 : (page - 1) * limit + 1),
  );
  const to = Number(rawPagination.to ?? Math.min(page * limit, total));

  return {
    items,
    pagination: {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
      total: Number.isFinite(total) && total > 0 ? total : 0,
      totalPages:
        Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 0,
      from: Number.isFinite(from) && from > 0 ? from : 0,
      to: Number.isFinite(to) && to > 0 ? to : 0,
      hasPreviousPage: Boolean(rawPagination.hasPreviousPage ?? page > 1),
      hasNextPage: Boolean(rawPagination.hasNextPage ?? page < totalPages),
    },
  };
}

function formatDateTime(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "-" };

  return {
    date: formatInZone(date, locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: formatInZone(date, locale, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function normalizeIp(value: string | null | undefined, locale: Locale) {
  const copy = COPY[locale].table;
  if (!value) return copy.unavailable;
  if (value === "::1" || value === "127.0.0.1") return copy.local;
  return value;
}

export default function ActivityPage() {
  const localeState = useLocale() as { locale?: Locale };
  const locale: Locale = localeState?.locale === "en" ? "en" : "ar";
  const isRtl = locale === "ar";
  const fieldDir = isRtl ? "rtl" : "ltr";
  const copy = COPY[locale];

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pagination, setPagination] =
    useState<ActivityPagination>(EMPTY_PAGINATION);
  const [stats, setStats] = useState<ActivityStats>({
    total: 0,
    today: 0,
    security: 0,
    finance: 0,
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [type, setType] = useState("all");
  const [period, setPeriod] = useState("all");
  const [actorId, setActorId] = useState("all");
  // Null for users who only see their own activity: no user filter then.
  const [members, setMembers] = useState<ActivityMember[] | null>(null);

  async function load({ showToast = false }: { showToast?: boolean } = {}) {
    try {
      if (activities.length) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (type !== "all") params.set("category", type);
      if (period !== "all") params.set("period", period);
      if (actorId !== "all") params.set("actorId", actorId);

      const res = await fetch(`/api/activity?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success === false) {
        toast.error(data?.message ?? copy.messages.loadError);
        return;
      }

      const payload = safeActivityPayload(data);

      setActivities(payload.items);
      setPagination(payload.pagination);
      if (data?.data?.stats) setStats(data.data.stats);
      setMembers(Array.isArray(data?.data?.members) ? data.data.members : null);

      if (showToast) toast.success(copy.messages.refreshed);
    } catch {
      toast.error(copy.messages.loadException);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, page, type, period, actorId]);

  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const hasActiveFilters = type !== "all" || period !== "all" || actorId !== "all";

  function clearFilters() {
    setType("all");
    setPeriod("all");
    setActorId("all");
    setPage(1);
  }

  const pageNumbers = useMemo(() => {
    const totalPages = pagination.totalPages;
    const currentPage = pagination.page || page;

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set<number>([1, totalPages]);

    for (let value = currentPage - 1; value <= currentPage + 1; value += 1) {
      if (value > 1 && value < totalPages) {
        pages.add(value);
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }, [page, pagination.page, pagination.totalPages]);

  const columns: VDSDataTableColumn<ActivityItem>[] = [
    {
      id: "activity",
      header: copy.table.activity,
      accessor: "title",
      sortable: true,
      width: "34%",
      cell: (activity) => {
        const title = displayActivityTitle(activity, locale);
        const message = displayActivityMessage(activity, locale);
        const badgeLabel = activityLabel(activity.type, locale);
        const messageDuplicatesTitle = message === title;
        const badgeDuplicatesTitle = badgeLabel === title;

        return (
          <div className="flex min-w-0 items-start gap-3 text-start">
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5">
              <FileText
                className="h-4 w-4"
                style={{ color: "var(--text)" }}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 flex-1 text-start">
              <p className="font-black" style={{ color: "var(--text)" }}>
                {title}
              </p>

              {!messageDuplicatesTitle && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                  {message}
                </p>
              )}

              {!badgeDuplicatesTitle && (
                <VDSBadge
                  tone={categoryTone(activity.type, activity.title)}
                  className="mt-2"
                >
                  {badgeLabel}
                </VDSBadge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "user",
      header: copy.table.user,
      width: "20%",
      cell: (activity) => (
        <div className="flex min-w-0 items-start gap-2 text-start">
          <UserRound
            className="h-4 w-4 shrink-0"
            style={{ color: "var(--text-3)" }}
            aria-hidden="true"
          />

          <div className="min-w-0 text-start">
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
              {activity.actor?.name ?? copy.table.system}
            </p>

            <p
              dir="ltr"
              className="max-w-[200px] truncate text-[11px]"
              style={{
                color: "var(--text-3)",
                textAlign: isRtl ? "right" : "left",
              }}
              title={activity.actor?.email ?? undefined}
            >
              {activity.actor?.email ?? "-"}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "entity",
      header: copy.table.entity,
      accessor: "entityType",
      sortable: true,
      width: "13%",
      cell: (activity) => (
        <VDSBadge tone={categoryTone(activity.entityType ?? "", null)}>
          {entityLabel(activity.entityType, locale)}
        </VDSBadge>
      ),
    },
    {
      id: "time",
      header: copy.table.time,
      accessor: "createdAt",
      sortable: true,
      width: "13%",
      cell: (activity) => {
        const dateTime = formatDateTime(activity.createdAt, locale);

        return (
          <div className="min-w-[120px]">
            <div
              className="whitespace-nowrap text-sm font-bold"
              style={{ color: "var(--text)" }}
            >
              {dateTime.date}
            </div>

            <div className="text-xs" style={{ color: "var(--text-3)" }}>
              {dateTime.time}
            </div>
          </div>
        );
      },
    },
    {
      id: "ip",
      header: copy.table.ip,
      accessor: "ipAddress",
      sortable: true,
      width: "10%",
      cell: (activity) => (
        <span
          dir="ltr"
          className="whitespace-nowrap text-xs font-bold text-slate-600 dark:text-emerald-100/80"
        >
          {normalizeIp(activity.ipAddress, locale)}
        </span>
      ),
    },
    {
      id: "action",
      header: copy.table.action,
      align: "center",
      width: "10%",
      cell: (activity) => {
        const href = entityHref(activity);

        return href ? (
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-xl border border-emerald-500/30 px-3 py-1.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-100 dark:hover:bg-[var(--brand-surface-2)]"
          >
            {copy.table.view}
          </Link>
        ) : (
          <span className="text-xs font-bold text-slate-600 dark:text-emerald-100/80">
            {copy.table.unavailable}
          </span>
        );
      },
    },
  ];

  if (loading) {
    return <AppLoader fullScreen={false} />;
  }

  return (
    <div dir={fieldDir} className="min-w-0 space-y-4 stagger">
      <PageHeader
        dir={fieldDir}
        title={copy.hero.title}
        description={copy.hero.subtitle}
        actions={
          <PageHeaderAction
            icon={RefreshCw}
            iconClassName={refreshing ? "animate-spin" : ""}
            label={copy.hero.refresh}
            onClick={() => void load({ showToast: true })}
            disabled={loading || refreshing}
          />
        }
      />

      <PageStats
        dir={fieldDir}
        items={[
          { label: copy.stats.total, value: stats.total, icon: <ActivityIcon className="h-4 w-4" />, tone: "teal" },
          { label: copy.stats.today, value: stats.today, icon: <CalendarClock className="h-4 w-4" />, tone: "blue" },
          { label: copy.stats.security, value: stats.security, icon: <ShieldCheck className="h-4 w-4" />, tone: "purple" },
          { label: copy.stats.finance, value: stats.finance, icon: <ReceiptText className="h-4 w-4" />, tone: "gold" },
        ]}
      />

      <FilterBar
        dir={fieldDir}
        active={hasActiveFilters}
        onClear={clearFilters}
        clearLabel={copy.filters.clear}
      >
        <FilterSelect
          dir={fieldDir}
          value={type}
          onChange={(e) => changeFilter(setType, e.target.value)}
          aria-label={copy.filters.typeAria}
        >
          {TYPE_OPTIONS.map(([value, key]) => (
            <option key={value} value={value}>
              {copy.filters[key]}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          dir={fieldDir}
          value={period}
          onChange={(e) => changeFilter(setPeriod, e.target.value)}
          aria-label={copy.filters.periodAria}
        >
          {PERIOD_OPTIONS.map(([value, key]) => (
            <option key={value} value={value}>
              {copy.filters[key]}
            </option>
          ))}
        </FilterSelect>

        {members && (
          <FilterSelect
            dir={fieldDir}
            value={actorId}
            onChange={(e) => changeFilter(setActorId, e.target.value)}
            aria-label={copy.filters.memberAria}
          >
            <option value="all">{copy.filters.memberAll}</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.isActive
                  ? member.name
                  : `${member.name} (${copy.filters.inactive})`}
              </option>
            ))}
          </FilterSelect>
        )}
      </FilterBar>

      <div className="min-w-0 space-y-3">
        <VDSDataTable<ActivityItem>
          rows={activities}
          columns={columns}
          getRowId={(activity) => activity.id}
          loading={false}
          isRtl={isRtl}
          labels={{
            emptyTitle: copy.empty.title,
            emptyDescription: copy.empty.sub,
          }}
          emptyIcon="🕒"
        />

        {activities.length > 0 ? (
          <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold" style={{ color: "var(--text-3)" }}>
              {pagination.total > 0
                ? `${copy.table.showing} ${pagination.from} ${copy.table.to} ${pagination.to} ${copy.table.of} ${pagination.total} ${copy.table.activityRecord}`
                : copy.table.noRecords}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPreviousPage || refreshing}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-500/30 px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-400/30 dark:text-emerald-100 dark:hover:bg-[var(--brand-surface-2)]"
              >
                {copy.table.previous}
              </button>

              {pageNumbers.map((pageNumber, index) => {
                const previousPage = pageNumbers[index - 1];
                const showDots = previousPage && pageNumber - previousPage > 1;

                return (
                  <div key={pageNumber} className="flex items-center gap-2">
                    {showDots ? (
                      <span className="px-1 text-sm font-black text-slate-400 dark:text-emerald-100/45">
                        ...
                      </span>
                    ) : null}

                    <button
                      type="button"
                      disabled={refreshing}
                      onClick={() => setPage(pageNumber)}
                      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        pagination.page === pageNumber
                          ? "border-emerald-500 bg-emerald-600 text-white shadow-sm dark:border-emerald-300 dark:bg-emerald-300 dark:text-[var(--brand-canvas)]"
                          : "border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-100 dark:hover:bg-[var(--brand-surface-2)]"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                disabled={!pagination.hasNextPage || refreshing}
                onClick={() =>
                  setPage((current) =>
                    Math.min(current + 1, Math.max(pagination.totalPages, 1)),
                  )
                }
                className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-500/30 px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-400/30 dark:text-emerald-100 dark:hover:bg-[var(--brand-surface-2)]"
              >
                {copy.table.next}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
