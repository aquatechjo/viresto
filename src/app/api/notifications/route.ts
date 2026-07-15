import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { generateImportantNotifications } from "@/lib/notification-rules";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    await generateImportantNotifications(auth.user.tenantId);

    const sp = new URL(req.url).searchParams;
    const takeParam = Number(sp.get("take") ?? 20);
    const take = Number.isFinite(takeParam)
      ? Math.min(Math.max(takeParam, 1), 50)
      : 20;

    const where = {
      tenantId: auth.user.tenantId,
      OR: [{ userId: null }, { userId: auth.user.userId }],
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          ...where,
          readAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        take,
      }),
      prisma.notification.count({
        where: {
          ...where,
          readAt: null,
        },
      }),
    ]);

    return ok({
      notifications,
      unreadCount,
    });
  });
}
