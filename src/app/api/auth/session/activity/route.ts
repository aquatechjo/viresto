import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { demoEndedResponse, requireAuth } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";
import { getClientIp } from "@/lib/client-ip";
import { COOKIE, verifyToken } from "@/lib/auth";

async function demoParentSessionId(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;
  return payload?.parentSessionId ?? null;
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireAuth(req);

    if (auth.error || !auth.user) {
      return auth.error ?? err("انتهت الجلسة. يرجى تسجيل الدخول مجددًا.", 401);
    }

    const ip = getClientIp(req) || "unknown";

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
      // A demo session whose sandbox was just deleted (the office
      // subscribed) can still pass requireAuth from the short auth cache.
      // That is the end of demo mode, not of the user's session: answer
      // like requireAuth does, switching back to the real session, so the
      // client does not log the user out of their real office.
      const parentSessionId = await demoParentSessionId(req);
      if (parentSessionId) {
        return demoEndedResponse(auth.user.sessionId, parentSessionId);
      }

      return err("انتهت الجلسة. يرجى تسجيل الدخول مجددًا.", 401);
    }

    return ok({ updated: true });
  });
}
