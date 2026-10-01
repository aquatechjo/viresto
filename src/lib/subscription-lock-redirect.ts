// AUDIT_REPORT.md L10. A locked office (trial over, no subscription) gets
// 402 SUBSCRIPTION_REQUIRED from every data route (see requireAuth). Pages
// fetch on mount, before SubscriptionGate's access check has redirected
// them, so they used to flash a "failed to load" toast. The dashboard wraps
// window.fetch once (SubscriptionGate): on a page a locked office cannot
// use, that 402 sends the user to billing and the calling page never sees
// the response, so its error handling never runs. Any other 402 (a plan
// feature, the AI quota) and every page allowed while locked are untouched.

export const SUBSCRIPTION_REQUIRED_CODE = "SUBSCRIPTION_REQUIRED";
export const LOCKED_REDIRECT_PATH = "/dashboard/billing?locked=1";

// Pages a locked office can still open. The API enforces the lockout
// server-side; redirects only keep people off pages that would just fail.
const ALLOWED_WHEN_LOCKED = ["/dashboard/billing", "/dashboard/settings"];

export function isAllowedWhenLocked(pathname: string) {
  return ALLOWED_WHEN_LOCKED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function requestUrl(input: RequestInfo | URL, origin: string) {
  const raw = typeof input === "string" || input instanceof URL ? input : input.url;
  try {
    return new URL(raw, origin);
  } catch {
    return null;
  }
}

async function isSubscriptionRequired(response: Response) {
  if (response.status !== 402) return false;
  const body = await response.clone().json().catch(() => null);
  return body?.details?.code === SUBSCRIPTION_REQUIRED_CODE;
}

export function createSubscriptionLockFetch({
  fetch,
  location,
  onLocked,
}: {
  fetch: FetchLike;
  location: { origin: string; pathname: string };
  onLocked: () => void;
}): FetchLike {
  return async (input, init) => {
    const response = await fetch(input, init);
    if (response.status !== 402 || isAllowedWhenLocked(location.pathname)) {
      return response;
    }

    const url = requestUrl(input, location.origin);
    if (!url || url.origin !== location.origin || !url.pathname.startsWith("/api/")) {
      return response;
    }

    if (!(await isSubscriptionRequired(response))) return response;

    onLocked();
    // The page is being replaced; leave its request pending so no error
    // toast or empty state flashes on the way out.
    return new Promise<Response>(() => {});
  };
}

let installed = false;
let lockedHandler: (() => void) | null = null;

/**
 * Wraps window.fetch once per page load. `onLocked` (the latest one wins)
 * performs the redirect; without one, a full navigation to billing is used.
 */
export function installSubscriptionLockRedirect(onLocked: () => void) {
  lockedHandler = onLocked;
  if (installed || typeof window === "undefined") return;
  installed = true;

  let redirecting = false;
  window.fetch = createSubscriptionLockFetch({
    fetch: window.fetch.bind(window),
    location: window.location,
    onLocked: () => {
      if (redirecting) return;
      redirecting = true;
      // Allow another redirect if the user later comes back to a locked page.
      setTimeout(() => {
        redirecting = false;
      }, 2000);
      if (lockedHandler) lockedHandler();
      else window.location.replace(LOCKED_REDIRECT_PATH);
    },
  });
}
