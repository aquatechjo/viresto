import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireAuth(req);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    return ok(auth.user.profile);
  });
}
