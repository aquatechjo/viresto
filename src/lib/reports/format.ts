// Formatters for printed reports: one place for how money, dates, phone
// numbers and identifiers read on paper. Dates go through datetime.ts
// (Amman time, Latin digits) and money through money.ts (formatJOD), the
// same as the app.

import { formatDate, formatDateTime, formatTime, toDateKey } from "@/lib/datetime";
import { filsToJod, formatJOD, jodToFils } from "@/lib/money";
import { formatPhoneForDisplay } from "@/lib/phone";

type DateInput = string | Date;
type MoneyInput = number | string | { toString(): string } | null | undefined;

/** What an empty value shows on paper. */
export const REPORT_EMPTY = "—";

/** True for null, undefined and strings that are empty after trimming. */
export function isBlank(value: unknown): value is null | undefined | "" {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

/** The value, trimmed, or the empty mark. */
export function textOrEmpty(value: string | null | undefined): string {
  return isBlank(value) ? REPORT_EMPTY : value.trim();
}

export function reportMoney(value: MoneyInput): string {
  return formatJOD(value ?? 0);
}

/** Sums money exactly, in fils: 0.1 + 0.2 is 0.3. */
export function sumMoney(values: MoneyInput[]): number {
  const fils = values.reduce<number>((total, value) => {
    const amount = Number(value?.toString() ?? 0);
    return total + (Number.isFinite(amount) ? jodToFils(amount) : 0);
  }, 0);
  return filsToJod(fils);
}

/** "10 تشرين الثاني 2026", in Amman. */
export function reportDate(value: DateInput | null | undefined): string {
  return value ? formatDate(value, "ar") : REPORT_EMPTY;
}

/** "10:00 ص", in Amman. */
export function reportTime(value: DateInput | null | undefined): string {
  return value ? formatTime(value, "ar") : REPORT_EMPTY;
}

export function reportDateTime(value: DateInput | null | undefined): string {
  return value ? formatDateTime(value, "ar") : REPORT_EMPTY;
}

/** "079 123 4567" for a Jordanian number, as in the app. */
export function reportPhone(value: string | null | undefined): string {
  const shown = formatPhoneForDisplay(value);
  return shown || REPORT_EMPTY;
}

export type MaskOptions = {
  /** Show the whole value (the user chose to). */
  reveal?: boolean;
  /** Digits kept at the start and the end. */
  keepStart?: number;
  keepEnd?: number;
};

/**
 * A national ID with its middle hidden: "9861234567" → "986****567".
 * Too short to hide anything safely → all stars.
 */
export function maskNationalId(value: string | null | undefined, options: MaskOptions = {}): string {
  if (isBlank(value)) return REPORT_EMPTY;
  const clean = value.trim();
  if (options.reveal) return clean;

  const keepStart = options.keepStart ?? 3;
  const keepEnd = options.keepEnd ?? 3;
  const hidden = clean.length - keepStart - keepEnd;
  if (hidden < 3) return "*".repeat(clean.length);

  return `${clean.slice(0, keepStart)}${"*".repeat(hidden)}${clean.slice(clean.length - keepEnd)}`;
}

/** "yyyyMMdd" of the Amman calendar day, for report numbers. */
export function reportDateStamp(value: DateInput): string {
  return toDateKey(value).replace(/-/g, "");
}
