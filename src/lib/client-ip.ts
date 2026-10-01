// The client's IP, for rate limiting and audit logs.
//
// Viresto runs on Vercel, whose edge sets x-real-ip and x-forwarded-for
// from the actual connection and overwrites any values the client sends.
// Cloudflare headers (cf-connecting-ip, cf-ipcountry) are NOT set by
// anything in front of this app, so a client can put any value there:
// trusting them let every request pick its own rate-limit bucket. Never
// read them; only change this if the app is ever proxied through Cloudflare
// with origin access locked to Cloudflare.
export function getClientIp(request: { headers: Headers }): string | null {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
