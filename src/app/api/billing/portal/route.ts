import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { getAppUrl, getPolarClient } from "@/lib/polar";

// Opens Polar's customer portal for this office's Polar customer, where the
// admin can update the card after a failed renewal. Reachable while locked
// (it is under /api/billing).
export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: auth.user.tenantId,
        polarSubscriptionId: { not: null },
        polarCustomerId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: { polarCustomerId: true },
    });

    if (!subscription?.polarCustomerId) {
      return err("لا يوجد اشتراك مدفوع مرتبط بهذا المكتب", 404);
    }

    const session = await getPolarClient().customerSessions.create({
      customerId: subscription.polarCustomerId,
      returnUrl: `${getAppUrl()}/dashboard/billing`,
    });

    return ok({ url: session.customerPortalUrl });
  });
}
