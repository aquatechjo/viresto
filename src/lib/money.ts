import { withLatinDigits } from "@/lib/locale";

export const FILS_PER_JOD = 1000;
export const JOD_DECIMAL_PLACES = 3;
export const MONEY_EPSILON = 1 / (FILS_PER_JOD * 2);
export const MAX_JOD_AMOUNT = 1_000_000_000;

export function roundJod(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * FILS_PER_JOD) / FILS_PER_JOD;
}

export function hasValidJodPrecision(value: number) {
  if (!Number.isFinite(value)) return false;

  const scaled = value * FILS_PER_JOD;
  return Math.abs(scaled - Math.round(scaled)) < 1e-7;
}

export function moneyExceeds(value: number, limit: number) {
  return roundJod(value) > roundJod(limit) + MONEY_EPSILON;
}

export function moneyIsSettled(value: number) {
  return roundJod(value) <= MONEY_EPSILON;
}

export function jodToFils(amountJod: number) {
  return Math.round(roundJod(amountJod) * FILS_PER_JOD);
}

export function filsToJod(amountFils: number | null | undefined) {
  if (!amountFils) return 0;
  return roundJod(amountFils / FILS_PER_JOD);
}

export function formatJodNumber(
  amountJod: number | null | undefined,
  locale = "en-US",
) {
  return roundJod(Number(amountJod || 0)).toLocaleString(
    withLatinDigits(locale),
    {
      minimumFractionDigits: JOD_DECIMAL_PLACES,
      maximumFractionDigits: JOD_DECIMAL_PLACES,
    },
  );
}

export function formatJodFromFils(amountFils: number | null | undefined) {
  return `${formatJodNumber(filsToJod(amountFils))} JOD`;
}

export function formatJodAmount(amountJod: number | null | undefined) {
  return `${formatJodNumber(amountJod)} JOD`;
}

// Display and input for every amount in the app, always with Latin digits:
// formatJOD for the office's own money (invoices, payments, fees, reports),
// formatUSD for Viresto's plan prices. Inside Arabic text, wrap the result
// in <bdi> so RTL ordering stays correct.

const jodFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type MoneyInput = number | string | { toString(): string } | null | undefined;

function toNumber(value: MoneyInput): number {
  const n = Number(value?.toString() ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatJOD(value: MoneyInput): string {
  return `${jodFormatter.format(toNumber(value))} د.أ`;
}

export function formatUSD(value: MoneyInput): string {
  return `$${usdFormatter.format(toNumber(value))}`;
}

/** An amount typed with Arabic or Latin digits ("١٬٢٥٠٫٥", "1,250.5"). */
export function parseAmount(input: string): number {
  const normalized = input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}
