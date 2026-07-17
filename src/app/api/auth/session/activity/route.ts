import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireAuth(req);

    if (auth.error || !auth.user) {
      return auth.error ?? err("انتهت الجلسة. يرجى تسجيل الدخول مجددًا.", 401);
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const updated = await prisma.session.updateMany({
      where: {
        id: auth.user.sessionId,
        userId: auth.user.userId,
        tenantId: auth.user.tenantId,
        isActive: true,
      },
      data: {
        lastActivityAt: new Date(),
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "unknown",
      },
    });

    if (updated.count === 0) {
      return err("انتهت الجلسة. يرجى تسجيل الدخول مجددًا.", 401);
    }

    return ok({ updated: true });
  });
}
