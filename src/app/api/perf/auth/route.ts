import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    return ok({
      userId: auth.user.userId,
      tenantId: auth.user.tenantId,
      role: auth.user.role,
    });
  });
}