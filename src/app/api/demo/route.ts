import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/api-auth";
import { isOfficeOnTrial } from "@/lib/demo/sandbox";

export const dynamic = "force-dynamic";

// Demo mode state for the dashboard card and banner: inside a sandbox, or
// whether the real office may open one (only while on its trial).
export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    if (auth.user.isDemo) {
      return ok({ inDemo: true, available: true });
    }

    return ok({
      inDemo: false,
      available: await isOfficeOnTrial(auth.user.tenantId),
    });
  });
}
