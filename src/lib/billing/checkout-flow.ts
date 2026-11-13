"use client";

// The in-app subscription checkout, without the UI: start a checkout,
// wait for the server to confirm the subscription, and drop stale plan
// data afterwards. The subscription is never activated here: the server
// does it (POST /api/billing/checkout/confirm verifies the checkout with
// Polar and syncs it; the webhook does the same on its own).

import { invalidateCurrentScopeCache } from "@/lib/client-query-cache";

export type CheckoutCycle = "monthly" | "yearly";

export type CheckoutStart =
  | { kind: "checkout"; url: string; checkoutId: string | null }
  | { kind: "updated"; message: string | null }
  | { kind: "portal"; message: string | null }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string | null; code: string | null };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** POST /api/billing/checkout, read into one of the outcomes above. */
export async function requestCheckout(
  planCode: string,
  cycle: CheckoutCycle,
  fetchImpl: FetchLike = fetch,
): Promise<CheckoutStart> {
  let res: Response;
  try {
    res = await fetchImpl("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: planCode, billingCycle: cycle }),
    });
  } catch {
    return { kind: "error", message: null, code: "NETWORK" };
  }

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    details?: { action?: string; code?: string };
    data?: { mode?: string; url?: string; checkoutId?: string; message?: string };
  };

  if (res.status === 401) return { kind: "unauthorized" };
  // The renewal failed: the card is fixed on the existing subscription.
  if (res.status === 409 && json.details?.action === "portal") {
    return { kind: "portal", message: json.message ?? null };
  }
  if (!res.ok || !json.success) {
    return { kind: "error", message: json.message ?? null, code: json.details?.code ?? null };
  }
  if (json.data?.mode === "checkout" && json.data.url) {
    return { kind: "checkout", url: json.data.url, checkoutId: json.data.checkoutId ?? null };
  }
  if (json.data?.mode === "updated") {
    return { kind: "updated", message: json.data.message ?? null };
  }
  return { kind: "error", message: null, code: "UNEXPECTED" };
}

/**
 * Polar answers frame-ancestors 'none' for an origin it does not allow to
 * embed (seen on localhost against the sandbox, 2026-11-13). The browser
 * then shows its own error page in the iframe, fires the iframe's `load`
 * event, and the checkout never sends its "loaded" message, so the embed's
 * create() never resolves. A frame that loaded but stays silent for
 * EMBED_HANDSHAKE_GRACE_MS is taken as refused; EMBED_MAX_WAIT_MS caps the
 * whole wait (slow network, no load event at all).
 */
export const EMBED_MAX_WAIT_MS = 6_000;
export const EMBED_HANDSHAKE_GRACE_MS = 2_000;

export type EmbedOpenResult<T> =
  | { kind: "loaded"; embed: T }
  | { kind: "refused"; reason: "frame-error" | "no-handshake" | "timeout" };

function embedBase(checkoutUrl: string) {
  return checkoutUrl.split("?")[0];
}

/**
 * Opens the embedded checkout, hidden until Polar says it loaded, so the
 * page's own "opening" notice shows meanwhile instead of Polar's spinner or
 * the browser's blocked-frame page. On "refused" everything the embed put
 * on the page is already removed.
 */
export function openEmbedWithin<T>(options: {
  create: () => Promise<T>;
  checkoutUrl: string;
  doc?: Document;
  maxWaitMs?: number;
  handshakeGraceMs?: number;
}): Promise<EmbedOpenResult<T>> {
  const doc = options.doc ?? document;
  const maxWaitMs = options.maxWaitMs ?? EMBED_MAX_WAIT_MS;
  const graceMs = options.handshakeGraceMs ?? EMBED_HANDSHAKE_GRACE_MS;
  const base = embedBase(options.checkoutUrl);

  // create() appends the iframe and spinner synchronously, before it waits.
  const load = options.create();
  const frame = Array.from(doc.querySelectorAll("iframe")).find((f) =>
    (f.getAttribute("src") ?? "").startsWith(base),
  ) as HTMLIFrameElement | undefined;
  const spinners = Array.from(doc.querySelectorAll(".polar-loader-spinner")).map(
    (s) => (s.parentElement ?? s) as HTMLElement,
  );
  if (frame) frame.style.visibility = "hidden";
  // Hidden, not removed: the embed removes its spinner itself once loaded.
  spinners.forEach((s) => (s.style.display = "none"));

  return new Promise<EmbedOpenResult<T>>((resolve, reject) => {
    let settled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = (result: EmbedOpenResult<T> | Error) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      frame?.removeEventListener("load", onFrameLoad);
      frame?.removeEventListener("error", onFrameError);
      if (result instanceof Error) {
        removeEmbedLeftovers(options.checkoutUrl, doc);
        reject(result);
      } else if (result.kind === "refused") {
        removeEmbedLeftovers(options.checkoutUrl, doc);
        resolve(result);
      } else {
        if (frame) frame.style.visibility = "";
        resolve(result);
      }
    };
    const onFrameLoad = () => {
      timers.push(setTimeout(() => finish({ kind: "refused", reason: "no-handshake" }), graceMs));
    };
    const onFrameError = () => finish({ kind: "refused", reason: "frame-error" });
    frame?.addEventListener("load", onFrameLoad);
    frame?.addEventListener("error", onFrameError);
    timers.push(setTimeout(() => finish({ kind: "refused", reason: "timeout" }), maxWaitMs));
    load.then(
      (embed) => finish({ kind: "loaded", embed }),
      (error: unknown) => finish(error instanceof Error ? error : new Error(String(error))),
    );
  });
}

/**
 * Removes what @polar-sh/checkout/embed put on the page for a checkout that
 * never loaded: its iframe, the spinner overlay, and the body scroll lock.
 */
export function removeEmbedLeftovers(checkoutUrl: string, doc: Document = document) {
  const base = embedBase(checkoutUrl);
  doc.querySelectorAll("iframe").forEach((frame) => {
    if ((frame.getAttribute("src") ?? "").startsWith(base)) frame.remove();
  });
  doc.querySelectorAll(".polar-loader-spinner").forEach((spinner) => {
    (spinner.parentElement ?? spinner).remove();
  });
  doc.body.classList.remove("polar-no-scroll");
}

export type ActivationCheck = "active" | "pending" | "in_demo";
export type ActivationOutcome = "active" | "timeout" | "in_demo" | "aborted";

/**
 * Polls `check` until the subscription is active, for up to `timeoutMs`
 * (then "timeout": the payment may still be processing, never an error).
 * A check that throws counts as "pending".
 */
export async function waitForActivation(options: {
  check: () => Promise<ActivationCheck>;
  timeoutMs?: number;
  intervalMs?: number;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ActivationOutcome> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = now() + timeoutMs;

  for (;;) {
    if (options.signal?.aborted) return "aborted";
    const result = await options.check().catch(() => "pending" as const);
    if (options.signal?.aborted) return "aborted";
    if (result === "active" || result === "in_demo") return result;
    if (now() + intervalMs > deadline) return "timeout";
    await sleep(intervalMs);
  }
}

/**
 * After a subscription is activated, changed or cancelled: drop every
 * cached response of this user and office (the dashboard's plan card,
 * seats, limits), so no page shows the old plan, and refresh the access
 * state the banners read.
 */
export async function onSubscriptionChanged(refreshAccess: () => Promise<unknown>) {
  invalidateCurrentScopeCache();
  await refreshAccess();
}

/** The trial's days left and how much of it has passed (0..1). */
export function trialProgress(
  trialEndsAt: string | Date | null | undefined,
  totalDays: number,
  now: Date = new Date(),
): { daysLeft: number; elapsed: number } | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  const msLeft = end - now.getTime();
  const daysLeft = msLeft <= 0 ? 0 : Math.ceil(msLeft / 86_400_000);
  const elapsed = Math.min(1, Math.max(0, 1 - msLeft / (totalDays * 86_400_000)));
  return { daysLeft: Math.min(daysLeft, totalDays), elapsed };
}

export type BillingView = "trial" | "active" | "past_due" | "expired";

/** Which state the subscriptions page shows. */
export function billingView(input: {
  accessState: "PAID" | "TRIAL" | "LOCKED" | null | undefined;
  paymentFailed?: boolean | null;
  subscriptionStatus?: string | null;
}): BillingView {
  if (input.subscriptionStatus === "PAST_DUE" || input.paymentFailed) return "past_due";
  if (input.accessState === "PAID") return "active";
  if (input.accessState === "TRIAL") return "trial";
  return "expired";
}
