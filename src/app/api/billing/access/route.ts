import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanWrite } from "@/lib/billing-limits";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تنفيذ هذا الإجراء",
    );

    return ok({
      canWrite: writeCheck.ok,
      message: writeCheck.ok ? null : writeCheck.message,
      // Plan, limits, and subscription details are administrative data.
      billing:
        auth.user.role === "ADMIN"
          ? writeCheck.billing ?? null
          : null,
    });
  });
}
