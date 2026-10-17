import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { isTrialEndingSoon } from "@/lib/tenant-access";
import { getTenantAccess } from "@/lib/tenant-access-server";
import {
  SEAT_LIMIT_READ_ONLY_CODE,
  SEAT_LIMIT_READ_ONLY_MESSAGE,
  getTenantSeatStateCached,
  isReadOnlySeat,
} from "@/lib/tenant-seats";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    const [writeCheck, access, seats] = await Promise.all([
      assertTenantCanWrite(auth.user.tenantId, "تنفيذ هذا الإجراء"),
      getTenantAccess(auth.user.tenantId),
      getTenantSeatStateCached(auth.user.tenantId),
    ]);

    const isAdmin = auth.user.role === "ADMIN";
    const seatReadOnly =
      !auth.user.isSystemAdmin && isReadOnlySeat(seats, auth.user.userId);
    const canWrite = writeCheck.ok && !seatReadOnly;

    return ok({
      // Drives the dashboard lockout redirect and the trial banners. The
      // server enforces the lockout itself (requireAuth); this is only UX.
      access: {
        state: access.state,
        lockReason: access.lockReason,
        trialEndsAt: access.trialEndsAt,
        trialDaysLeft: access.trialDaysLeft,
        trialEndingSoon: isTrialEndingSoon(access),
        paymentFailed: access.paymentFailed,
        pastDueLocksAt: access.pastDueLocksAt,
        canManageBilling: isAdmin,
        // More active users than the plan allows (tenant-seats.ts).
        seats: {
          limit: seats.limit,
          activeCount: seats.activeCount,
          planName: seats.planName,
          overLimit: seats.readOnlyUsers.length > 0,
          readOnly: seatReadOnly,
          // Who lost write access: for the admin who can fix it.
          readOnlyUsers: isAdmin ? seats.readOnlyUsers : [],
        },
      },
      canWrite,
      writeBlockCode: !writeCheck.ok
        ? "SUBSCRIPTION"
        : seatReadOnly
          ? SEAT_LIMIT_READ_ONLY_CODE
          : null,
      message: !writeCheck.ok
        ? writeCheck.message
        : seatReadOnly
          ? SEAT_LIMIT_READ_ONLY_MESSAGE
          : null,
      entitlements:
        writeCheck.billing?.plan.entitlements ?? {
          teamManagement: false,
          advancedReports: false,
          fullExport: false,
        },
      // Plan, limits, and subscription details are administrative data.
      billing:
        isAdmin
          ? writeCheck.billing ?? null
          : null,
    });
  });
}
