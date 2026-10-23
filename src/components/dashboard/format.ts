import { DateTime } from "luxon";
import type { Locale } from "@/lib/i18n";
import { intlLocale } from "./dashboard-text";

// Dates on the dashboard: Latin digits, in the office time zone, relative
// to the moment the data was loaded (never the render clock, so server
// and browser agree).

export function formatTime(iso: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatShortDate(iso: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatLongDate(iso: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Calendar days from `fromIso` to `iso` in the office zone (0 = same day). */
export function dayDiff(iso: string, fromIso: string, timeZone: string) {
  const day = DateTime.fromISO(iso).setZone(timeZone).startOf("day");
  const from = DateTime.fromISO(fromIso).setZone(timeZone).startOf("day");
  return Math.round(day.diff(from, "days").days);
}

export function formatWeekday(dayKey: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(DateTime.fromISO(dayKey, { zone: timeZone }).set({ hour: 12 }).toJSDate());
}

export function formatMonth(monthKey: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "UTC" }).format(
    new Date(`${monthKey}-15T00:00:00Z`),
  );
}

export function formatRelative(iso: string, nowIso: string, locale: Locale) {
  const seconds = Math.round((new Date(iso).getTime() - new Date(nowIso).getTime()) / 1000);
  const format = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });

  if (Math.abs(seconds) < 60) return format.format(0, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return format.format(days, "day");
  return format.format(Math.round(days / 30), "month");
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Axis ticks: "12.5K". */
export function formatCompact(value: number) {
  return compact.format(value);
}
