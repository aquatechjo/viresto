import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { invalidateAuthCacheForSession, requireAuth } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";
import { logActivity } from "@/lib/log-activity";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.sessionId || "").trim();

    if (!sessionId) {
      return err("sessionId مطلوب", 400);
    }

    const revoked = await prisma.session.updateMany({
      where: {
        id: sessionId,
        tenantId: auth.user.tenantId,
        userId: auth.user.userId,
      },
      data: {
        isActive: false,
      },
    });

    if (revoked.count > 0) {
      await logActivity({
        req,
        tenantId: auth.user.tenantId,
        actorId: auth.user.userId,
        type: "SESSION_REVOKED",
        title: "تم إنهاء جلسة",
        message: auth.user.email,
        entityType: "SESSION",
        entityId: sessionId,
      });
    }

    invalidateAuthCacheForSession(
      sessionId,
      auth.user.userId,
      auth.user.tenantId,
    );

    return ok({ revoked: true });
  });
}
