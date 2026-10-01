function normalizeGeoHeader(value: string | null, decode = false) {
  if (!value) return null;

  try {
    const normalized = decode ? decodeURIComponent(value) : value;
    return normalized.trim().slice(0, 120) || null;
  } catch {
    return value.trim().slice(0, 120) || null;
  }
}

export function getLocationFromHeaders(headers: Headers) {
  return {
    // Vercel's geo headers only: cf-ipcountry is client-controlled here
    // (see client-ip.ts).
    country: normalizeGeoHeader(headers.get("x-vercel-ip-country")),
    city: normalizeGeoHeader(headers.get("x-vercel-ip-city"), true),
  };
}
