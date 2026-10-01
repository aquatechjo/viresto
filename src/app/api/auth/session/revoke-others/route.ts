import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { invalidateAuthCacheForUser, requireAuth } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";
import { logActivity } from "@/lib/log-activity";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    if (!auth.user.sessionId) {
      return err("جلسة غير صالحة", 401);
    }

    const revoked = await prisma.session.updateMany({
      where: {
        userId: auth.user.userId,
        tenantId: auth.user.tenantId,
        isActive: true,
        id: {
          not: auth.user.sessionId,
        },
      },
      data: {
        isActive: false,
      },
    });

    await logActivity({
      req,
      tenantId: auth.user.tenantId,
      actorId: auth.user.userId,
      type: "SESSIONS_REVOKED",
      title: "تم إنهاء باقي الجلسات",
      message: `${auth.user.email} (${revoked.count})`,
      entityType: "SESSION",
      entityId: auth.user.sessionId,
    });

    invalidateAuthCacheForUser(auth.user.userId);

    return ok({ revoked: true });
  });
}
