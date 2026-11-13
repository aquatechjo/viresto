const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

// Browser error reports (src/instrumentation-client.ts). Sentry DSN hosts
// look like o123.ingest.sentry.io, o123.ingest.us.sentry.io or
// o123.ingest.de.sentry.io.
const SENTRY_INGEST_ORIGINS =
  "https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io";

// Polar's embedded checkout (@polar-sh/checkout/embed) is an iframe on
// the checkout URL: polar.sh in production, sandbox.polar.sh on dev. Frames
// only; its own script ships in our bundle.
const POLAR_CHECKOUT_ORIGINS = "https://polar.sh https://buy.polar.sh https://sandbox.polar.sh";

export function createCspNonce() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function buildContentSecurityPolicy(nonce: string, isDev: boolean) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new Error("Invalid CSP nonce");
  }

  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    ...(isDev ? ["'unsafe-eval'"] : []),
    TURNSTILE_ORIGIN,
  ].join(" ");

  return `
    default-src 'self';
    worker-src 'self' blob:;
    script-src ${scriptSources};
    script-src-elem ${scriptSources};
    script-src-attr 'none';
    img-src 'self' data: blob: https://res.cloudinary.com;
    connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://*.upstash.io https://*.vercel-insights.com https://*.vercel-analytics.com ${SENTRY_INGEST_ORIGINS} ${TURNSTILE_ORIGIN};
    frame-src 'self' https://res.cloudinary.com ${TURNSTILE_ORIGIN} ${POLAR_CHECKOUT_ORIGINS};
    frame-ancestors 'none';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' data: https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `
    .replace(/\s{2,}/g, " ")
    .trim();
}
