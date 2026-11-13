// How the checkout opened, reported by the billing page so it shows up in
// the Vercel logs: embedded, or opened as a page because Polar refused the
// frame (fallback-refused) or nothing arrived in time (fallback-timeout).
// Only these fixed words and a number: no tokens, emails or URLs.

export type EmbedOutcome = "embedded" | "fallback-refused" | "fallback-timeout";

export type EmbedRefusalReason = "origin-mismatch" | "csp" | "frame-error" | "timeout";

export type EmbedOutcomeReport = {
  outcome: EmbedOutcome;
  reason: "loaded" | EmbedRefusalReason;
  elapsedMs: number;
};

const OUTCOMES: readonly EmbedOutcome[] = ["embedded", "fallback-refused", "fallback-timeout"];
const REASONS: readonly EmbedOutcomeReport["reason"][] = [
  "loaded",
  "origin-mismatch",
  "csp",
  "frame-error",
  "timeout",
];
const MAX_ELAPSED_MS = 10 * 60_000;

/** The report for a finished embed attempt. */
export function embedOutcomeReport(
  result: { kind: "loaded" } | { kind: "refused"; reason: EmbedRefusalReason },
  elapsedMs: number,
): EmbedOutcomeReport {
  const elapsed = Math.max(0, Math.round(elapsedMs));
  if (result.kind === "loaded") return { outcome: "embedded", reason: "loaded", elapsedMs: elapsed };
  return {
    outcome: result.reason === "timeout" ? "fallback-timeout" : "fallback-refused",
    reason: result.reason,
    elapsedMs: elapsed,
  };
}

/** A posted report, or null when anything in it is not one of ours. */
export function parseEmbedOutcomeReport(body: unknown): EmbedOutcomeReport | null {
  if (!body || typeof body !== "object") return null;
  const { outcome, reason, elapsedMs } = body as Record<string, unknown>;
  if (!OUTCOMES.includes(outcome as EmbedOutcome)) return null;
  if (!REASONS.includes(reason as EmbedOutcomeReport["reason"])) return null;
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  // The outcome must match its reason.
  const expected =
    reason === "loaded" ? "embedded" : reason === "timeout" ? "fallback-timeout" : "fallback-refused";
  if (outcome !== expected) return null;
  return {
    outcome: outcome as EmbedOutcome,
    reason: reason as EmbedOutcomeReport["reason"],
    elapsedMs: Math.min(Math.round(elapsedMs), MAX_ELAPSED_MS),
  };
}

/** The log line. */
export function embedOutcomeLogLine(report: EmbedOutcomeReport, tenantId: string): string {
  return `[polar-checkout] embed_outcome=${report.outcome} reason=${report.reason} elapsed_ms=${report.elapsedMs} tenant=${tenantId}`;
}
