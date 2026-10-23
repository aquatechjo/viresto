import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { loadDashboard } from "@/lib/dashboard/load-dashboard";

const DEFAULT_TIME_ZONE = "Asia/Amman";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    /*
     * توقيت الواجهة إن كان صالحًا، وإلا توقيت الأردن.
     */
    const requestedTimeZone = req.nextUrl.searchParams.get("tz") || DEFAULT_TIME_ZONE;
    const timeZone = DateTime.now().setZone(requestedTimeZone).isValid
      ? requestedTimeZone
      : DEFAULT_TIME_ZONE;

    return ok(await loadDashboard(auth.user, timeZone));
  });
}
