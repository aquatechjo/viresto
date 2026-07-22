import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { canReadFinance } from "@/lib/permissions";
import {
  addActivityAndCondition,
  buildActivityCategoryCondition,
  buildVisibleActivityWhere,
} from "@/lib/activity-query";

const activitySelect = {
  id: true,
  tenantId: true,
  type: true,
  title: true,
  message: true,
  entityType: true,
  entityId: true,
  createdAt: true,
  actorId: true,

  // لا تجلب userAgent / ipAddress / city / country في القائمة العامة
  // خليها لتفاصيل السجل إذا احتجتها لاحقًا.
} satisfies Prisma.ActivitySelect;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const sp = new URL(req.url).searchParams;

    const pageRaw = Number(sp.get("page") || 1);
    const limitRaw = Number(sp.get("limit") || 10);

    const type = sp.get("type")?.trim() || undefined;
    const category = sp.get("category")?.trim() || undefined;
    const q = sp.get("q")?.trim() || undefined;

    // لا تعمل count افتراضيًا لأنه مكلف تحت الضغط.
    // استخدم /api/activity?withTotal=1 فقط إذا واجهة معينة تحتاج رقم total دقيق.
    const withTotal = sp.get("withTotal") === "1";

    const page = Number.isNaN(pageRaw) ? 1 : Math.max(pageRaw, 1);
    const limit = Number.isNaN(limitRaw)
      ? 10
      : Math.min(Math.max(limitRaw, 1), 50);

    const skip = (page - 1) * limit;

    const canViewFinance = canReadFinance(auth.user.role);
    const where = buildVisibleActivityWhere(auth.user, canViewFinance);

    if (type) {
      where.type = type;
    }

    if (category && category !== "all") {
      const condition = buildActivityCategoryCondition(category);

      if (condition) {
        addActivityAndCondition(where, condition);
      }
    }

    if (q) {
      addActivityAndCondition(where, {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { message: { contains: q, mode: "insensitive" } },
          { type: { contains: q, mode: "insensitive" } },
          { entityType: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const takePlusOne = limit + 1;

    const statsWhere = buildVisibleActivityWhere(auth.user, canViewFinance);

    const startOfToday = DateTime.now()
      .setZone("Asia/Amman")
      .startOf("day")
      .toUTC()
      .toJSDate();
    const securityCondition = buildActivityCategoryCondition("security");
    const paymentCondition = buildActivityCategoryCondition("payments");
    const invoiceCondition = buildActivityCategoryCondition("invoices");

    const [activitiesPlusOne, total, statsTotal, statsToday, statsSecurity, statsFinance] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: takePlusOne,
        select: activitySelect,
      }),

      withTotal ? prisma.activity.count({ where }) : Promise.resolve(null),
      prisma.activity.count({ where: statsWhere }),
      prisma.activity.count({
        where: { AND: [statsWhere, { createdAt: { gte: startOfToday } }] },
      }),
      securityCondition
        ? prisma.activity.count({ where: { AND: [statsWhere, securityCondition] } })
        : Promise.resolve(0),
      prisma.activity.count({
        where: {
          AND: [
            statsWhere,
            { OR: [paymentCondition, invoiceCondition].filter(Boolean) as Prisma.ActivityWhereInput[] },
          ],
        },
      }),
    ]);

    const hasNextPage = activitiesPlusOne.length > limit;
    const pageActivities = hasNextPage
      ? activitiesPlusOne.slice(0, limit)
      : activitiesPlusOne;

    const actorIds = Array.from(
      new Set(
        pageActivities
          .map((activity) => activity.actorId)
          .filter(Boolean) as string[],
      ),
    );

    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: {
            tenantId: auth.user.tenantId,
            id: { in: actorIds },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        })
      : [];

    const actorMap = new Map(actors.map((user) => [user.id, user]));

    const estimatedTotal =
      total ??
      (hasNextPage ? skip + limit + 1 : skip + pageActivities.length);

    const totalPages =
      total === null
        ? hasNextPage
          ? page + 1
          : page
        : Math.ceil(total / limit);

    return ok({
      items: pageActivities.map((activity) => ({
        ...activity,
        actor: activity.actorId ? actorMap.get(activity.actorId) ?? null : null,
      })),

      pagination: {
        page,
        limit,
        total: estimatedTotal,
        totalExact: total !== null,
        totalPages,
        from: estimatedTotal === 0 ? 0 : skip + 1,
        to: Math.min(skip + pageActivities.length, estimatedTotal),
        hasPreviousPage: page > 1,
        hasNextPage,
      },
      stats: {
        total: statsTotal,
        today: statsToday,
        security: statsSecurity,
        finance: statsFinance,
      },
    });
  });
}
