import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  const csrfError = verifySameOrigin(req);
  if (csrfError) return csrfError;
  return apiHandler(async () => {
    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.sessionId || "");

    if (!sessionId) {
      return err("sessionId مطلوب", 400);
    }

    await prisma.session.updateMany({
      where: {
        id: sessionId,
        tenantId: auth.user.tenantId,
        userId: auth.user.userId,
      },
      data: {
        isActive: false,
      },
    });

    return ok({ revoked: true });
  });
}
