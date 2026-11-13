"use client";

// The in-app subscription checkout, without the UI: start a checkout,
// wait for the server to confirm the subscription, and drop stale plan
// data afterwards. The subscription is never activated here: the server
// does it (POST /api/billing/checkout/confirm verifies the checkout with
// Polar and syncs it; the webhook does the same on its own).

import { invalidateCurrentScopeCache } from "@/lib/client-query-cache";
import { embedOutcomeReport, type EmbedRefusalReason } from "@/lib/billing/embed-outcome";

export type { EmbedRefusalReason };

export type CheckoutCycle = "monthly" | "yearly";

export type CheckoutStart =
  | { kind: "checkout"; url: string; checkoutId: string | null; embedOrigin: string | null }
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
    data?: { mode?: string; url?: string; checkoutId?: string; embedOrigin?: string; message?: string };
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
    return {
      kind: "checkout",
      url: json.data.url,
      checkoutId: json.data.checkoutId ?? null,
      embedOrigin: json.data.embedOrigin ?? null,
    };
  }
  if (json.data?.mode === "updated") {
    return { kind: "updated", message: json.data.message ?? null };
  }
  return { kind: "error", message: null, code: "UNEXPECTED" };
}

/**
 * How long the embedded checkout may stay silent before it is opened as a
 * page instead. Proof of success is Polar's own "loaded" message (the
 * embed's create() resolves on it); a slow checkout is waited for, never
 * taken as refused. The iframe's `load` event proves nothing: the browser
 * fires it for its own blocked-frame page too.
 *
 * Fallback happens only on:
 *   - a definite refusal: the checkout was created for another origin than
 *     this page's (Polar would answer frame-ancestors), our own CSP blocked
 *     the frame (securitypolicyviolation), or the iframe errored;
 *   - nothing at all from Polar within EMBED_MAX_WAIT_MS while the tab is
 *     visible (a hidden tab's timers are throttled: decided once it shows).
 * Any message from the checkout means it is running: keep waiting.
 */
export const EMBED_MAX_WAIT_MS = 12_000;

/** The origins @polar-sh/checkout/embed accepts messages from. */
const POLAR_ORIGINS = ["https://polar.sh", "https://sandbox.polar.sh"];
const POLAR_MESSAGE_TYPE = "POLAR_CHECKOUT";

export type EmbedOpenResult<T> =
  | { kind: "loaded"; embed: T; elapsedMs: number }
  | { kind: "refused"; reason: EmbedRefusalReason; elapsedMs: number };

type EventSource = Pick<EventTarget, "addEventListener" | "removeEventListener">;
type EmbedWindow = EventSource & { location: { origin: string } };

function embedBase(checkoutUrl: string) {
  return checkoutUrl.split("?")[0];
}

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Our CSP blocked a frame of this checkout's origin. */
function isCheckoutFrameViolation(event: Event, checkoutOrigin: string | null) {
  const v = event as SecurityPolicyViolationEvent;
  const directive = v.effectiveDirective || v.violatedDirective || "";
  if (!/^(frame-src|child-src|default-src)/.test(directive)) return false;
  const blocked = v.blockedURI || "";
  return Boolean(checkoutOrigin) && (blocked === checkoutOrigin || blocked.startsWith(`${checkoutOrigin}/`));
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
  /** The origin the server created the checkout for (null: not known). */
  embedOrigin?: string | null;
  doc?: Document;
  win?: EmbedWindow;
  maxWaitMs?: number;
  now?: () => number;
}): Promise<EmbedOpenResult<T>> {
  const doc = options.doc ?? document;
  const win: EmbedWindow = options.win ?? window;
  const maxWaitMs = options.maxWaitMs ?? EMBED_MAX_WAIT_MS;
  const now = options.now ?? Date.now;
  const base = embedBase(options.checkoutUrl);
  const checkoutOrigin = originOf(options.checkoutUrl);
  const started = now();
  const elapsed = () => now() - started;

  // The embed sends this page's origin; Polar frames the checkout only for
  // the one it was created with. Known to fail: do not even try.
  if (options.embedOrigin && options.embedOrigin !== win.location.origin) {
    return Promise.resolve({ kind: "refused", reason: "origin-mismatch", elapsedMs: 0 });
  }

  return new Promise<EmbedOpenResult<T>>((resolve, reject) => {
    let settled = false;
    let heardFromCheckout = false;
    // Set once create() has run; read by cleanup, which can run before.
    const handles: { frame?: HTMLIFrameElement; deadline?: ReturnType<typeof setTimeout> } = {};

    const onViolation = (event: Event) => {
      if (isCheckoutFrameViolation(event, checkoutOrigin)) finish("csp");
    };
    const onMessage = (event: Event) => {
      const { origin, data } = event as MessageEvent;
      if (POLAR_ORIGINS.includes(origin) && data?.type === POLAR_MESSAGE_TYPE) heardFromCheckout = true;
    };
    const onFrameError = () => finish("frame-error");
    const onVisibility = () => {
      if (doc.visibilityState !== "hidden") {
        doc.removeEventListener("visibilitychange", onVisibility);
        onDeadline();
      }
    };
    function onDeadline() {
      if (settled || heardFromCheckout) return;
      if (doc.visibilityState === "hidden") {
        doc.addEventListener("visibilitychange", onVisibility);
        return;
      }
      finish("timeout");
    }

    function cleanup() {
      if (handles.deadline) clearTimeout(handles.deadline);
      doc.removeEventListener("securitypolicyviolation", onViolation);
      doc.removeEventListener("visibilitychange", onVisibility);
      win.removeEventListener("message", onMessage);
      handles.frame?.removeEventListener("error", onFrameError);
    }

    function finish(outcome: EmbedRefusalReason | { embed: T } | Error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (outcome instanceof Error) {
        removeEmbedLeftovers(options.checkoutUrl, doc);
        reject(outcome);
      } else if (typeof outcome === "string") {
        removeEmbedLeftovers(options.checkoutUrl, doc);
        resolve({ kind: "refused", reason: outcome, elapsedMs: elapsed() });
      } else {
        if (handles.frame) handles.frame.style.visibility = "";
        resolve({ kind: "loaded", embed: outcome.embed, elapsedMs: elapsed() });
      }
    }

    // Listening before the frame exists: a violation can be reported early.
    doc.addEventListener("securitypolicyviolation", onViolation);
    win.addEventListener("message", onMessage);

    let load: Promise<T>;
    try {
      // create() appends the iframe and spinner synchronously, before it waits.
      load = options.create();
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    const frame = Array.from(doc.querySelectorAll("iframe")).find((f) =>
      (f.getAttribute("src") ?? "").startsWith(base),
    ) as HTMLIFrameElement | undefined;
    const spinners = Array.from(doc.querySelectorAll(".polar-loader-spinner")).map(
      (s) => (s.parentElement ?? s) as HTMLElement,
    );
    if (frame) frame.style.visibility = "hidden";
    // Hidden, not removed: the embed removes its spinner itself once loaded.
    spinners.forEach((s) => (s.style.display = "none"));

    handles.frame = frame;
    frame?.addEventListener("error", onFrameError);
    handles.deadline = setTimeout(onDeadline, maxWaitMs);
    load.then(
      (embed) => finish({ embed }),
      (error: unknown) => finish(error instanceof Error ? error : new Error(String(error))),
    );
  });
}

/**
 * Tells the server how the checkout opened, for the Vercel logs. Never
 * throws or delays the purchase; keepalive lets it finish while the page
 * leaves for the checkout.
 */
export function reportEmbedOutcome(
  result: { kind: "loaded" } | { kind: "refused"; reason: EmbedRefusalReason },
  elapsedMs: number,
  fetchImpl: FetchLike = fetch,
): void {
  try {
    void fetchImpl("/api/billing/checkout/embed-outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(embedOutcomeReport(result, elapsedMs)),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Logging only.
  }
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
