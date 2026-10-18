import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { ok } from "@/lib/api-response";
import { COOKIE, buildCookie, clearCookie, verifyToken } from "@/lib/auth";
import { invalidateAuthCacheForSessionId } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";
import { closeDemoSession, restoreRealSession } from "@/lib/demo/sandbox";

export const dynamic = "force-dynamic";

// Leaves demo mode: ends the demo session and switches the cookie back to
// the real session. Reads the signed token itself rather than requireAuth,
// so it works even after the sandbox has been deleted. The sandbox stays
// for next time ("reset" rebuilds it).
export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const token = req.cookies.get(COOKIE)?.value;
    const payload = token ? await verifyToken(token) : null;

    if (!payload?.parentSessionId) {
      return ok({ redirect: payload ? "/dashboard" : "/login" });
    }

    if (payload.sessionId) {
      await closeDemoSession(payload.sessionId);
      invalidateAuthCacheForSessionId(payload.sessionId);
    }

    const realToken = await restoreRealSession(payload.parentSessionId);

    if (!realToken) {
      const res = ok({ redirect: "/login" });
      res.cookies.set(clearCookie());
      return res;
    }

    const res = ok({ redirect: "/dashboard" });
    res.cookies.set(buildCookie(realToken));
    return res;
  });
}
