import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { err, ok } from "@/lib/api-response";
import { getRequestMeta, requireAuth } from "@/lib/api-auth";
import { buildCookie } from "@/lib/auth";
import { verifySameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { DEMO_SANDBOX_RATE_LIMIT, DEMO_UNAVAILABLE_CODE } from "@/lib/demo/limits";
import {
  createDemoSandbox,
  findDemoSandbox,
  isOfficeOnTrial,
  openDemoSession,
} from "@/lib/demo/sandbox";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Enters demo mode: builds the user's sandbox office on first use, then
// switches the cookie to a demo session under the real one.
export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    if (auth.user.isDemo) {
      return ok({ redirect: "/dashboard" });
    }

    if (!(await isOfficeOnTrial(auth.user.tenantId))) {
      return err("وضع التجربة متاح فقط خلال الفترة التجريبية.", 403, {
        code: DEMO_UNAVAILABLE_CODE,
      });
    }

    let sandbox = await findDemoSandbox(auth.user.userId);

    if (!sandbox) {
      const limit = await checkRateLimit(auth.user.userId, DEMO_SANDBOX_RATE_LIMIT);
      if (!limit.allowed) {
        return err("تم تجاوز الحد المسموح لتجهيز المكتب التجريبي، حاول لاحقًا.", 429);
      }

      sandbox = await createDemoSandbox({
        userId: auth.user.userId,
        tenantId: auth.user.tenantId,
        name: auth.user.name,
      });
    }

    const sandboxUser = sandbox?.users[0];
    if (!sandbox || !sandboxUser) {
      return err("تعذر تجهيز المكتب التجريبي. حاول مرة أخرى.", 500);
    }

    const meta = getRequestMeta(req);
    const token = await openDemoSession({
      sandboxTenantId: sandbox.id,
      sandboxUser,
      parentSessionId: auth.user.sessionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const res = ok({ redirect: "/dashboard" });
    res.cookies.set(buildCookie(token));
    return res;
  });
}
