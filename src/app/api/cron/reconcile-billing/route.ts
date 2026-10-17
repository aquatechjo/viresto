import { NextRequest } from "next/server";
import { err, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { isBearerSecretAuthorized } from "@/lib/bearer-secret";
import { RECONCILE_LOG_PREFIX, reconcilePolarSubscriptions } from "@/lib/polar-reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily Vercel cron (vercel.json): re-syncs every office whose subscription
// drifted from Polar's current state. See src/lib/polar-reconcile.ts.
export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    if (!process.env.CRON_SECRET) {
      return err("Cron secret is not configured", 500);
    }

    if (!isBearerSecretAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
      return err("Unauthorized", 401);
    }

    try {
      const summary = await reconcilePolarSubscriptions();
      return ok(summary);
    } catch (error) {
      // Polar unreachable or the listing failed: nothing was half-applied
      // (each sync is its own transaction). Tomorrow's run retries.
      console.error(
        `${RECONCILE_LOG_PREFIX} run_failed error=${error instanceof Error ? error.name : "unknown"}`,
      );
      return err("Billing reconciliation failed", 502);
    }
  });
}
