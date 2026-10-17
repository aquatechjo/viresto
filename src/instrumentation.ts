import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  scrubSentryEvent,
  sentryTracesSampleRate,
} from "@/lib/monitoring";

// Server and edge error monitoring (Next.js instrumentation hook). A no-op
// without NEXT_PUBLIC_SENTRY_DSN.
export function register() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: sentryTracesSampleRate(),
    beforeSend: scrubSentryEvent,
  });
}

// Errors Next.js catches itself (Server Components, route handlers that
// throw, the proxy). Handlers wrapped in apiHandler report their own.
export const onRequestError = Sentry.captureRequestError;
