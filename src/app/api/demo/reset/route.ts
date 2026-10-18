import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { err, ok } from "@/lib/api-response";
import { getRequestMeta, requireAuth } from "@/lib/api-auth";
import { buildCookie } from "@/lib/auth";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { DEMO_SANDBOX_RATE_LIMIT } from "@/lib/demo/limits";
import {
  createDemoSandbox,
  deleteDemoSandboxForUser,
  openDemoSession,
} from "@/lib/demo/sandbox";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Resets the sample data: deletes the sandbox (its demo sessions go with
// it) and builds a fresh one under the same real session.
export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    if (!auth.user.isDemo) {
      return err("إعادة الضبط متاحة داخل وضع التجربة فقط.", 400);
    }

    const [sandbox, session] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: auth.user.tenantId },
        select: { demoOwnerUserId: true, isDemo: true },
      }),
      prisma.session.findUnique({
        where: { id: auth.user.sessionId },
        select: { parentSessionId: true },
      }),
    ]);

    const owner = sandbox?.demoOwnerUserId
      ? await prisma.user.findUnique({
          where: { id: sandbox.demoOwnerUserId },
          select: { id: true, tenantId: true, name: true },
        })
      : null;

    if (!sandbox?.isDemo || !owner || !session?.parentSessionId) {
      return err("تعذر إعادة ضبط البيانات التجريبية.", 400);
    }

    const limit = await checkRateLimit(owner.id, DEMO_SANDBOX_RATE_LIMIT);
    if (!limit.allowed) {
      return err("تم تجاوز الحد المسموح لإعادة الضبط، حاول لاحقًا.", 429);
    }

    await deleteDemoSandboxForUser(owner.id);

    const fresh = await createDemoSandbox({
      userId: owner.id,
      tenantId: owner.tenantId,
      name: owner.name,
    });
    const sandboxUser = fresh?.users[0];

    if (!fresh || !sandboxUser) {
      return err("تعذر تجهيز المكتب التجريبي. حاول مرة أخرى.", 500);
    }

    const meta = getRequestMeta(req);
    const token = await openDemoSession({
      sandboxTenantId: fresh.id,
      sandboxUser,
      parentSessionId: session.parentSessionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const res = ok({ redirect: "/dashboard" });
    res.cookies.set(buildCookie(token));
    return res;
  });
}
