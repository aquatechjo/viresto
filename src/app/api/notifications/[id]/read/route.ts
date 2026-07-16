import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const { id } = await context.params;

    const result = await prisma.notification.updateMany({
      where: {
        id,
        tenantId: auth.user.tenantId,
        userId: auth.user.userId,
      },
      data: {
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      return err("التنبيه غير موجود", 404);
    }

    return ok({
      updated: result.count,
    });
  });
}
