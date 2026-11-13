import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { requirePermission } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { embedOutcomeLogLine, parseEmbedOutcomeReport } from "@/lib/billing/embed-outcome";

// The billing page reports how the checkout opened (embedded or as a page,
// and why), so it can be read in the Vercel logs. Logs only; stores nothing.
export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requirePermission(req, "billing.manage");
    if (auth.error || !auth.user) return auth.error;

    const report = parseEmbedOutcomeReport(await req.json().catch(() => null));
    if (!report) return err("بيانات غير صالحة", 400);

    const line = embedOutcomeLogLine(report, auth.user.tenantId);
    if (report.outcome === "embedded") console.info(line);
    else console.warn(line);

    return ok({ logged: true });
  });
}
