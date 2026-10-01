// These routes authenticate machine-to-machine requests inside their handlers.
// Keep this list exact so no sibling API route bypasses the user session check.
const MACHINE_AUTHENTICATED_PATHS = new Set([
  "/api/health",
  "/api/cron/prune-activity",
  "/api/cron/generate-notifications",
  // Polar webhooks carry no session cookie; the handler verifies the
  // standard-webhooks signature against POLAR_WEBHOOK_SECRET.
  "/api/billing/webhooks/polar",
]);

export function isMachineAuthenticatedPath(pathname: string) {
  return MACHINE_AUTHENTICATED_PATHS.has(pathname);
}

// The office ADMIN's data requests (AUDIT_REPORT.md M4): a locked office
// can still download its data and ask for deletion. Exact path + method.
const DATA_REQUEST_ROUTES = new Set([
  "GET /api/data-requests/export",
  "POST /api/data-requests/deletion",
]);

// Routes a locked office (trial over, no paid subscription) can still
// reach: its own account/session endpoints (/api/auth/*, including logout
// and the idle-activity ping), everything billing, a read of the office
// settings so the account settings page renders, and the data requests
// above. Everything else answers 402 SUBSCRIPTION_REQUIRED from
// requireAuth. Data is never deleted.
export function isSubscriptionExemptPath(pathname: string, method: string) {
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return true;
  }

  if (pathname === "/api/billing" || pathname.startsWith("/api/billing/")) {
    return true;
  }

  if (DATA_REQUEST_ROUTES.has(`${method.toUpperCase()} ${pathname}`)) {
    return true;
  }

  return pathname === "/api/settings" && method.toUpperCase() === "GET";
}
