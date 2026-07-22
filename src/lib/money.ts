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
