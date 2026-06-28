import { NextRequest } from "next/server";
import { TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";


type Params = { params: Promise<{ id: string }> };

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
        completed: true,
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

    const data: {
      completed?: boolean;
      title?: string;
      priority?: TaskPriority;
      dueDate?: Date | null;
    } = {};

    if ("completed" in body) {
      if (typeof body.completed !== "boolean") {
        return err("قيمة completed غير صالحة", 400);
      }

      data.completed = body.completed;
    }

    if ("title" in body) {
      const title = String(body.title).trim();

      if (!title) {
        return err("عنوان المهمة مطلوب", 400);
      }

      if (title.length > 200) {
        return err("عنوان المهمة طويل جدًا", 400);
      }

      data.title = title;
    }

    if ("priority" in body) {
      const priority = String(body.priority).toUpperCase();

      if (!Object.values(TaskPriority).includes(priority as TaskPriority)) {
        return err("أولوية المهمة غير صحيحة", 400);
      }

      data.priority = priority as TaskPriority;
    }

    if ("dueDate" in body) {
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

    if (Object.keys(data).length === 0) {
      return err("لا توجد بيانات للتعديل", 400);
    }

    const isArchivedClient = Boolean(
      exists.client?.archivedAt || exists.case?.client?.archivedAt,
    );

    const onlyCompletionChange =
      Object.keys(data).length === 1 && typeof data.completed === "boolean";

    if (isArchivedClient && !onlyCompletionChange) {
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
      },
    });

    if (exists.caseId) {
      const title =
        "completed" in data
          ? data.completed
            ? "تم إكمال مهمة"
            : "تم إعادة فتح مهمة"
          : "تم تعديل مهمة";

      await logActivity({
        actorId: auth.user.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        tenantId: auth.user.tenantId,
        type: "CASE_UPDATED",
        title,
        message: updated.title,
        entityType: "CASE",
        entityId: exists.caseId,
      });
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
