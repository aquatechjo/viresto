import { NextRequest } from "next/server";
import { Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";

type Params = { params: Promise<{ id: string }> };

const taskUserSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
} as const;

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function nullableId(value: unknown) {
  const id = String(value ?? "").trim();
  return id || null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعديل مهمة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;

    const exists = await prisma.task.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        title: true,
        caseId: true,
        clientId: true,
        assignedToId: true,
        createdById: true,
        completed: true,
        status: true,
        priority: true,
        dueDate: true,
        client: {
          select: {
            id: true,
            archivedAt: true,
          },
        },
        case: {
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
        },
      },
    });

    if (!exists) {
      return notFound("المهمة غير موجودة");
    }

    const body = await req.json().catch(() => ({}));

    if (
      auth.user.role === "STAFF" &&
      exists.assignedToId !== auth.user.userId
    ) {
      return err("يمكنك تحديث المهام المسندة إليك فقط", 403);
    }

    if (hasOwn(body, "completed") && hasOwn(body, "status")) {
      return err("أرسل الحالة الجديدة فقط دون completed", 400);
    }

    const data: Prisma.TaskUncheckedUpdateInput = {};

    if (hasOwn(body, "completed")) {
      if (typeof body.completed !== "boolean") {
        return err("قيمة completed غير صالحة", 400);
      }

      data.completed = body.completed;
      data.status = body.completed ? "COMPLETED" : "TODO";
      data.completedAt = body.completed ? new Date() : null;
    }

    if (hasOwn(body, "status")) {
      const status = String(body.status).trim().toUpperCase();

      if (!Object.values(TaskStatus).includes(status as TaskStatus)) {
        return err("حالة المهمة غير صحيحة", 400);
      }

      data.status = status as TaskStatus;
      data.completed = status === "COMPLETED";
      data.completedAt = status === "COMPLETED" ? new Date() : null;
    }

    if (hasOwn(body, "title")) {
      const title = String(body.title).trim();

      if (!title) {
        return err("عنوان المهمة مطلوب", 400);
      }

      if (title.length > 200) {
        return err("عنوان المهمة طويل جدًا", 400);
      }

      data.title = title;
    }

    if (hasOwn(body, "description")) {
      const description = String(body.description ?? "").trim();

      if (description.length > 2000) {
        return err("وصف المهمة طويل جدًا", 400);
      }

      data.description = description || null;
    }

    if (hasOwn(body, "priority")) {
      const priority = String(body.priority).trim().toUpperCase();

      if (!Object.values(TaskPriority).includes(priority as TaskPriority)) {
        return err("أولوية المهمة غير صحيحة", 400);
      }

      data.priority = priority as TaskPriority;
    }

    if (hasOwn(body, "dueDate")) {
      if (body.dueDate) {
        const date = new Date(body.dueDate);

        if (Number.isNaN(date.getTime())) {
          return err("تاريخ المهمة غير صالح", 400);
        }

        data.dueDate = date;
      } else {
        data.dueDate = null;
      }
    }

    if (hasOwn(body, "assignedToId")) {
      if (auth.user.role === "STAFF") {
        return err("لا تملك صلاحية إعادة إسناد المهمة", 403);
      }

      const assignedToId = nullableId(body.assignedToId);

      if (!assignedToId) {
        return err("المسؤول عن المهمة مطلوب", 400);
      }

      const assignee = await prisma.user.findFirst({
        where: {
          id: assignedToId,
          tenantId: auth.user.tenantId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!assignee) {
        return err("المسؤول المحدد غير موجود أو حسابه معطل", 400);
      }

      data.assignedToId = assignee.id;
    }

    const changesClientLink = hasOwn(body, "clientId");
    const changesCaseLink = hasOwn(body, "caseId");

    if (changesClientLink || changesCaseLink) {
      if (auth.user.role === "STAFF") {
        return err("لا تملك صلاحية تعديل ارتباط المهمة", 403);
      }

      let nextClientId = changesClientLink
        ? nullableId(body.clientId)
        : exists.clientId;
      const nextCaseId = changesCaseLink
        ? nullableId(body.caseId)
        : exists.caseId;

      if (nextClientId) {
        const client = await prisma.client.findFirst({
          where: {
            id: nextClientId,
            tenantId: auth.user.tenantId,
          },
          select: {
            id: true,
            archivedAt: true,
          },
        });

        if (!client) {
          return err("الموكل المحدد غير موجود", 400);
        }

        if (client.archivedAt) {
          return err("لا يمكن ربط المهمة بموكل مؤرشف", 400);
        }
      }

      if (nextCaseId) {
        const relatedCase = await prisma.case.findFirst({
          where: {
            id: nextCaseId,
            tenantId: auth.user.tenantId,
          },
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

        if (!relatedCase) {
          return err("القضية المحددة غير موجودة", 400);
        }

        if (relatedCase.client?.archivedAt) {
          return err("لا يمكن ربط المهمة بقضية لموكل مؤرشف", 400);
        }

        if (
          nextClientId &&
          relatedCase.clientId &&
          relatedCase.clientId !== nextClientId
        ) {
          return err("القضية المحددة لا تتبع الموكل المحدد", 400);
        }

        if (!nextClientId && relatedCase.clientId) {
          nextClientId = relatedCase.clientId;
        }
      }

      data.clientId = nextClientId;
      data.caseId = nextCaseId;
    }

    if (Object.keys(data).length === 0) {
      return err("لا توجد بيانات للتعديل", 400);
    }

    if (auth.user.role === "STAFF") {
      const allowedStaffFields = new Set([
        "status",
        "completed",
        "completedAt",
      ]);
      const hasForbiddenField = Object.keys(data).some(
        (key) => !allowedStaffFields.has(key),
      );

      if (hasForbiddenField) {
        return err("الموظف يستطيع تحديث حالة المهمة فقط", 403);
      }
    }

    const isArchivedClient = Boolean(
      exists.client?.archivedAt || exists.case?.client?.archivedAt,
    );

    const onlyStatusChange = Object.keys(data).every((key) =>
      ["status", "completed", "completedAt"].includes(key),
    );

    if (isArchivedClient && !onlyStatusChange) {
      return err("لا يمكن تعديل بيانات مهمة مرتبطة بموكل مؤرشف", 400);
    }

    const updated = await prisma.task.update({
      where: {
        id: exists.id,
      },
      data,
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

    if (exists.caseId || updated.caseId) {
      const activityCaseId = updated.caseId || exists.caseId;
      const title =
        "status" in data || "completed" in data
          ? data.completed === true
            ? "تم إكمال مهمة"
            : data.status === "CANCELLED"
              ? "تم إلغاء مهمة"
              : "تم تحديث حالة مهمة"
          : "تم تعديل مهمة";

      if (activityCaseId) {
        await logActivity({
          actorId: auth.user.userId,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          tenantId: auth.user.tenantId,
          type: "CASE_UPDATED",
          title,
          message: updated.title,
          entityType: "CASE",
          entityId: activityCaseId,
        });
      }
    }

    return ok(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "حذف مهمة",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;

    const exists = await prisma.task.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        title: true,
        caseId: true,
        clientId: true,
        priority: true,
        dueDate: true,
        client: {
          select: {
            id: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            title: true,
            id: true,
            client: {
              select: {
                id: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    });

    if (!exists) {
      return notFound("المهمة غير موجودة");
    }

    const isArchivedClient = Boolean(
      exists.client?.archivedAt || exists.case?.client?.archivedAt,
    );

    if (isArchivedClient) {
      return err("لا يمكن حذف مهمة مرتبطة بموكل مؤرشف", 400);
    }

    const deleted = await prisma.task.deleteMany({
      where: {
        id: exists.id,
        tenantId: auth.user.tenantId,
      },
    });

    if (deleted.count === 0) {
      return notFound("المهمة غير موجودة");
    }

    if (exists.caseId) {
      await logActivity({
        actorId: auth.user.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        tenantId: auth.user.tenantId,
        type: "CASE_UPDATED",
        title: "تم حذف مهمة",
        message: exists.title,
        entityType: "CASE",
        entityId: exists.caseId,
      });
    }

    return ok({ deleted: true });
  });
}