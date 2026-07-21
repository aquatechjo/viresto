import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { apiHandler } from "@/lib/api-handler";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";
import {
  buildCaseAccessWhere,
  buildClientAccessWhere,
  buildTaskAccessWhere,
} from "@/lib/access-control";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const allowedStatuses = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
] as const;

const taskUserSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
} as const;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const sp = new URL(req.url).searchParams;
    const completed = sp.get("completed");
    const status = sp.get("status")?.trim().toUpperCase() || "";
    const assignedToId = sp.get("assignedToId")?.trim() || "";
    const scope = sp.get("scope")?.trim().toLowerCase() || "all";
    const priority = sp.get("priority")?.trim().toUpperCase() || "";
    const clientId = sp.get("clientId")?.trim() || "";
    const caseId = sp.get("caseId")?.trim() || "";
    const query = sp.get("q")?.trim().slice(0, 100) || "";
    const pageInput = Number(sp.get("page") || "1");
    const limitInput = Number(sp.get("limit") || DEFAULT_PAGE_SIZE);
    const page = Number.isInteger(pageInput) && pageInput > 0 ? pageInput : 1;
    const limit =
      Number.isInteger(limitInput) && limitInput > 0
        ? Math.min(limitInput, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;

    if (completed !== null && completed !== "true" && completed !== "false") {
      return err("قيمة completed غير صالحة", 400);
    }

    if (status && !allowedStatuses.includes(status as any)) {
      return err("حالة المهمة غير صالحة", 400);
    }

    if (priority && !["URGENT", "HIGH", "MEDIUM", "LOW"].includes(priority)) {
      return err("أولوية المهمة غير صالحة", 400);
    }

    if (!["all", "pending", "done"].includes(scope)) {
      return err("فلتر المهام غير صالح", 400);
    }

    const accessWhere = buildTaskAccessWhere(auth.user);
    const where = buildTaskAccessWhere(auth.user, {
        ...(status ? { status: status as any } : {}),
        ...(scope === "pending"
          ? { status: { notIn: ["COMPLETED", "CANCELLED"] as any } }
          : scope === "done"
            ? { status: "COMPLETED" as any }
            : {}),
        ...(assignedToId === "me"
          ? { assignedToId: auth.user.userId }
          : assignedToId
            ? { assignedToId }
            : {}),
        ...(completed !== null
          ? {
              completed: completed === "true",
            }
          : {}),
        ...(priority ? { priority: priority as any } : {}),
        ...(clientId ? { clientId } : {}),
        ...(caseId ? { caseId } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" as const } },
                { description: { contains: query, mode: "insensitive" as const } },
                { assignedTo: { name: { contains: query, mode: "insensitive" as const } } },
                { client: { name: { contains: query, mode: "insensitive" as const } } },
                { case: { title: { contains: query, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      });

    const now = new Date();
    const pendingWhere = {
      ...accessWhere,
      status: { notIn: ["COMPLETED", "CANCELLED"] as any },
    };

    const [data, total, all, pending, completedCount, overdue] =
      await prisma.$transaction([
        prisma.task.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            title: true,
            client: {
              select: {
                id: true,
                name: true,
                archivedAt: true,
              },
            },
          },
        },
        assignedTo: {
          select: taskUserSelect,
        },
        createdBy: {
          select: taskUserSelect,
        },
      },
      orderBy: [
        { completed: "asc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
        prisma.task.count({ where }),
        prisma.task.count({ where: accessWhere }),
        prisma.task.count({ where: pendingWhere }),
        prisma.task.count({ where: { ...accessWhere, status: "COMPLETED" } }),
        prisma.task.count({
          where: {
            ...pendingWhere,
            dueDate: { lt: now },
          },
        }),
      ]);

    return ok({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: { total: all, pending, done: completedCount, overdue },
    });
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "إنشاء مهمة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);

    const body = await req.json().catch(() => ({}));
    const parsed = taskSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    const { clientId, caseId } = parsed.data;
    const assignedToId = parsed.data.assignedToId || auth.user.userId;

    if (auth.user.role === "STAFF" && assignedToId !== auth.user.userId) {
      return err("الموظف يستطيع إسناد المهمة لنفسه فقط", 403);
    }

    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToId,
        tenantId: auth.user.tenantId,
        isActive: true,
      },
      select: taskUserSelect,
    });

    if (!assignee) {
      return err("المسؤول المحدد غير موجود أو حسابه معطل", 400);
    }

    let linkedClientId = clientId || null;
    let linkedClientArchivedAt: Date | null = null;

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: buildClientAccessWhere(auth.user, { id: clientId }),
        select: {
          id: true,
          archivedAt: true,
        },
      });

      if (!clientExists) {
        return err("لا يمكن ربط المهمة بموكل لا يتبع هذا المكتب", 403);
      }

      if (clientExists.archivedAt) {
        return err("لا يمكن إنشاء مهمة لموكل مؤرشف", 400);
      }

      linkedClientArchivedAt = clientExists.archivedAt;
    }

    if (caseId) {
      const caseExists = await prisma.case.findFirst({
        where: buildCaseAccessWhere(auth.user, {
          id: caseId,
          ...(clientId ? { clientId } : {}),
        }),
        select: {
          id: true,
          clientId: true,
          client: {
            select: {
              id: true,
              archivedAt: true,
            },
          },
        },
      });

      if (!caseExists) {
        return err(
          "لا يمكن ربط المهمة بقضية لا تتبع هذا المكتب أو لا تتبع الموكل المحدد",
          403,
        );
      }

      if (caseExists.client?.archivedAt) {
        return err("لا يمكن إنشاء مهمة لقضية موكلها مؤرشف", 400);
      }

      linkedClientId = caseExists.clientId;
      linkedClientArchivedAt = caseExists.client?.archivedAt ?? null;
    }

    if (linkedClientArchivedAt) {
      return err("لا يمكن إنشاء مهمة مرتبطة بموكل مؤرشف", 400);
    }

    let dueDate: Date | null | undefined;

    if (parsed.data.dueDate) {
      const date = new Date(parsed.data.dueDate);

      if (Number.isNaN(date.getTime())) {
        return err("تاريخ المهمة غير صالح", 400);
      }

      dueDate = date;
    } else if (parsed.data.dueDate === null) {
      dueDate = null;
    }

    const {
      dueDate: _dueDate,
      assignedToId: _assignedToId,
      status: statusInput,
      ...rest
    } = parsed.data;
    const status = statusInput || "TODO";

    const task = await prisma.task.create({
      data: {
        tenantId: auth.user.tenantId,
        ...rest,
        assignedToId,
        createdById: auth.user.userId,
        status,
        completed: status === "COMPLETED",
        completedAt: status === "COMPLETED" ? new Date() : null,
        ...(linkedClientId ? { clientId: linkedClientId } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            title: true,
            client: {
              select: {
                id: true,
                name: true,
                archivedAt: true,
              },
            },
          },
        },
        assignedTo: {
          select: taskUserSelect,
        },
        createdBy: {
          select: taskUserSelect,
        },
      },
    });

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: "TASK_CREATED",
      title: "تم إضافة مهمة",
      message: task.title,
      entityType: caseId ? "CASE" : "TASK",
      entityId: caseId || task.id,
    });

    return ok(task, 201);
  });
}
