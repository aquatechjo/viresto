"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import AppLoader from "@/components/ui/AppLoader";
import Modal from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import PageLoader from "@/components/ui/PageLoader";
import {
  VDSBadge,
  VDSCard,
  VDSEmptyState,
  type VDSTone,
} from "@/components/ui/vds";
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
  assignedTo?: TeamMember | null;
  createdBy?: TeamMember | null;
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

interface TeamMember {
  id: string;
  name: string;
  role: "ADMIN" | "LAWYER" | "STAFF";
  isActive?: boolean;
}

interface ClientItem {
  id: string;
  name: string;
  archivedAt?: string | null;
}

interface CaseItem {
  id: string;
  title: string;
  caseNumber?: string | null;
  clientId?: string | null;
  status?: string | null;
}

const TYPE_COLOR: Record<string, string> = {
  COURT_SESSION: "var(--sidebar)",
  MEETING: "#2563eb",
  PHONE_CALL: "#d97706",
  DEADLINE: "#dc2626",
  OTHER: "var(--text-3)",
};

function getAppointmentTone(type: string): VDSTone {
  switch (type) {
    case "COURT_SESSION":
      return "teal";
    case "MEETING":
      return "blue";
    case "PHONE_CALL":
      return "gold";
    case "DEADLINE":
      return "red";
    default:
      return "slate";
  }
}

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
  assignedToId: "",
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
  _locale: Locale,
  timeZone = TENANT_TIME_ZONE,
) {
  const date = DateTime.fromISO(value, { setZone: true }).setZone(timeZone);

  if (!date.isValid) return "-";

  return date.setLocale("en-US").toLocaleString({
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  timeZone?: string;
  ariaLabel: string;
  required?: boolean;
  disabled?: boolean;
}

function DateTimePicker({
  value,
  onChange,
  locale,
  timeZone = TENANT_TIME_ZONE,
  ariaLabel,
  disabled = false,
}: DateTimePickerProps) {
  const isRtl = locale === "ar";
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const selectedDate = useMemo(() => {
    if (!value) return null;

    const parsed = DateTime.fromFormat(value, "yyyy-MM-dd'T'HH:mm", {
      zone: timeZone,
    });

    return parsed.isValid ? parsed : null;
  }, [timeZone, value]);

  const [viewMonth, setViewMonth] = useState(() =>
    (selectedDate ?? DateTime.now().setZone(timeZone)).startOf("month"),
  );

  const copy =
    locale === "ar"
      ? {
          placeholder: "اختر التاريخ والوقت",
          previousMonth: "الشهر السابق",
          nextMonth: "الشهر التالي",
          today: "اليوم",
          clear: "مسح",
          done: "تم",
          hour: "الساعة",
          minute: "الدقيقة",
          period: "الفترة",
          weekdays: ["أح", "إث", "ث", "أر", "خ", "ج", "س"],
        }
      : {
          placeholder: "Select date and time",
          previousMonth: "Previous month",
          nextMonth: "Next month",
          today: "Today",
          clear: "Clear",
          done: "Done",
          hour: "Hour",
          minute: "Minute",
          period: "Period",
          weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
        };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedDate) {
      setViewMonth(selectedDate.startOf("month"));
    }
  }, [selectedDate]);

  const updatePopoverPosition = useCallback(() => {
    const button = buttonRef.current;

    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const width = Math.min(360, window.innerWidth - viewportPadding * 2);
    const estimatedHeight = Math.min(
      430,
      window.innerHeight - viewportPadding * 2,
    );
    const availableAbove = rect.top - viewportPadding;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const shouldOpenAbove =
      availableAbove > availableBelow && availableAbove >= 300;

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
    const monthStart = viewMonth.startOf("month");
    const sundayBasedOffset = monthStart.weekday % 7;
    const gridStart = monthStart.minus({ days: sundayBasedOffset });

    return Array.from({ length: 42 }, (_, index) =>
      gridStart.plus({ days: index }),
    );
  }, [viewMonth]);

  const displayValue = selectedDate
    ? `${selectedDate
        .setLocale(locale === "ar" ? "ar-JO" : "en-US")
        .toLocaleString({
          year: "numeric",
          month: "short",
          day: "numeric",
        })} — ${selectedDate.setLocale("en-US").toLocaleString({
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`
    : copy.placeholder;

  const setSelectedDate = (date: DateTime) => {
    const base = selectedDate ?? DateTime.now().setZone(timeZone);
    const next = date.set({
      hour: selectedDate?.hour ?? base.hour ?? 9,
      minute: selectedDate?.minute ?? 0,
      second: 0,
      millisecond: 0,
    });

    onChange(next.toFormat("yyyy-MM-dd'T'HH:mm"));
  };

  const selectedHour24 = selectedDate?.hour ?? 9;
  const selectedHour12 = selectedHour24 % 12 || 12;
  const selectedPeriod = selectedHour24 >= 12 ? "PM" : "AM";

  const updateTime = (part: "hour" | "minute" | "period", rawValue: string) => {
    const base =
      selectedDate ??
      DateTime.now().setZone(timeZone).set({
        second: 0,
        millisecond: 0,
      });

    const currentPeriod = base.hour >= 12 ? "PM" : "AM";
    const next = (() => {
      if (part === "minute") {
        return base.set({ minute: Number(rawValue) });
      }

      if (part === "period") {
        const hour = (base.hour % 12) + (rawValue === "PM" ? 12 : 0);
        return base.set({ hour });
      }

      const hour12 = Number(rawValue);
      const hour = (hour12 % 12) + (currentPeriod === "PM" ? 12 : 0);
      return base.set({ hour });
    })();

    onChange(next.toFormat("yyyy-MM-dd'T'HH:mm"));
    setViewMonth(next.startOf("month"));
  };

  const selectToday = () => {
    const now = DateTime.now().setZone(timeZone);
    const next = now.set({
      hour: selectedDate?.hour ?? 9,
      minute: selectedDate?.minute ?? 0,
      second: 0,
      millisecond: 0,
    });

    onChange(next.toFormat("yyyy-MM-dd'T'HH:mm"));
    setViewMonth(next.startOf("month"));
  };

  const popover =
    open && mounted
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={ariaLabel}
            dir={isRtl ? "rtl" : "ltr"}
            className="date-time-picker-popover overflow-auto rounded-3xl border p-4 shadow-2xl"
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
                  setViewMonth((current) => current.minus({ months: 1 }))
                }
                className="flex h-10 w-10 items-center justify-center rounded-2xl border text-lg font-black"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
                aria-label={copy.previousMonth}
              >
                {isRtl ? "›" : "‹"}
              </button>

              <p className="text-sm font-black">
                {viewMonth
                  .setLocale(locale === "ar" ? "ar-JO" : "en-US")
                  .toFormat("LLLL yyyy")}
              </p>

              <button
                type="button"
                onClick={() =>
                  setViewMonth((current) => current.plus({ months: 1 }))
                }
                className="flex h-10 w-10 items-center justify-center rounded-2xl border text-lg font-black"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
                aria-label={copy.nextMonth}
              >
                {isRtl ? "‹" : "›"}
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {copy.weekdays.map((weekday) => (
                <span
                  key={weekday}
                  className="py-1 text-[11px] font-black"
                  style={{ color: "var(--text-3)" }}
                >
                  {weekday}
                </span>
              ))}

              {calendarDays.map((day) => {
                const isCurrentMonth = day.month === viewMonth.month;
                const isSelected =
                  selectedDate?.toISODate() === day.toISODate();
                const isToday =
                  day.toISODate() ===
                  DateTime.now().setZone(timeZone).toISODate();

                return (
                  <button
                    key={day.toISODate()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
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
                    {day.day}
                  </button>
                );
              })}
            </div>

            <div
              className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border p-3"
              style={{
                borderColor: "var(--border)",
                background: "var(--card)",
              }}
            >
              <label className="space-y-1 text-xs font-black">
                <span style={{ color: "var(--text-3)" }}>{copy.hour}</span>
                <select
                  value={String(selectedHour12)}
                  onChange={(event) => updateTime("hour", event.target.value)}
                  className="input h-11"
                  dir="ltr"
                  aria-label={copy.hour}
                >
                  {Array.from({ length: 12 }, (_, index) => {
                    const hour = index + 1;
                    const value = String(hour);

                    return (
                      <option key={value} value={value}>
                        {String(hour).padStart(2, "0")}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="space-y-1 text-xs font-black">
                <span style={{ color: "var(--text-3)" }}>{copy.minute}</span>
                <select
                  value={String(
                    Math.floor((selectedDate?.minute ?? 0) / 5) * 5,
                  ).padStart(2, "0")}
                  onChange={(event) => updateTime("minute", event.target.value)}
                  className="input h-11"
                  dir="ltr"
                  aria-label={copy.minute}
                >
                  {Array.from({ length: 12 }, (_, index) => {
                    const value = String(index * 5).padStart(2, "0");

                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="space-y-1 text-xs font-black">
                <span style={{ color: "var(--text-3)" }}>{copy.period}</span>
                <select
                  value={selectedPeriod}
                  onChange={(event) => updateTime("period", event.target.value)}
                  className="input h-11"
                  dir="ltr"
                  aria-label={copy.period}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </label>
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
                {copy.clear}
              </button>

              <button
                type="button"
                onClick={selectToday}
                className="btn btn-ghost flex-1"
              >
                {copy.today}
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-primary flex-1"
              >
                {copy.done}
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

      <style jsx global>{`
        .date-time-picker-popover {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .date-time-picker-popover::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
    </>
  );
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
          assignee: "المسؤول",
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
          assignee: "Assignee",
        };
  const appointmentFormCopy =
    locale === "ar"
      ? {
          caseLabel: "القضية",
          noCase: "بدون قضية",
          selectClientFirst: "اختر الموكل أولاً",
          loadingCases: "جارٍ تحميل القضايا...",
          caseLoadError: "تعذر تحميل قضايا الموكل",
          invalidCase: "القضية المحددة لا تتبع الموكل المختار",
          assignee: "المسؤول عن الموعد",
          allAssignees: "جميع المسؤولين",
          myAppointments: "مواعيدي",
        }
      : {
          caseLabel: "Case",
          noCase: "No case",
          selectClientFirst: "Select a client first",
          loadingCases: "Loading cases...",
          caseLoadError: "Could not load the client's cases",
          invalidCase: "The selected case does not belong to the chosen client",
          assignee: "Appointment assignee",
          allAssignees: "All assignees",
          myAppointments: "My appointments",
        };
  const fieldDir = {
    dir: (isRtl ? "rtl" : "ltr") as "rtl" | "ltr",
    style: {
      textAlign: isRtl ? "right" : "left",
      direction: isRtl ? "rtl" : "ltr",
    } as React.CSSProperties,
  };

  const [appts, setAppts] = useState<Appt[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState<TeamMember["role"]>("STAFF");
  const [loadingCases, setLoadingCases] = useState(false);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appt | null>(null);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INIT);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [calendarRange, setCalendarRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const writeAccess = useTenantWriteAccess(locale);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        if (!options?.silent) setLoading(true);

        const [appointmentsRes, clientsRes, teamRes] = await Promise.all([
          fetch(
            `/api/appointments?includeArchivedClients=true${
              calendarRange
                ? `&from=${encodeURIComponent(calendarRange.from)}&to=${encodeURIComponent(calendarRange.to)}`
                : ""
            }`,
          ),
          fetch("/api/clients?limit=100&archive=active"),
          fetch("/api/team?mode=assignees"),
        ]);

        const safeJson = async (response: Response) => {
          if (!response.ok) return { data: [] };

          try {
            return await response.json();
          } catch {
            return { data: [] };
          }
        };

        const [appointmentsData, clientsData, teamData] = await Promise.all([
          safeJson(appointmentsRes),
          safeJson(clientsRes),
          safeJson(teamRes),
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
        const loadedMembers = Array.isArray(teamData.data?.members)
          ? teamData.data.members
          : [];
        const loadedCurrentUserId = String(teamData.data?.currentUserId || "");
        const loadedRole = teamData.data?.currentRole;

        setTeamMembers(loadedMembers);
        setCurrentUserId(loadedCurrentUserId);
        setCurrentRole(
          loadedRole === "ADMIN" || loadedRole === "LAWYER"
            ? loadedRole
            : "STAFF",
        );
        setForm((previous) => ({
          ...previous,
          assignedToId: previous.assignedToId || loadedCurrentUserId,
        }));
      } catch {
        toast.error(a.messages.loadError);

        if (!options?.silent) {
          setAppts([]);
          setClients([]);
          setTeamMembers([]);
        }
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [a.messages.loadError, calendarRange],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const clientId = form.clientId;

    if (!clientId) {
      setCases([]);
      setLoadingCases(false);
      return;
    }

    let cancelled = false;

    async function loadClientCases() {
      try {
        setLoadingCases(true);

        const response = await fetch(
          `/api/cases?clientId=${encodeURIComponent(clientId)}&limit=100&includeArchivedClients=false`,
        );

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload?.message || appointmentFormCopy.caseLoadError,
          );
        }

        const caseItems = Array.isArray(payload?.data?.data)
          ? payload.data.data
          : Array.isArray(payload?.data?.cases)
            ? payload.data.cases
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.cases)
                ? payload.cases
                : [];

        if (!cancelled) {
          setCases(
            caseItems.filter(
              (item: CaseItem) => !item.clientId || item.clientId === clientId,
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setCases([]);
          toast.error(appointmentFormCopy.caseLoadError);
        }
      } finally {
        if (!cancelled) setLoadingCases(false);
      }
    }

    loadClientCases();

    return () => {
      cancelled = true;
    };
  }, [form.clientId, appointmentFormCopy.caseLoadError]);

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
      const matchesAssignee =
        assigneeFilter === "all" ||
        (assigneeFilter === "me"
          ? appt.assignedTo?.id === currentUserId
          : appt.assignedTo?.id === assigneeFilter);

      const matchesSearch =
        !query ||
        appt.title?.toLowerCase().includes(query) ||
        appt.location?.toLowerCase().includes(query) ||
        appt.assignedTo?.name?.toLowerCase().includes(query) ||
        appt.client?.name?.toLowerCase().includes(query) ||
        appt.case?.title?.toLowerCase().includes(query);

      return matchesType && matchesAssignee && matchesSearch;
    });
  }, [appts, assigneeFilter, currentUserId, search, typeFilter]);

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

  const hasActiveFilters =
    Boolean(search.trim()) || typeFilter !== "all" || assigneeFilter !== "all";

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
        editable:
          currentRole !== "STAFF" || appt.assignedTo?.id === currentUserId,
        extendedProps: appt,
      })),
    [currentRole, currentUserId, filteredAppts],
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

  function handleClientChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const clientId = event.target.value;

    setForm((previous) => ({
      ...previous,
      clientId,
      caseId: "",
    }));
  }

  function resetForm() {
    setForm({ ...INIT, assignedToId: currentUserId });
    setEditMode(false);
    setSelectedAppt(null);
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setAssigneeFilter("all");
  }

  async function saveAppointment(event: React.FormEvent) {
    event.preventDefault();

    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || a.messages.saveError);
      return;
    }

    if (!form.title.trim() || !form.startTime || !form.assignedToId) {
      toast.error(a.messages.requiredTitleTime);
      return;
    }

    if (
      form.caseId &&
      !loadingCases &&
      !cases.some((caseItem) => caseItem.id === form.caseId)
    ) {
      toast.error(appointmentFormCopy.invalidCase);
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

    const targetAppointment = appts.find((appt) => appt.id === id);

    if (
      currentRole === "STAFF" &&
      targetAppointment?.assignedTo?.id !== currentUserId
    ) {
      toast.warning(
        locale === "ar"
          ? "يمكنك تعديل المواعيد المسندة إليك فقط"
          : "You can only update appointments assigned to you",
      );
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

    if (currentRole === "STAFF" && appt.assignedTo?.id !== currentUserId) {
      toast.warning(
        locale === "ar"
          ? "يمكنك تعديل المواعيد المسندة إليك فقط"
          : "You can only update appointments assigned to you",
      );
      return;
    }

    setSelectedAppt(appt);
    setForm({
      title: appt.title,
      clientId: appt.client?.id || appt.case?.client?.id || "",
      caseId: appt.case?.id || "",
      startTime: toDateTimeLocal(appt.startTime, tenantTimeZone),
      endTime: toDateTimeLocal(appt.endTime, tenantTimeZone),
      location: appt.location || "",
      type: appt.type || "MEETING",
      description: appt.description || "",
      assignedToId: appt.assignedTo?.id || currentUserId,
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
          className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px_260px]"
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

          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="input h-14"
            {...fieldDir}
            aria-label={appointmentFormCopy.assignee}
          >
            <option value="all">{appointmentFormCopy.allAssignees}</option>
            <option value="me">{appointmentFormCopy.myAppointments}</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
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
          onRangeChange={(range) => {
            setCalendarRange((current) =>
              current?.from === range.from && current?.to === range.to
                ? current
                : range,
            );
          }}
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
      <VDSCard padded={false} className="overflow-hidden text-start">
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

            <VDSBadge tone="teal" className="text-xs">
              {appointmentLog.length} {appointmentLogCopy.count}
            </VDSBadge>
          </div>
        </div>

        {appointmentLog.length === 0 ? (
          <div className="p-5">
            <VDSEmptyState
              icon={<span aria-hidden="true">🗓️</span>}
              title={appointmentLogCopy.emptyTitle}
              description={
                hasActiveFilters
                  ? appointmentLogCopy.emptyFilteredSub
                  : appointmentLogCopy.emptySub
              }
              tone="teal"
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

                  <VDSBadge tone="slate">
                    {group.items.length} {appointmentLogCopy.count}
                  </VDSBadge>
                </div>

                <div className="space-y-3">
                  {group.items.map((appt) => {
                    const archivedAppt = isArchivedAppt(appt);

                    return (
                      <VDSCard
                        key={appt.id}
                        as="article"
                        interactive
                        padded={false}
                        className="overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAppt(appt);
                            setDetailsOpen(true);
                          }}
                          className="w-full p-4 text-start"
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

                                <VDSBadge tone={getAppointmentTone(appt.type)}>
                                  {typeLabels[appt.type] ?? appt.type}
                                </VDSBadge>

                                {archivedAppt ? (
                                  <VDSBadge tone="gold">
                                    {a.labels.archivedClient}
                                  </VDSBadge>
                                ) : null}
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
                                {appt.client?.name ||
                                  appointmentLogCopy.noClient}
                              </span>

                              <span
                                className="truncate"
                                style={{ color: "var(--text-2)" }}
                              >
                                ⚖️{" "}
                                {appt.case?.title || appointmentLogCopy.noCase}
                              </span>

                              <span
                                className="truncate"
                                style={{ color: "var(--text-2)" }}
                              >
                                📍{" "}
                                {appt.location || appointmentLogCopy.noLocation}
                              </span>

                              <span
                                className="truncate"
                                style={{ color: "var(--text-2)" }}
                              >
                                👤 {appointmentLogCopy.assignee}:{" "}
                                {appt.assignedTo?.name || "-"}
                              </span>
                            </div>
                          </div>
                        </button>
                      </VDSCard>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </VDSCard>

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
                onChange={handleClientChange}
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

          <FormField label={appointmentFormCopy.caseLabel}>
            <select
              aria-label={appointmentFormCopy.caseLabel}
              value={form.caseId}
              onChange={f("caseId")}
              disabled={!form.clientId || loadingCases}
              className="input disabled:cursor-not-allowed disabled:opacity-50"
              {...fieldDir}
            >
              <option value="" dir={isRtl ? "rtl" : "ltr"}>
                {!form.clientId
                  ? appointmentFormCopy.selectClientFirst
                  : loadingCases
                    ? appointmentFormCopy.loadingCases
                    : appointmentFormCopy.noCase}
              </option>

              {cases.map((caseItem) => (
                <option
                  key={caseItem.id}
                  value={caseItem.id}
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  {caseItem.caseNumber
                    ? `${caseItem.caseNumber} — ${caseItem.title}`
                    : caseItem.title}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={appointmentFormCopy.assignee} required>
            <select
              value={form.assignedToId}
              onChange={f("assignedToId")}
              disabled={currentRole === "STAFF"}
              className="input disabled:cursor-not-allowed disabled:opacity-70"
              {...fieldDir}
            >
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </FormField>

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
              <DateTimePicker
                ariaLabel={a.form.startTime}
                value={form.startTime}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    startTime: value,
                  }))
                }
                locale={locale}
                timeZone={tenantTimeZone}
                required
              />
            </FormField>

            <FormField label={a.form.endTime}>
              <DateTimePicker
                ariaLabel={a.form.endTime}
                value={form.endTime}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    endTime: value,
                  }))
                }
                locale={locale}
                timeZone={tenantTimeZone}
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
              disabled={saving || loadingCases || selectedClientArchived}
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

                {selectedAppt.assignedTo?.name && (
                  <div>
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--text-3)" }}
                    >
                      {appointmentFormCopy.assignee}
                    </p>
                    <p
                      className="mt-1 text-sm font-bold"
                      style={{ color: "var(--text)" }}
                    >
                      {selectedAppt.assignedTo.name}
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
                disabled={
                  selectedApptArchived ||
                  (currentRole === "STAFF" &&
                    selectedAppt.assignedTo?.id !== currentUserId)
                }
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
                disabled={selectedApptArchived || currentRole === "STAFF"}
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
