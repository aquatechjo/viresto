import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { apiHandler } from "@/lib/api-handler";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";


export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const completed = new URL(req.url).searchParams.get("completed");

    if (completed !== null && completed !== "true" && completed !== "false") {
      return err("قيمة completed غير صالحة", 400);
    }

    const data = await prisma.task.findMany({
      where: {
        tenantId: auth.user.tenantId,
        ...(completed !== null
          ? {
              completed: completed === "true",
            }
          : {}),
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
      },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
    });

    return ok(data);
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

    let linkedClientId = clientId || null;
    let linkedClientArchivedAt: Date | null = null;

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: {
          id: clientId,
          tenantId: auth.user.tenantId,
        },
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
        where: {
          id: caseId,
          tenantId: auth.user.tenantId,
          ...(clientId ? { clientId } : {}),
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

    let dueDate: Date | undefined;

    if (parsed.data.dueDate !== undefined) {
      const date = new Date(parsed.data.dueDate);

      if (Number.isNaN(date.getTime())) {
        return err("تاريخ المهمة غير صالح", 400);
      }

      dueDate = date;
    }

    const { dueDate: _dueDate, ...rest } = parsed.data;

    const task = await prisma.task.create({
      data: {
        tenantId: auth.user.tenantId,
        ...rest,
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
