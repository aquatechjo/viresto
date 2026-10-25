import { DateTime } from "luxon";
import type { Locale } from "@/lib/i18n";

// Appointment dates and times. The database stores UTC (Prisma DateTime);
// what users type and read is Asia/Amman wall-clock time. Every display goes
// through the formatters below; components never call getHours,
// toISOString or toLocaleTimeString to show a time.

export const APP_TIME_ZONE = "Asia/Amman";

type DateInput = string | Date;

function toDate(value: DateInput) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function intlLocale(locale: Locale) {
  return locale === "ar" ? "ar-JO-u-nu-latn" : "en-US";
}

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

/** "10:00 ص" / "10:00 AM", in Amman time. */
export function formatTime(value: DateInput, locale: Locale) {
  const date = toDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...TIME_OPTIONS,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

const DATE_STYLES = {
  long: { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  medium: { year: "numeric", month: "short", day: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/** The calendar day in Amman, e.g. "الأحد، 25 تشرين الأول 2026". */
export function formatDate(
  value: DateInput,
  locale: Locale,
  style: keyof typeof DATE_STYLES = "medium",
) {
  const date = toDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...DATE_STYLES[style],
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/** Date and time together, for exports and lists. */
export function formatDateTime(value: DateInput, locale: Locale) {
  const date = toDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...DATE_STYLES.medium,
    ...TIME_OPTIONS,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/**
 * "10:00 – 11:00 ص" / "10:00 – 11:00 AM". Callers render it inside
 * <bdi dir={locale === "ar" ? "rtl" : "ltr"}> so the start stays first.
 */
export function formatTimeRange(
  start: DateInput,
  end: DateInput | null | undefined,
  locale: Locale,
) {
  const startDate = toDate(start);
  if (!startDate) return "-";

  const endDate = end ? toDate(end) : null;
  if (!endDate) return formatTime(startDate, locale);

  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...TIME_OPTIONS,
    timeZone: APP_TIME_ZONE,
  }).formatRange(startDate, endDate);
}

/** "25 تشرين الأول 2026، 10:00–11:00 ص": one appointment slot, for logs. */
export function formatSlot(
  start: DateInput,
  end: DateInput | null | undefined,
  locale: Locale,
) {
  if (end && toDateKey(end) !== toDateKey(start)) {
    return `${formatDateTime(start, locale)} – ${formatDateTime(end, locale)}`;
  }

  const separator = locale === "ar" ? "، " : ", ";
  return `${formatDate(start, locale)}${separator}${formatTimeRange(start, end, locale)}`;
}

/** "yyyy-MM-dd" of the Amman calendar day, for grouping. */
export function toDateKey(value: DateInput) {
  const date = toDate(value);
  if (!date) return "invalid-date";

  return DateTime.fromJSDate(date).setZone(APP_TIME_ZONE).toISODate() ?? "invalid-date";
}

/** UTC instant → "yyyy-MM-ddTHH:mm" Amman wall-clock value for a form field. */
export function toZonedInputValue(value?: DateInput | null) {
  const date = value ? toDate(value) : null;
  if (!date) return "";

  return DateTime.fromJSDate(date)
    .setZone(APP_TIME_ZONE)
    .reconfigure({ locale: "en-US", numberingSystem: "latn" })
    .toFormat("yyyy-MM-dd'T'HH:mm");
}

/** "yyyy-MM-ddTHH:mm" typed in Amman → UTC ISO string for the API. */
export function zonedInputToUtcIso(value?: string | null) {
  if (!value) return undefined;

  const date = DateTime.fromISO(value, { zone: APP_TIME_ZONE });
  if (!date.isValid) return undefined;

  return date.toUTC().toISO() ?? undefined;
}
