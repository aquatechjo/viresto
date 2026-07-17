const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

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
    connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://api.openai.com https://*.upstash.io https://*.vercel-insights.com https://*.vercel-analytics.com ${TURNSTILE_ORIGIN};
    frame-src 'self' https://res.cloudinary.com ${TURNSTILE_ORIGIN};
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
