import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";

export async function PATCH(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const result = await prisma.notification.updateMany({
      where: {
        tenantId: auth.user.tenantId,
        readAt: null,
        OR: [{ userId: null }, { userId: auth.user.userId }],
      },
      data: {
        readAt: new Date(),
      },
    });

    return ok({
      updated: result.count,
    });
  });
}
