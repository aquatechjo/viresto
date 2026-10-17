import * as Sentry from "@sentry/nextjs";
import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// Error monitoring (AUDIT_REPORT.md H3). Sentry is off unless
// NEXT_PUBLIC_SENTRY_DSN is set, so local runs and tests send nothing.
//
// Offices store clients' personal data, so events carry no request bodies,
// cookies, auth headers, IPs or Prisma query arguments; ids only, as in the
// existing [polar-webhook] log lines.

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;

export const SENTRY_ENVIRONMENT =
  process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV;

export function sentryTracesSampleRate() {
  const rate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0");
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0;
}

const REDACTED = "[redacted]";

// Prisma validation errors print the whole query, values included.
const QUERY_ECHOING_ERRORS = new Set(["PrismaClientValidationError"]);

export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;

    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (/^(cookie|authorization|x-forwarded-for|x-real-ip)$/i.test(name)) {
          event.request.headers[name] = REDACTED;
        }
      }
    }
  }

  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.type && QUERY_ECHOING_ERRORS.has(exception.type)) {
      exception.value = REDACTED;
    }
  }

  return event;
}

/** An unexpected error a handler caught and turned into a 5xx. */
export function reportError(error: unknown, tags: Record<string, string> = {}) {
  Sentry.captureException(error, { tags });
}

type IssueLevel = "error" | "warning";

/**
 * A billing problem that is logged rather than thrown (webhook and
 * reconciliation failures). Tagged area=billing so one Sentry alert rule
 * can email on all of them; grouped per source and reason.
 */
export function reportBillingIssue(
  source: "polar-webhook" | "polar-reconcile",
  reason: string,
  level: IssueLevel,
  details: Record<string, unknown> = {},
) {
  Sentry.captureMessage(`[${source}] ${reason}`, {
    level,
    tags: { area: "billing", source, reason },
    extra: details,
    fingerprint: [source, reason],
  });
}
