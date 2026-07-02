export const FILS_PER_JOD = 1000;

export function jodToFils(amountJod: number) {
  return Math.round(amountJod * FILS_PER_JOD);
}

export function filsToJod(amountFils: number | null | undefined) {
  if (!amountFils) return 0;
  return amountFils / FILS_PER_JOD;
}

export function formatJodFromFils(amountFils: number | null | undefined) {
  const amountJod = filsToJod(amountFils);

  return `${amountJod.toLocaleString("en-US", {
    maximumFractionDigits: 3,
  })} JOD`;
}

export function formatJodAmount(amountJod: number | null | undefined) {
  if (!amountJod) return "0 JOD";

  return `${amountJod.toLocaleString("en-US", {
    maximumFractionDigits: 3,
  })} JOD`;
}