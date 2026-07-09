import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export async function GET() {
  return apiHandler(async () => {
    const result = await prisma.$queryRaw<{ now: Date }[]>`
      SELECT NOW() as now
    `;

    return ok({
      now: result[0]?.now,
    });
  });
}