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
