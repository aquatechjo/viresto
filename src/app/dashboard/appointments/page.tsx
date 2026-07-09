"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import AppLoader from "@/components/ui/AppLoader";
import Modal from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import PageLoader from "@/components/ui/PageLoader";
import EmptyState from "@/components/ui/EmptyState";
import { DateTime } from "luxon";
import { translations, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import SubscriptionReadOnlyBanner from "@/components/billing/SubscriptionReadOnlyBanner";
import { useTenantWriteAccess } from "@/hooks/useTenantWriteAccess";

const AppointmentsCalendar = dynamic(() => import("./AppointmentsCalendar"), {
  ssr: false,
  loading: () => <PageLoader />,
});

interface Appt {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  type: string;
  status: string;
  description?: string;
  client?: {
    id?: string;
    name: string;
    archivedAt?: string | null;
  } | null;
  case?: {
    id?: string;
    title: string;
    client?: {
      id?: string;
      name?: string;
      archivedAt?: string | null;
    } | null;
  } | null;
}

interface ClientItem {
  id: string;
  name: string;
  archivedAt?: string | null;
}

const TYPE_COLOR: Record<string, string> = {
  COURT_SESSION: "var(--sidebar)",
  MEETING: "#2563eb",
  PHONE_CALL: "#d97706",
  DEADLINE: "#dc2626",
  OTHER: "var(--text-3)",
};

const TYPE_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    COURT_SESSION: "جلسة",
    MEETING: "اجتماع",
    PHONE_CALL: "اتصال",
    DEADLINE: "موعد نهائي",
    OTHER: "أخرى",
  },
  en: {
    COURT_SESSION: "Court session",
    MEETING: "Meeting",
    PHONE_CALL: "Phone call",
    DEADLINE: "Deadline",
    OTHER: "Other",
  },
};

const INIT = {
  title: "",
  clientId: "",
  caseId: "",
  startTime: "",
  endTime: "",
  location: "",
  type: "MEETING",
  description: "",
};

const TENANT_TIME_ZONE = "Asia/Amman";

function toDateTimeLocal(value?: string, timeZone = TENANT_TIME_ZONE) {
  if (!value) return "";

  const date = DateTime.fromISO(value, { setZone: true }).setZone(timeZone);

  if (!date.isValid) return "";

  return date.toFormat("yyyy-MM-dd'T'HH:mm");
}

function dateTimeLocalToIso(value?: string, timeZone = TENANT_TIME_ZONE) {
  if (!value) return undefined;

  const date = DateTime.fromISO(value, { zone: timeZone });

  if (!date.isValid) return undefined;

  return date.toUTC().toISO() ?? undefined;
}

function formatDateInZone(
  value: string,
  locale: Locale,
  timeZone = TENANT_TIME_ZONE,
) {
  const date = DateTime.fromISO(value, { setZone: true }).setZone(timeZone);

  if (!date.isValid) return "-";

  return date.setLocale(locale === "ar" ? "ar-JO" : "en-US").toLocaleString({
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDateInZone(
  value: string,
  locale: Locale,
  timeZone = TENANT_TIME_ZONE,
) {
  const date = DateTime.fromISO(value, { setZone: true }).setZone(timeZone);

  if (!date.isValid) return "-";

  return date
    .setLocale(locale === "ar" ? "ar-JO" : "en-US")
    .toLocaleString(DateTime.DATE_MED);
}

function formatTimeInZone(
  value: string,
  locale: Locale,
  timeZone = TENANT_TIME_ZONE,
) {
  const date = DateTime.fromISO(value, { setZone: true }).setZone(timeZone);

  if (!date.isValid) return "-";

  return date
    .setLocale(locale === "ar" ? "ar-JO" : "en-US")
    .toLocaleString(DateTime.TIME_SIMPLE);
}

function toTenantDateKey(value: string, timeZone = TENANT_TIME_ZONE) {
  const date = DateTime.fromISO(value, { setZone: true }).setZone(timeZone);

  if (!date.isValid) return "invalid-date";

  return date.toISODate() ?? "invalid-date";
}

function getCreateStartValue(startTime?: string, timeZone = TENANT_TIME_ZONE) {
  if (!startTime) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(startTime)) {
    return `${startTime}T09:00`;
  }

  const date = DateTime.fromISO(startTime, { setZone: true }).setZone(timeZone);

  if (!date.isValid) return "";

  return date.toFormat("yyyy-MM-dd'T'HH:mm");
}

export default function AppointmentsPage() {
  const localeState = useLocale() as {
    locale?: Locale;
    t?: typeof translations.ar;
  };
  const locale = localeState?.locale === "en" ? "en" : "ar";
  const t = localeState?.t ?? translations[locale] ?? translations.ar;
  const a = t.appointments ?? translations.ar.appointments;
  const common = t.common ?? translations.ar.common;
  const isRtl = locale === "ar";
  const tenantTimeZone = TENANT_TIME_ZONE;
  const typeLabels = TYPE_LABELS[locale] ?? TYPE_LABELS.ar;
  const appointmentLogCopy =
    locale === "ar"
      ? {
          title: "سجل المواعيد",
          subtitle: "كل المواعيد مرتبة حسب التاريخ من الأقدم إلى الأحدث",
          count: "موعد",
          emptyTitle: "لا يوجد سجل مواعيد حالياً",
          emptySub: "عند إضافة موعد جديد سيظهر هنا تلقائياً.",
          emptyFilteredSub: "لا توجد مواعيد مطابقة للبحث أو نوع الموعد المحدد.",
          clearFilters: "مسح الفلاتر",
          noClient: "بدون موكل",
          noCase: "بدون قضية",
          noLocation: "بدون مكان",
          noDescription: "لا توجد ملاحظات",
          endTime: "ينتهي",
        }
      : {
          title: "Appointments log",
          subtitle: "All appointments sorted by date from oldest to newest",
          count: "appointments",
          emptyTitle: "No appointment log yet",
          emptySub: "New appointments will appear here automatically.",
          emptyFilteredSub:
            "No appointments match the current search or type filter.",
          clearFilters: "Clear filters",
          noClient: "No client",
          noCase: "No case",
          noLocation: "No location",
          noDescription: "No notes",
          endTime: "Ends",
        };
  const fieldDir = {
    dir: (isRtl ? "rtl" : "ltr") as "rtl" | "ltr",
    style: {
      textAlign: isRtl ? "right" : "left",
      direction: isRtl ? "rtl" : "ltr",
    } as React.CSSProperties,
  };

  const dateTimeFieldStyle = {
    textAlign: "left",
    direction: "ltr",
    colorScheme: "dark",
  } as React.CSSProperties;

  const [appts, setAppts] = useState<Appt[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appt | null>(null);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INIT);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const writeAccess = useTenantWriteAccess(locale);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);

      const [appointmentsRes, clientsRes] = await Promise.all([
        fetch("/api/appointments?includeArchivedClients=true"),
        fetch("/api/clients?limit=100&archive=active"),
      ]);

      const safeJson = async (response: Response) => {
        if (!response.ok) return { data: [] };

        try {
          return await response.json();
        } catch {
          return { data: [] };
        }
      };

      const [appointmentsData, clientsData] = await Promise.all([
        safeJson(appointmentsRes),
        safeJson(clientsRes),
      ]);

      setAppts(
        Array.isArray(appointmentsData.data) ? appointmentsData.data : [],
      );
      setClients(
        Array.isArray(clientsData.data?.data)
          ? clientsData.data.data
          : Array.isArray(clientsData.data)
            ? clientsData.data
            : [],
      );
    } catch {
      toast.error(a.messages.loadError);

      if (!options?.silent) {
        setAppts([]);
        setClients([]);
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isArchivedAppt = useCallback((appt: Appt) => {
    return Boolean(appt.client?.archivedAt || appt.case?.client?.archivedAt);
  }, []);

  const selectedApptArchived = selectedAppt
    ? isArchivedAppt(selectedAppt)
    : false;

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientId),
    [clients, form.clientId],
  );

  const selectedClientArchived = Boolean(selectedClient?.archivedAt);

  const todayKey = useMemo(
    () => DateTime.now().setZone(tenantTimeZone).toISODate(),
    [tenantTimeZone],
  );

  const todayAppts = useMemo(
    () =>
      appts.filter(
        (appt) => toTenantDateKey(appt.startTime, tenantTimeZone) === todayKey,
      ),
    [appts, todayKey, tenantTimeZone],
  );

  const courtSessions = appts.filter(
    (appt) => appt.type === "COURT_SESSION",
  ).length;
  const deadlines = appts.filter((appt) => appt.type === "DEADLINE").length;

  const filteredAppts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return appts.filter((appt) => {
      const matchesType = typeFilter === "all" || appt.type === typeFilter;

      const matchesSearch =
        !query ||
        appt.title?.toLowerCase().includes(query) ||
        appt.location?.toLowerCase().includes(query) ||
        appt.client?.name?.toLowerCase().includes(query) ||
        appt.case?.title?.toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [appts, search, typeFilter]);

  const appointmentLog = useMemo(
    () =>
      [...filteredAppts].sort(
        (first, second) =>
          new Date(first.startTime).getTime() -
          new Date(second.startTime).getTime(),
      ),
    [filteredAppts],
  );

  const appointmentLogGroups = useMemo(() => {
    const groups = new Map<string, Appt[]>();

    for (const appt of appointmentLog) {
      const key = toTenantDateKey(appt.startTime, tenantTimeZone);

      groups.set(key, [...(groups.get(key) ?? []), appt]);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label:
        key === "invalid-date"
          ? "-"
          : formatDateInZone(items[0].startTime, locale, tenantTimeZone),
      items,
    }));
  }, [appointmentLog, locale, tenantTimeZone]);

  const hasActiveFilters = Boolean(search.trim()) || typeFilter !== "all";

  const calendarEvents = useMemo(
    () =>
      filteredAppts.map((appt) => ({
        id: appt.id,
        title: appt.client?.name
          ? `${appt.title} - ${appt.client.name}`
          : appt.title,
        start: appt.startTime,
        end: appt.endTime,
        backgroundColor: TYPE_COLOR[appt.type] || "var(--sidebar)",
        borderColor: TYPE_COLOR[appt.type] || "var(--sidebar)",
        extendedProps: appt,
      })),
    [filteredAppts],
  );

  function f(key: keyof typeof INIT) {
    return (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setForm((previous) => ({
        ...previous,
        [key]: event.target.value,
      }));
    };
  }

  function resetForm() {
    setForm(INIT);
    setEditMode(false);
    setSelectedAppt(null);
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
  }

  async function saveAppointment(event: React.FormEvent) {
    event.preventDefault();

    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || a.messages.saveError);
      return;
    }

    if (!form.title.trim() || !form.startTime) {
      toast.error(a.messages.requiredTitleTime);
      return;
    }

    if (editMode && selectedAppt && isArchivedAppt(selectedAppt)) {
      toast.warning(a.messages.archivedEditBlocked);
      return;
    }

    if (selectedClientArchived) {
      toast.warning(a.messages.archivedCreateBlocked);
      return;
    }

    const startTimeIso = dateTimeLocalToIso(form.startTime, tenantTimeZone);
    const endTimeIso = dateTimeLocalToIso(form.endTime, tenantTimeZone);

    if (!startTimeIso) {
      toast.error(a.messages.requiredTitleTime);
      return;
    }

    if (endTimeIso && new Date(endTimeIso) <= new Date(startTimeIso)) {
      toast.error(
        locale === "ar"
          ? "وقت نهاية الموعد يجب أن يكون بعد وقت البداية"
          : "The appointment end time must be after the start time",
      );
      return;
    }

    try {
      setSaving(true);

      const url =
        editMode && selectedAppt
          ? `/api/appointments/${selectedAppt.id}`
          : "/api/appointments";

      const method = editMode ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startTime: startTimeIso,
          endTime: endTimeIso,
          timeZone: tenantTimeZone,
          clientId: form.clientId || undefined,
          caseId: form.caseId || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        toast.error(data.message || a.messages.saveError);
        return;
      }

      toast.success(
        editMode ? a.messages.updateSuccess : a.messages.createSuccess,
      );
      setOpen(false);
      resetForm();
      load({ silent: true });
    } catch {
      toast.error(a.messages.saveUnexpectedError);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment(id: string) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || a.messages.deleteError);
      return;
    }

    if (selectedAppt && isArchivedAppt(selectedAppt)) {
      toast.warning(a.messages.archivedDeleteBlocked);
      return;
    }

    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        toast.error(data.message || a.messages.deleteError);
        return;
      }

      toast.success(a.messages.deleteSuccess);
      setDetailsOpen(false);
      setSelectedAppt(null);
      load({ silent: true });
    } catch {
      toast.error(a.messages.deleteUnexpectedError);
    }
  }

  async function updateAppointmentDateRange({
    id,
    start,
    end,
    successMessage,
    errorMessage,
    revert,
  }: {
    id: string;
    start?: Date | null;
    end?: Date | null;
    successMessage: string;
    errorMessage: string;
    revert: () => void;
  }) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || errorMessage);
      revert();
      return;
    }

    if (!start) {
      toast.error(errorMessage);
      revert();
      return;
    }

    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: start.toISOString(),
          ...(end ? { endTime: end.toISOString() } : {}),
          timeZone: tenantTimeZone,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        toast.error(data.message || errorMessage);
        revert();
        return;
      }

      toast.success(successMessage);
      setAppts((previous) =>
        previous.map((appt) =>
          appt.id === id
            ? {
                ...appt,
                startTime: start.toISOString(),
                ...(end ? { endTime: end.toISOString() } : {}),
              }
            : appt,
        ),
      );
      load({ silent: true });
    } catch {
      toast.error(errorMessage);
      revert();
    }
  }

  function openCreateModal(startTime?: string) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || a.messages.saveError);
      return;
    }

    resetForm();

    setForm((previous) => ({
      ...previous,
      startTime: getCreateStartValue(startTime, tenantTimeZone),
    }));

    setOpen(true);
  }

  function openEditModal(appt: Appt) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || a.messages.saveError);
      return;
    }

    if (isArchivedAppt(appt)) {
      toast.warning(a.messages.archivedEditBlocked);
      return;
    }

    setSelectedAppt(appt);
    setForm({
      title: appt.title,
      clientId: appt.client?.id || "",
      caseId: appt.case?.id || "",
      startTime: toDateTimeLocal(appt.startTime, tenantTimeZone),
      endTime: toDateTimeLocal(appt.endTime, tenantTimeZone),
      location: appt.location || "",
      type: appt.type || "MEETING",
      description: appt.description || "",
    });

    setEditMode(true);
    setDetailsOpen(false);
    setOpen(true);
  }

  if (loading) {
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
          boxShadow: "0 18px 50px rgba(45, 74, 62, 0.18)",
        }}
      >
        <div
          className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
          style={{ background: "rgba(245, 200, 66, 0.16)" }}
        />

        <div
          className="absolute -bottom-20 right-16 h-52 w-52 rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-start">
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {a.hero.badge}
            </div>

            <h1 className="text-2xl font-black text-white">{a.hero.title}</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {a.hero.subtitle}
            </p>
          </div>

          <button
            onClick={() => openCreateModal()}
            disabled={!writeAccess.canWrite}
            title={
              !writeAccess.canWrite
                ? writeAccess.message || a.messages.saveError
                : a.actions.newAppointment
            }
            className="btn shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "#fff",
              color: "var(--sidebar)",
              borderColor: "rgba(255,255,255,0.32)",
            }}
          >
            {a.actions.newAppointment}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: a.stats.total,
            value: appts.length,
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: a.stats.today,
            value: todayAppts.length,
            color: "var(--sidebar)",
            bg: "var(--green-soft)",
          },
          {
            label: a.stats.sessions,
            value: courtSessions,
            color: "#92400e",
            bg: "var(--amber-soft)",
          },
          {
            label: a.stats.deadlines,
            value: deadlines,
            color: deadlines > 0 ? "#dc2626" : "#6b7280",
            bg: deadlines > 0 ? "var(--red-soft)" : "var(--card)",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5 text-start"
            style={{
              background: item.bg,
              borderColor: "var(--border)",
            }}
          >
            <p className="text-xs font-black" style={{ color: item.color }}>
              {item.label}
            </p>

            <p
              className="mt-2 text-3xl font-black"
              style={{ color: item.color }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div
          className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={a.filters.searchPlaceholder}
            className="input h-14"
            {...fieldDir}
          />

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="input h-14"
            {...fieldDir}
            aria-label={
              locale === "ar"
                ? "فلترة حسب نوع الموعد"
                : "Filter by appointment type"
            }
          >
            <option value="all" dir={isRtl ? "rtl" : "ltr"}>
              {a.filters.chips.all}
            </option>

            {Object.entries(typeLabels).map(([key, label]) => (
              <option key={key} value={key} dir={isRtl ? "rtl" : "ltr"}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar */}
      <div className="card p-4">
        <AppointmentsCalendar
          locale={locale}
          timeZone={tenantTimeZone}
          events={calendarEvents}
          onEventDrop={async (info) => {
            const appt = info.event.extendedProps as Appt;

            if (!writeAccess.canWrite) {
              toast.warning(writeAccess.message || a.messages.moveError);
              info.revert();
              return;
            }

            if (isArchivedAppt(appt)) {
              toast.warning(a.messages.archivedEditBlocked);
              info.revert();
              return;
            }

            await updateAppointmentDateRange({
              id: info.event.id,
              start: info.event.start,
              end: info.event.end,
              successMessage: a.messages.moveSuccess,
              errorMessage: a.messages.moveError,
              revert: () => info.revert(),
            });
          }}
          onEventResize={async (info) => {
            const appt = info.event.extendedProps as Appt;

            if (!writeAccess.canWrite) {
              toast.warning(writeAccess.message || a.messages.resizeError);
              info.revert();
              return;
            }

            if (isArchivedAppt(appt)) {
              toast.warning(a.messages.archivedEditBlocked);
              info.revert();
              return;
            }

            await updateAppointmentDateRange({
              id: info.event.id,
              start: info.event.start,
              end: info.event.end,
              successMessage: a.messages.resizeSuccess,
              errorMessage: a.messages.resizeError,
              revert: () => info.revert(),
            });
          }}
          onDateClick={(info) => openCreateModal(info.dateStr)}
          onEventClick={(info) => {
            const appt = info.event.extendedProps as Appt;

            setSelectedAppt(appt);
            setDetailsOpen(true);
          }}
        />
      </div>

      {/* Appointments Log */}
      <div className="card overflow-hidden p-0 text-start">
        <div
          className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2 className="text-lg font-black" style={{ color: "var(--text)" }}>
              {appointmentLogCopy.title}
            </h2>

            <p
              className="mt-1 text-xs font-semibold"
              style={{ color: "var(--text-3)" }}
            >
              {appointmentLogCopy.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-2xl px-4 py-2 text-xs font-black transition-all hover:-translate-y-0.5"
                style={{
                  background: "var(--card)",
                  color: "var(--text-2)",
                  border: "1px solid var(--border)",
                }}
              >
                {appointmentLogCopy.clearFilters}
              </button>
            )}

            <span
              className="rounded-2xl px-4 py-2 text-xs font-black"
              style={{
                background: "var(--green-soft)",
                color: "var(--sidebar)",
              }}
            >
              {appointmentLog.length} {appointmentLogCopy.count}
            </span>
          </div>
        </div>

        {appointmentLog.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon="🗓️"
              title={appointmentLogCopy.emptyTitle}
              sub={
                hasActiveFilters
                  ? appointmentLogCopy.emptyFilteredSub
                  : appointmentLogCopy.emptySub
              }
            />
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {appointmentLogGroups.map((group) => (
              <div key={group.key} className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3
                    className="text-sm font-black"
                    style={{ color: "var(--text)" }}
                  >
                    {group.label}
                  </h3>

                  <span
                    className="text-xs font-bold"
                    style={{ color: "var(--text-3)" }}
                  >
                    {group.items.length} {appointmentLogCopy.count}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.items.map((appt) => {
                    const archivedAppt = isArchivedAppt(appt);

                    return (
                      <button
                        key={appt.id}
                        type="button"
                        onClick={() => {
                          setSelectedAppt(appt);
                          setDetailsOpen(true);
                        }}
                        className="w-full rounded-3xl border p-4 text-start transition-all hover:-translate-y-0.5"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--card)",
                        }}
                      >
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[160px_1fr_auto] lg:items-center">
                          <div
                            className="rounded-2xl border px-4 py-3"
                            style={{
                              borderColor: "var(--border)",
                              background: "var(--green-soft)",
                            }}
                          >
                            <p
                              className="text-sm font-black"
                              style={{ color: "var(--sidebar)" }}
                            >
                              {formatTimeInZone(
                                appt.startTime,
                                locale,
                                tenantTimeZone,
                              )}
                            </p>

                            {appt.endTime && (
                              <p
                                className="mt-1 text-[11px] font-bold"
                                style={{ color: "var(--text-3)" }}
                              >
                                {appointmentLogCopy.endTime}{" "}
                                {formatTimeInZone(
                                  appt.endTime,
                                  locale,
                                  tenantTimeZone,
                                )}
                              </p>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  background:
                                    TYPE_COLOR[appt.type] ?? "var(--text-3)",
                                }}
                              />

                              <span
                                className="rounded-full px-2.5 py-1 text-[11px] font-black"
                                style={{
                                  background: "var(--green-soft)",
                                  color: "var(--sidebar)",
                                }}
                              >
                                {typeLabels[appt.type] ?? appt.type}
                              </span>

                              {archivedAppt && (
                                <span
                                  className="rounded-full px-2.5 py-1 text-[11px] font-black"
                                  style={{
                                    background: "#fff7ed",
                                    color: "#b45309",
                                    border: "1px solid rgba(180, 83, 9, 0.18)",
                                  }}
                                >
                                  {a.labels.archivedClient}
                                </span>
                              )}
                            </div>

                            <p
                              className="mt-2 truncate text-base font-black"
                              style={{ color: "var(--text)" }}
                            >
                              {appt.title}
                            </p>

                            {appt.description ? (
                              <p
                                className="mt-1 line-clamp-2 text-xs font-semibold"
                                style={{ color: "var(--text-3)" }}
                              >
                                {appt.description}
                              </p>
                            ) : (
                              <p
                                className="mt-1 text-xs font-semibold"
                                style={{ color: "var(--text-3)" }}
                              >
                                {appointmentLogCopy.noDescription}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-2 text-xs font-bold lg:min-w-[220px]">
                            <span
                              className="truncate"
                              style={{ color: "var(--text-2)" }}
                            >
                              👤{" "}
                              {appt.client?.name || appointmentLogCopy.noClient}
                            </span>

                            <span
                              className="truncate"
                              style={{ color: "var(--text-2)" }}
                            >
                              ⚖️ {appt.case?.title || appointmentLogCopy.noCase}
                            </span>

                            <span
                              className="truncate"
                              style={{ color: "var(--text-2)" }}
                            >
                              📍{" "}
                              {appt.location || appointmentLogCopy.noLocation}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title={editMode ? a.modal.editTitle : a.modal.createTitle}
      >
        <form
          onSubmit={saveAppointment}
          className="space-y-3 text-start"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <FormField label={a.form.title} required>
            <input
              value={form.title}
              onChange={f("title")}
              className="input"
              {...fieldDir}
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={a.form.type}>
              <select
                aria-label={a.form.type}
                value={form.type}
                onChange={f("type")}
                className="input"
                {...fieldDir}
              >
                {Object.entries(typeLabels).map(([key, value]) => (
                  <option key={key} value={key} dir={isRtl ? "rtl" : "ltr"}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={a.form.client}>
              <select
                aria-label={a.form.client}
                value={form.clientId}
                onChange={f("clientId")}
                className="input"
                {...fieldDir}
              >
                <option value="" dir={isRtl ? "rtl" : "ltr"}>
                  {a.form.noClient}
                </option>

                {clients.map((client) => (
                  <option
                    key={client.id}
                    value={client.id}
                    dir={isRtl ? "rtl" : "ltr"}
                  >
                    {client.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {selectedClientArchived && (
            <div
              className="rounded-2xl border p-3 text-xs font-bold"
              style={{
                background: "#fff7ed",
                color: "#b45309",
                borderColor: "rgba(180, 83, 9, 0.22)",
              }}
            >
              {a.messages.archivedLinkBlocked}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={a.form.startTime} required>
              <input
                aria-label={a.form.startTime}
                type="datetime-local"
                value={form.startTime}
                onChange={f("startTime")}
                className="input"
                dir="ltr"
                style={dateTimeFieldStyle}
              />
            </FormField>

            <FormField label={a.form.endTime}>
              <input
                aria-label={a.form.endTime}
                type="datetime-local"
                value={form.endTime}
                onChange={f("endTime")}
                className="input"
                dir="ltr"
                style={dateTimeFieldStyle}
              />
            </FormField>
          </div>

          <FormField label={a.form.location}>
            <input
              aria-label={a.form.location}
              value={form.location}
              onChange={f("location")}
              placeholder={a.form.locationPlaceholder}
              className="input"
              {...fieldDir}
            />
          </FormField>

          <FormField label={a.form.description}>
            <textarea
              aria-label={a.form.description}
              value={form.description}
              onChange={f("description")}
              className="input"
              rows={2}
              dir={isRtl ? "rtl" : "ltr"}
              style={{ resize: "none", textAlign: isRtl ? "right" : "left" }}
            />
          </FormField>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              className="btn btn-ghost flex-1"
            >
              {common.cancel}
            </button>

            <button
              type="submit"
              disabled={saving || selectedClientArchived}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="spinner spinner-sm" />
              ) : editMode ? (
                a.actions.saveChanges
              ) : (
                common.save
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedAppt(null);
        }}
        title={a.details.title}
      >
        {selectedAppt && (
          <div className="space-y-4 text-start" dir={isRtl ? "rtl" : "ltr"}>
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "var(--border)",
                background: "var(--green-soft)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-black" style={{ color: "var(--text)" }}>
                  {selectedAppt.title}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-black"
                    style={{
                      background: "#fff",
                      color: TYPE_COLOR[selectedAppt.type] ?? "var(--sidebar)",
                    }}
                  >
                    {typeLabels[selectedAppt.type] ?? selectedAppt.type}
                  </span>

                  {selectedApptArchived && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-black"
                      style={{
                        background: "#fff7ed",
                        color: "#b45309",
                        border: "1px solid rgba(180, 83, 9, 0.18)",
                      }}
                    >
                      {a.labels.archivedClient}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p
                    className="text-xs font-bold"
                    style={{ color: "var(--text-3)" }}
                  >
                    {a.details.date}
                  </p>
                  <p
                    className="mt-1 text-sm font-bold"
                    style={{ color: "var(--text)" }}
                  >
                    {formatShortDateInZone(
                      selectedAppt.startTime,
                      locale,
                      tenantTimeZone,
                    )}
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-bold"
                    style={{ color: "var(--text-3)" }}
                  >
                    {a.details.time}
                  </p>
                  <p
                    className="mt-1 text-sm font-bold"
                    style={{ color: "var(--text)" }}
                  >
                    {formatTimeInZone(
                      selectedAppt.startTime,
                      locale,
                      tenantTimeZone,
                    )}
                    {selectedAppt.endTime
                      ? ` - ${formatTimeInZone(selectedAppt.endTime, locale, tenantTimeZone)}`
                      : ""}
                  </p>
                </div>

                {selectedAppt.client?.name && (
                  <div>
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--text-3)" }}
                    >
                      {a.details.client}
                    </p>
                    <p
                      className="mt-1 text-sm font-bold"
                      style={{ color: "var(--text)" }}
                    >
                      {selectedAppt.client.name}
                    </p>
                  </div>
                )}

                {selectedAppt.case?.title && (
                  <div>
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--text-3)" }}
                    >
                      {a.details.case}
                    </p>
                    <p
                      className="mt-1 text-sm font-bold"
                      style={{ color: "var(--text)" }}
                    >
                      {selectedAppt.case.title}
                    </p>
                  </div>
                )}

                {selectedAppt.location && (
                  <div className="sm:col-span-2">
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--text-3)" }}
                    >
                      {a.details.location}
                    </p>
                    <p
                      className="mt-1 text-sm font-bold"
                      style={{ color: "var(--text)" }}
                    >
                      {selectedAppt.location}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDetailsOpen(false);
                  setSelectedAppt(null);
                }}
                className="btn btn-ghost flex-1"
              >
                {a.actions.close}
              </button>

              <button
                type="button"
                disabled={selectedApptArchived}
                title={
                  selectedApptArchived
                    ? a.messages.archivedEditBlocked
                    : common.edit
                }
                onClick={() => openEditModal(selectedAppt)}
                className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {common.edit}
              </button>

              <button
                type="button"
                disabled={selectedApptArchived}
                title={
                  selectedApptArchived
                    ? a.messages.archivedDeleteBlocked
                    : common.delete
                }
                onClick={() => {
                  if (selectedApptArchived) {
                    toast.warning(a.messages.archivedDeleteBlocked);
                    return;
                  }

                  deleteAppointment(selectedAppt.id);
                }}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {common.delete}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
