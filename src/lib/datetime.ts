import { DateTime } from "luxon";
import type { Locale } from "@/lib/i18n";

// Dates and times shown to people. The database stores UTC (Prisma
// DateTime); what users type and read is Asia/Amman wall-clock time, in the
// browser, on the server (emails, notifications) and in PDFs. Every display
// goes through the formatters below; nothing calls getHours, toISOString,
// toLocale*String or a bare Intl.DateTimeFormat to show a date.

export const APP_TIME_ZONE = "Asia/Amman";

type DateInput = string | Date;

function toDate(value: DateInput) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function intlLocale(locale: Locale) {
  return locale === "ar" ? "ar-JO-u-nu-latn" : "en-US";
}

/**
 * Any other date format, still in Amman. For page-specific formats; prefer
 * formatDate / formatTime / formatDateTime when one fits.
 */
export function formatInZone(
  value: DateInput,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
) {
  const date = toDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/** toLocaleDateString's default look ("25‏/10‏/2026"), in Amman. */
export const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

/** "10:00 ص" / "10:00 AM", in Amman time. */
export function formatTime(value: DateInput, locale: Locale) {
  return formatInZone(value, locale, TIME_OPTIONS);
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
  return formatInZone(value, locale, DATE_STYLES[style]);
}

/** Date and time together, for exports and lists. */
export function formatDateTime(value: DateInput, locale: Locale) {
  return formatInZone(value, locale, { ...DATE_STYLES.medium, ...TIME_OPTIONS });
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
