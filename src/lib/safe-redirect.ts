export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

const MAX_NEXT_LENGTH = 2048;
const PARSE_BASE = "http://viresto.invalid";

// Whitespace and control characters: browsers strip or ignore some of them
// when resolving URLs (e.g. " //evil.example" or "/\t/evil.example"), so any
// occurrence is rejected outright rather than normalised.
const UNSAFE_CHARS = /[\s\u0000-\u001F\u007F]/;

// Paths it makes no sense to return to after signing in.
const DISALLOWED_PATHS = /^\/(login|register|api)(\/|$)/i;

function isSafeLayer(value: string) {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !UNSAFE_CHARS.test(value)
  );
}

/**
 * Validates a post-login `next` target. Only same-origin relative paths
 * that start with a single "/" are accepted; anything else (absolute or
 * protocol-relative URLs, backslashes, schemes, whitespace/control
 * characters, and percent-encoded variants of those) falls back to
 * /dashboard. Guards against open redirects via /login?next=...
 */
export function safeNextPath(
  input: unknown,
  fallback: string = DEFAULT_POST_LOGIN_PATH,
): string {
  if (typeof input !== "string") return fallback;
  if (input.length === 0 || input.length > MAX_NEXT_LENGTH) return fallback;

  // Check the raw value and every percent-decoded layer, so "%2F%2F",
  // "%5C" and double-encoded forms can't smuggle "//" or "\" past us.
  let layer = input;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!isSafeLayer(layer)) return fallback;

    let decoded: string;

    try {
      decoded = decodeURIComponent(layer);
    } catch {
      return fallback;
    }

    if (decoded === layer) break;
    layer = decoded;

    if (depth === 4) return fallback;
  }

  let url: URL;

  try {
    url = new URL(input, PARSE_BASE);
  } catch {
    return fallback;
  }

  if (url.origin !== PARSE_BASE) return fallback;
  if (DISALLOWED_PATHS.test(url.pathname)) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
