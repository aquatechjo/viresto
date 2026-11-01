import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { hasPermission } from "@/lib/permissions";
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
    const auth = await requireAuth(req);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const sp = new URL(req.url).searchParams;

    const pageRaw = Number(sp.get("page") || 1);
    const limitRaw = Number(sp.get("limit") || 10);

    const type = sp.get("type")?.trim() || undefined;
    const category = sp.get("category")?.trim() || undefined;
    const periodStart = activityPeriodStart(sp.get("period"));
    const canViewEveryone = hasPermission(auth.user.role, "activity.read.all");
    // Without activity.read.all the list is already the user's own.
    const actorId = canViewEveryone
      ? sp.get("actorId")?.trim() || undefined
      : undefined;

    // لا تعمل count افتراضيًا لأنه مكلف تحت الضغط.
    // استخدم /api/activity?withTotal=1 فقط إذا واجهة معينة تحتاج رقم total دقيق.
    const withTotal = sp.get("withTotal") === "1";

    const page = Number.isNaN(pageRaw) ? 1 : Math.max(pageRaw, 1);
    const limit = Number.isNaN(limitRaw)
      ? 10
      : Math.min(Math.max(limitRaw, 1), 50);

    const skip = (page - 1) * limit;

    const canViewFinance = hasPermission(auth.user.role, "finance.read");
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

    if (periodStart) {
      addActivityAndCondition(where, { createdAt: { gte: periodStart } });
    }

    if (actorId) {
      addActivityAndCondition(where, { actorId });
    }

    const takePlusOne = limit + 1;

    const statsWhere = buildVisibleActivityWhere(auth.user, canViewFinance);

    const startOfToday = activityPeriodStart("today")!;
    const securityCondition = buildActivityCategoryCondition("security");
    const paymentCondition = buildActivityCategoryCondition("payments");
    const invoiceCondition = buildActivityCategoryCondition("invoices");

    const [activitiesPlusOne, total, statsTotal, statsToday, statsSecurity, statsFinance, members] = await Promise.all([
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
      // Choices for the user filter, deactivated members included: their
      // past actions stay in the log.
      canViewEveryone
        ? prisma.user.findMany({
            where: { tenantId: auth.user.tenantId },
            orderBy: [{ isActive: "desc" }, { name: "asc" }],
            select: { id: true, name: true, isActive: true },
          })
        : Promise.resolve(null),
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
      members,
    });
  });
}

const PERIOD_DAYS: Record<string, number> = { today: 0, "7d": 6, "30d": 29, "90d": 89 };

/** Start of an Amman-time period ending today, as UTC; null for "all". */
function activityPeriodStart(period: string | null) {
  const days = period ? PERIOD_DAYS[period] : undefined;
  if (days === undefined) return null;

  return DateTime.now()
    .setZone("Asia/Amman")
    .startOf("day")
    .minus({ days })
    .toUTC()
    .toJSDate();
}
