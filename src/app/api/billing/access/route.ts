import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { isTrialEndingSoon } from "@/lib/tenant-access";
import { getTenantAccess } from "@/lib/tenant-access-server";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    const [writeCheck, access] = await Promise.all([
      assertTenantCanWrite(auth.user.tenantId, "تنفيذ هذا الإجراء"),
      getTenantAccess(auth.user.tenantId),
    ]);

    return ok({
      // Drives the dashboard lockout redirect and the trial banners. The
      // server enforces the lockout itself (requireAuth); this is only UX.
      access: {
        state: access.state,
        lockReason: access.lockReason,
        trialEndsAt: access.trialEndsAt,
        trialDaysLeft: access.trialDaysLeft,
        trialEndingSoon: isTrialEndingSoon(access),
      },
      canWrite: writeCheck.ok,
      message: writeCheck.ok ? null : writeCheck.message,
      entitlements:
        writeCheck.billing?.plan.entitlements ?? {
          teamManagement: false,
          advancedReports: false,
          fullExport: false,
        },
      // Plan, limits, and subscription details are administrative data.
      billing:
        auth.user.role === "ADMIN"
          ? writeCheck.billing ?? null
          : null,
    });
  });
}
