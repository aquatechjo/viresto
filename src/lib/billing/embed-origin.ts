// Which origin Polar may embed the checkout in.
//
// @polar-sh/checkout/embed sends the page's own window.location.origin as
// embed_origin, and Polar refuses to frame the checkout (frame-ancestors)
// unless it equals the embedOrigin the checkout was created with. So the
// checkout must be created for the origin the admin is actually on.
//
// Production is served on www.virestojo.com, and Vercel 308-redirects the
// apex to www before the app sees the request. Should a request still come
// from the apex (or from www while APP_URL names the apex), its twin is
// accepted too. Any other origin gets APP_URL's: never an arbitrary one.

export type EmbedOriginSource = "request" | "app_url";

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** APP_URL's origin and its apex/www twin. */
export function allowedEmbedOrigins(appUrl: string): string[] {
  const app = originOf(appUrl);
  if (!app) return [];
  const url = new URL(app);
  const host = url.hostname;
  // No twin for localhost, IPs or single-label hosts.
  if (!host.includes(".") || /^[\d.]+$/.test(host)) return [app];
  const twinHost = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
  return [app, `${url.protocol}//${twinHost}${url.port ? `:${url.port}` : ""}`];
}

/**
 * The embed origin for a checkout requested from `requestOrigin` (the
 * request's Origin header, already checked same-origin by the route).
 */
export function resolveEmbedOrigin(
  requestOrigin: string | null | undefined,
  appUrl: string,
): { origin: string; source: EmbedOriginSource } {
  const allowed = allowedEmbedOrigins(appUrl);
  const fromRequest = originOf(requestOrigin);
  if (fromRequest && allowed.includes(fromRequest)) {
    return { origin: fromRequest, source: "request" };
  }
  return { origin: allowed[0] ?? appUrl.replace(/\/$/, ""), source: "app_url" };
}
