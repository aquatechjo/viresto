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
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import PageLoader from "@/components/ui/PageLoader";
import EmptyState from "@/components/ui/EmptyState";
import { useLocale } from "@/lib/useLocale";
import AppLoader from "@/components/ui/AppLoader"
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
      badge: "كل الأنشطة",
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
      searchPlaceholder: "ابحث في النشاط...",
      search: "بحث",
      typeAria: "فلترة نوع النشاط",
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
      USER_LOGIN: "تسجيل دخول",
      USER_LOGOUT: "تسجيل خروج",
      USER_CREATED: "إضافة مستخدم",
      USER_UPDATED: "تعديل مستخدم",
      USER_DISABLED: "تعطيل مستخدم",
      USER_ENABLED: "تفعيل مستخدم",
      SESSION_REVOKED: "إلغاء جلسة",
    },
  },
  en: {
    hero: {
      badge: "All activities",
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
      searchPlaceholder: "Search activity...",
      search: "Search",
      typeAria: "Filter activity type",
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
      USER_LOGIN: "User signed in",
      USER_LOGOUT: "User signed out",
      USER_CREATED: "User created",
      USER_UPDATED: "User updated",
      USER_DISABLED: "User disabled",
      USER_ENABLED: "User enabled",
      SESSION_REVOKED: "Session revoked",
    },
  },
} as const;

const RAW_ACTIVITY_ALIASES: Record<string, keyof typeof COPY.ar.activities> = {
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

  "تسجيل دخول": "USER_LOGIN",
  "User signed in": "USER_LOGIN",
  "تسجيل خروج": "USER_LOGOUT",
  "User signed out": "USER_LOGOUT",
};

const TYPE_OPTIONS = [
  ["all", "all"],
  ["CLIENT_CREATED", "clients"],
  ["CASE_CREATED", "cases"],
  ["APPOINTMENT_CREATED", "appointments"],
  ["TASK_CREATED", "tasks"],
  ["DOCUMENT_UPLOADED", "documents"],
  ["PAYMENT_ADDED", "payments"],
  ["INVOICE_CREATED", "invoices"],
  ["USER_LOGIN", "security"],
] as const;

function resolveActivityKey(
  value?: string | null,
): keyof typeof COPY.ar.activities | null {
  if (!value) return null;
  const direct = value as keyof typeof COPY.ar.activities;
  if (direct in COPY.ar.activities) return direct;

  const trimmed = value.trim();
  if (trimmed in RAW_ACTIVITY_ALIASES) return RAW_ACTIVITY_ALIASES[trimmed];

  const compact = trimmed
    .replace(/^تم\s+/u, "")
    .replace(/^New\s+/iu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (compact in RAW_ACTIVITY_ALIASES) return RAW_ACTIVITY_ALIASES[compact];

  return null;
}

function activityLabel(value: string | null | undefined, locale: Locale) {
  const key = resolveActivityKey(value);
  if (key) return COPY[locale].activities[key];
  return value ? value.replaceAll("_", " ") : "-";
}

function displayActivityTitle(activity: ActivityItem, locale: Locale) {
  const fromTitle = resolveActivityKey(activity.title);
  if (fromTitle) return COPY[locale].activities[fromTitle];

  const fromType = resolveActivityKey(activity.type);
  if (fromType) return COPY[locale].activities[fromType];

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
    normalized.includes("تسجيل دخول") ||
    normalized.includes("تسجيل خروج")
  ) {
    return "security";
  }

  if (
    normalized.includes("PAYMENT") ||
    normalized.includes("INVOICE") ||
    normalized.includes("دفعة") ||
    normalized.includes("فاتورة")
  ) {
    return "finance";
  }

  if (normalized.includes("CASE") || normalized.includes("قضية"))
    return "cases";

  return "other";
}

function safeActivities(data: any): ActivityItem[] {
  const candidates = [
    data,
    data?.data,
    data?.items,
    data?.activities,
    data?.data?.items,
    data?.data?.activities,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function formatDateTime(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "-" };

  const formatterLocale = locale === "ar" ? "ar-JO" : "en-US";

  return {
    date: new Intl.DateTimeFormat(formatterLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat(formatterLocale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
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
  const fieldTextAlign = isRtl ? "right" : "left";
  const copy = COPY[locale];

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");

  async function load(showToast = false) {
    try {
      if (activities.length) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({ limit: "100" });
      if (type !== "all") params.set("type", type);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/activity?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success === false) {
        toast.error(data?.message ?? copy.messages.loadError);
        return;
      }

      setActivities(safeActivities(data));
      if (showToast) toast.success(copy.messages.refreshed);
    } catch {
      toast.error(copy.messages.loadException);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, locale]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activities;

    return activities.filter((activity) => {
      const title = displayActivityTitle(activity, locale);
      const message = displayActivityMessage(activity, locale);
      const entity = entityLabel(activity.entityType, locale);

      return (
        title.toLowerCase().includes(q) ||
        message.toLowerCase().includes(q) ||
        activity.title?.toLowerCase().includes(q) ||
        activity.message?.toLowerCase().includes(q) ||
        activity.type?.toLowerCase().includes(q) ||
        entity.toLowerCase().includes(q) ||
        activity.entityType?.toLowerCase().includes(q) ||
        activity.actor?.name?.toLowerCase().includes(q) ||
        activity.actor?.email?.toLowerCase().includes(q)
      );
    });
  }, [activities, search, locale]);

  const today = new Date().toDateString();
  const stats = {
    total: activities.length,
    today: activities.filter(
      (activity) => new Date(activity.createdAt).toDateString() === today,
    ).length,
    security: activities.filter(
      (activity) => categoryOf(activity.type, activity.title) === "security",
    ).length,
    finance: activities.filter(
      (activity) => categoryOf(activity.type, activity.title) === "finance",
    ).length,
  };

if (loading) {
  return <AppLoader fullScreen={false} />
}

  return (
    <div dir={fieldDir} className="space-y-5 stagger">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6 text-start"
        style={{
          background:
            "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
          borderColor: "rgba(255,255,255,0.12)",
          boxShadow: "0 18px 50px rgba(45, 74, 62, 0.18)",
        }}
      >
        <div
          className={`absolute -top-14 h-40 w-40 rounded-full ${
            isRtl ? "-right-14" : "-left-14"
          }`}
          style={{ background: "rgba(245, 200, 66, 0.16)" }}
        />

        <div
          className={`absolute -bottom-20 h-52 w-52 rounded-full ${
            isRtl ? "left-16" : "right-16"
          }`}
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        <div
          className={`relative z-10 flex min-h-[126px] flex-col gap-5 xl:flex-row xl:items-center xl:justify-between ${
            isRtl ? "" : "xl:flex-row-reverse"
          }`}
        >
          <div className="flex shrink-0 items-center gap-2 self-center xl:self-auto">
            <button
              onClick={() => void load(true)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white px-5 py-3 text-sm font-black text-[var(--sidebar)] shadow-lg transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              {copy.hero.refresh}
            </button>
          </div>

          <div className="text-start">
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

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {copy.hero.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: copy.stats.total, value: stats.total, icon: ActivityIcon },
          { label: copy.stats.today, value: stats.today, icon: CalendarClock },
          {
            label: copy.stats.security,
            value: stats.security,
            icon: ShieldCheck,
          },
          {
            label: copy.stats.finance,
            value: stats.finance,
            icon: ReceiptText,
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-4 text-start">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p
                  className="text-xs font-bold"
                  style={{ color: "var(--text-3)" }}
                >
                  {stat.label}
                </p>
                <p
                  className="mt-1 text-2xl font-black"
                  style={{ color: "var(--text)" }}
                >
                  {stat.value}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5">
                <stat.icon
                  className="h-5 w-5"
                  style={{ color: "var(--sidebar)" }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4" dir={fieldDir}>
        <div className="grid gap-3 xl:grid-cols-[1fr_auto_260px] xl:items-center">
          <input
            dir={fieldDir}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.filters.searchPlaceholder}
            className="input h-12 w-full px-4 text-start text-slate-800 placeholder:text-slate-400 dark:text-emerald-50 dark:placeholder:text-emerald-100/60"
            style={{ textAlign: fieldTextAlign }}
          />

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 dark:border-emerald-400/30 dark:bg-[#1f4d35] dark:text-emerald-50 dark:hover:bg-[#276342]"
            title={copy.filters.search}
          >
            <Search className="h-4 w-4" />
            <span>{copy.filters.search}</span>
          </button>

          <select
            dir={fieldDir}
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input h-12 w-full text-start"
            style={{ textAlign: fieldTextAlign }}
            aria-label={copy.filters.typeAria}
          >
            {TYPE_OPTIONS.map(([value, key]) => (
              <option
                key={value}
                value={value}
                dir={fieldDir}
                style={{ textAlign: fieldTextAlign }}
              >
                {copy.filters[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🧾" title={copy.empty.title} sub={copy.empty.sub} />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="data-table w-full table-fixed text-sm [&_td]:!text-start [&_td]:align-middle [&_th]:!text-start" dir={fieldDir}>
              <thead>
                <tr>
                  <th className="w-[34%] !text-start" style={{ textAlign: fieldTextAlign }}>{copy.table.activity}</th>
                  <th className="w-[20%] !text-start" style={{ textAlign: fieldTextAlign }}>{copy.table.user}</th>
                  <th className="w-[13%] !text-start" style={{ textAlign: fieldTextAlign }}>{copy.table.entity}</th>
                  <th className="w-[13%] !text-start" style={{ textAlign: fieldTextAlign }}>{copy.table.time}</th>
                  <th className="w-[10%] !text-start" style={{ textAlign: fieldTextAlign }}>{copy.table.ip}</th>
                  <th className="w-[10%] !text-start" style={{ textAlign: fieldTextAlign }}>{copy.table.action}</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((activity) => {
                  const href = entityHref(activity);
                  const dateTime = formatDateTime(activity.createdAt, locale);

                  return (
                    <tr key={activity.id}>
                      <td className="!text-start align-middle" style={{ textAlign: fieldTextAlign }}>
                        <div className="flex items-start justify-start gap-3 text-start">
                          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-black/5">
                            <FileText
                              className="h-4 w-4"
                              style={{ color: "var(--sidebar)" }}
                            />
                          </div>
                          <div className="min-w-0 text-start">
                            <p
                              className="font-black"
                              style={{ color: "var(--text)" }}
                            >
                              {displayActivityTitle(activity, locale)}
                            </p>
                            <p
                              className="mt-1 text-xs"
                              style={{ color: "var(--text-3)" }}
                            >
                              {displayActivityMessage(activity, locale)}
                            </p>
                            <span className="mt-2 inline-flex rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-[var(--text-2)]">
                              {activityLabel(activity.type, locale)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="!text-start align-middle" style={{ textAlign: fieldTextAlign }}>
                        <div className="flex items-start justify-start gap-2 text-start">
                          <UserRound
                            className="h-4 w-4"
                            style={{ color: "var(--text-3)" }}
                          />
                          <div className="min-w-0 text-start">
                            <p
                              className="text-sm font-bold"
                              style={{ color: "var(--text)" }}
                            >
                              {activity.actor?.name ?? copy.table.system}
                            </p>
                            <p
                              className="text-[11px]"
                              style={{ color: "var(--text-3)" }}
                            >
                              {activity.actor?.email ?? "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="!text-start align-middle" style={{ textAlign: fieldTextAlign }}>
                        <span className="rounded-full bg-black/5 px-2 py-1 text-xs font-bold text-[var(--text-2)]">
                          {entityLabel(activity.entityType, locale)}
                        </span>
                      </td>

                      <td className="!text-start align-middle" style={{ textAlign: fieldTextAlign }}>
                        <div
                          className="text-sm font-bold"
                          style={{ color: "var(--text)" }}
                        >
                          {dateTime.date}
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: "var(--text-3)" }}
                        >
                          {dateTime.time}
                        </div>
                      </td>

                      <td className="!text-start align-middle" style={{ textAlign: fieldTextAlign }}>
                        <span className="text-xs font-bold text-slate-600 dark:text-emerald-100/80">
                          {normalizeIp(activity.ipAddress, locale)}
                        </span>
                      </td>

                      <td className="!text-start align-middle" style={{ textAlign: fieldTextAlign }}>
                        {href ? (
                          <Link
                            href={href}
                            className="inline-flex items-center justify-center rounded-xl border border-emerald-500/30 px-3 py-1.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-100 dark:hover:bg-[#173827]"
                          >
                            {copy.table.view}
                          </Link>
                        ) : (
                          <span className="text-xs font-bold text-slate-600 dark:text-emerald-100/80">
                            {copy.table.unavailable}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
