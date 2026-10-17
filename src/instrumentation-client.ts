import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  scrubSentryEvent,
  sentryTracesSampleRate,
} from "@/lib/monitoring";

// Browser error monitoring. A no-op without NEXT_PUBLIC_SENTRY_DSN. No
// session replay: screens show clients' personal data.
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: sentryTracesSampleRate(),
    beforeSend: scrubSentryEvent,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
