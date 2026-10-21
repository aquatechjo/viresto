// Wait time for a rate-limited code request, shared by the API (which
// returns retryAfterSeconds) and the pages (which word it). No server-only
// imports: client components use it too.
//
// The text says only "you asked for several codes"; it is the same whether
// or not an account exists, since the limits run before any account lookup.

type Locale = "ar" | "en";

export function retryAfterSeconds(resetAt: number, now = Date.now()) {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function waitMinutes(seconds: number) {
  return Math.max(1, Math.ceil(seconds / 60));
}

// Arabic counted noun: 1 دقيقة، 2 دقيقتين، 3–10 دقائق، 11+ دقيقة.
function arabicMinutes(minutes: number) {
  if (minutes === 1) return "دقيقة";
  if (minutes === 2) return "دقيقتين";
  if (minutes <= 10) return `${minutes} دقائق`;
  return `${minutes} دقيقة`;
}

export function codeRateLimitMessage(seconds: number, locale: Locale = "ar") {
  const minutes = waitMinutes(seconds);

  if (locale === "en") {
    return `You requested several codes in a short time. Wait about ${minutes} ${
      minutes === 1 ? "minute" : "minutes"
    } and try again.`;
  }

  return `طلبت عدة رموز خلال وقت قصير. انتظر حوالي ${arabicMinutes(minutes)} ثم حاول مرة أخرى.`;
}

// Reads retryAfterSeconds from a 429 body; null when the response is not a
// rate limit or carries no usable value.
export function readRetryAfterSeconds(status: number, data: unknown) {
  if (status !== 429 || !data || typeof data !== "object") return null;

  const value = (data as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : null;
}
