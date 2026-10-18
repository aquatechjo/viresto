// These routes authenticate machine-to-machine requests inside their handlers.
// Keep this list exact so no sibling API route bypasses the user session check.
const MACHINE_AUTHENTICATED_PATHS = new Set([
  "/api/health",
  "/api/cron/prune-activity",
  "/api/cron/generate-notifications",
  "/api/cron/reconcile-billing",
  // Polar webhooks carry no session cookie; the handler verifies the
  // standard-webhooks signature against POLAR_WEBHOOK_SECRET.
  "/api/billing/webhooks/polar",
]);

export function isMachineAuthenticatedPath(pathname: string) {
  return MACHINE_AUTHENTICATED_PATHS.has(pathname);
}

// The office ADMIN's data requests (AUDIT_REPORT.md M4): a locked office
// can still download its data and document files, and ask for deletion.
// Exact path + method.
const DATA_REQUEST_ROUTES = new Set([
  "GET /api/data-requests/export",
  "POST /api/data-requests/deletion",
  "GET /api/data-requests/documents",
]);
// GET /api/data-requests/documents/<id>: one segment, no further path.
const DATA_REQUEST_DOCUMENT_FILE = /^\/api\/data-requests\/documents\/[^/]+$/;

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

  if (method.toUpperCase() === "GET" && DATA_REQUEST_DOCUMENT_FILE.test(pathname)) {
    return true;
  }

  return pathname === "/api/settings" && method.toUpperCase() === "GET";
}

// Writes a read-only seat (more active users than the plan allows, see
// tenant-seats.ts) can still make: its own account and session (including
// logout and the idle-activity ping), billing (so an admin can upgrade),
// marking its notifications read, and the office data requests. Team
// member deactivation opts in inside its own handler.
export function isSeatLimitExemptPath(pathname: string, method: string) {
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return true;
  }

  if (pathname === "/api/billing" || pathname.startsWith("/api/billing/")) {
    return true;
  }

  if (pathname.startsWith("/api/notifications/")) {
    return true;
  }

  return DATA_REQUEST_ROUTES.has(`${method.toUpperCase()} ${pathname}`);
}

// Routes a demo office (src/lib/demo) may not use: everything that sends
// email, touches billing or Polar, or changes the account or its security.
// The sandbox user is a stand-in for the real one, so these belong to the
// real office only. Reading the access state stays allowed (the dashboard
// gate and banners need it); the demo enter/exit/reset routes check the
// session themselves.
export function isDemoBlockedPath(pathname: string, method: string) {
  const upper = method.toUpperCase();
  const isRead = upper === "GET" || upper === "HEAD";

  if (pathname === "/api/billing/access" && isRead) return false;
  if (pathname === "/api/billing" || pathname.startsWith("/api/billing/")) {
    return true;
  }

  if (pathname.startsWith("/api/data-requests/")) return true;
  if (pathname === "/api/settings/ai" && !isRead) return true;
  if (pathname === "/api/team" && !isRead) return true;
  if (pathname.startsWith("/api/team/invitations/")) return true;
  if (pathname.startsWith("/api/auth/2fa/")) return true;
  if (pathname.startsWith("/api/auth/session/revoke")) return true;

  return (
    pathname === "/api/auth/change-email" ||
    pathname === "/api/auth/update-profile"
  );
}
