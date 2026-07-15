import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const result = await prisma.$queryRaw<{ now: Date }[]>`
      SELECT NOW() as now
    `;

    return ok({
      now: result[0]?.now,
    });
  });
}
