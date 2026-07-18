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
    country: normalizeGeoHeader(
      headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry"),
    ),
    city: normalizeGeoHeader(headers.get("x-vercel-ip-city"), true),
  };
}
