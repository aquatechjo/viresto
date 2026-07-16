import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appointmentSchema } from "@/lib/validations";
import { ok, err, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientAccessWhere,
} from "@/lib/access-control";

type Params = { params: Promise<{ id: string }> };

const appointmentUserSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
} as const;

function hasExplicitTimeZone(value: unknown) {
  if (typeof value !== "string") return true;

  const normalized = value.trim();

  if (!normalized) return true;

  return /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
}

function getValidTimeZone(value: unknown) {
  if (typeof value !== "string") return null;

  const timeZone = value.trim();

  if (!timeZone) return null;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعديل موعد",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);

    const { id } = await params;

    const exists = await prisma.appointment.findFirst({
      where: buildAppointmentAccessWhere(auth.user, { id }),
      select: {
        id: true,
        title: true,
        caseId: true,
        clientId: true,
        assignedToId: true,
        createdById: true,
        startTime: true,
        endTime: true,
        type: true,
        status: true,
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
      return notFound("الموعد غير موجود");
    }

    if (
      auth.user.role === "STAFF" &&
      exists.assignedToId !== auth.user.userId
    ) {
      return err("يمكنك تعديل المواعيد المسندة إليك فقط", 403);
    }

    const isCurrentlyArchivedClient = Boolean(
      exists.client?.archivedAt || exists.case?.client?.archivedAt,
    );

    if (isCurrentlyArchivedClient) {
      return err("لا يمكن تعديل موعد مرتبط بموكل مؤرشف", 400);
    }

    const body = await req.json().catch(() => ({}));

    const {
      timeZone: timeZoneRaw,
      startAt,
      endAt,
      ...bodyForValidation
    } = body;

    const clientTimeZone = getValidTimeZone(timeZoneRaw);

    if (timeZoneRaw && !clientTimeZone) {
      return err("المنطقة الزمنية غير صالحة", 400);
    }

    const validationBody = {
      ...bodyForValidation,
      startTime: bodyForValidation.startTime ?? startAt,
      endTime: bodyForValidation.endTime ?? endAt,
    };

    if (
      validationBody.startTime !== undefined &&
      !hasExplicitTimeZone(validationBody.startTime)
    ) {
      return err(
        "وقت بداية الموعد يجب أن يُرسل بصيغة ISO تحتوي على timezone",
        400,
      );
    }

    if (
      validationBody.endTime &&
      !hasExplicitTimeZone(validationBody.endTime)
    ) {
      return err(
        "وقت نهاية الموعد يجب أن يُرسل بصيغة ISO تحتوي على timezone",
        400,
      );
    }

    const parsed = appointmentSchema.partial().safeParse(validationBody);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    if (Object.keys(parsed.data).length === 0) {
      return err("لا توجد بيانات للتعديل", 400);
    }

    let startTime: Date | undefined;
    let endTime: Date | undefined | null;

    if (parsed.data.startTime !== undefined) {
      startTime = new Date(parsed.data.startTime);

      if (Number.isNaN(startTime.getTime())) {
        return err("تاريخ بداية الموعد غير صالح", 400);
      }
    }

    if (parsed.data.endTime !== undefined) {
      if (parsed.data.endTime) {
        endTime = new Date(parsed.data.endTime);

        if (Number.isNaN(endTime.getTime())) {
          return err("تاريخ نهاية الموعد غير صالح", 400);
        }
      } else {
        endTime = null;
      }
    }

    const finalStart = startTime ?? exists.startTime;
    const finalEnd = endTime !== undefined ? endTime : exists.endTime;

    if (finalEnd && finalEnd <= finalStart) {
      return err("تاريخ نهاية الموعد يجب أن يكون بعد تاريخ البداية", 400);
    }

    const {
      startTime: _startTime,
      endTime: _endTime,
      clientId,
      caseId,
      assignedToId,
      ...rest
    } = parsed.data;

    let nextAssignedToId: string | undefined;

    if (assignedToId !== undefined) {
      if (!assignedToId) {
        return err("المسؤول عن الموعد مطلوب", 400);
      }

      if (
        auth.user.role === "STAFF" &&
        assignedToId !== auth.user.userId
      ) {
        return err("الموظف يستطيع إسناد الموعد لنفسه فقط", 403);
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

      nextAssignedToId = assignee.id;
    }

    let linkedClientId = clientId !== undefined ? clientId : exists.clientId;

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: buildClientAccessWhere(auth.user, { id: clientId }),
        select: {
          id: true,
          archivedAt: true,
        },
      });

      if (!clientExists) {
        return err("لا يمكن ربط الموعد بموكل لا يتبع هذا المكتب", 403);
      }

      if (clientExists.archivedAt) {
        return err("لا يمكن ربط الموعد بموكل مؤرشف", 400);
      }
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
          "لا يمكن ربط الموعد بقضية لا تتبع هذا المكتب أو لا تتبع الموكل المحدد",
          403,
        );
      }

      if (caseExists.client?.archivedAt) {
        return err("لا يمكن ربط الموعد بقضية موكلها مؤرشف", 400);
      }

      linkedClientId = caseExists.clientId;
    }

    const shouldUpdateClientRelation =
      clientId !== undefined || caseId !== undefined;

    const updated = await prisma.appointment.update({
      where: {
        id: exists.id,
      },
      data: {
        ...rest,
        ...(shouldUpdateClientRelation ? { clientId: linkedClientId } : {}),
        ...(caseId !== undefined ? { caseId } : {}),
        ...(nextAssignedToId !== undefined
          ? { assignedToId: nextAssignedToId }
          : {}),
        ...(startTime !== undefined ? { startTime } : {}),
        ...(endTime !== undefined ? { endTime } : {}),
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
          select: appointmentUserSelect,
        },
        createdBy: {
          select: appointmentUserSelect,
        },
      },
    });

    const activityCaseId = updated.caseId || exists.caseId;

    if (activityCaseId) {
      await logActivity({
        actorId: auth.user.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        tenantId: auth.user.tenantId,
        type: "CASE_UPDATED",
        title: "تم تعديل موعد",
        message: updated.title,
        entityType: "CASE",
        entityId: activityCaseId,
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
      "حذف موعد",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);

    const { id } = await params;

    const exists = await prisma.appointment.findFirst({
      where: buildAppointmentAccessWhere(auth.user, { id }),
      select: {
        id: true,
        title: true,
        caseId: true,
        clientId: true,
        startTime: true,
        type: true,
        status: true,
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
      return notFound("الموعد غير موجود");
    }

    const isArchivedClient = Boolean(
      exists.client?.archivedAt || exists.case?.client?.archivedAt,
    );

    if (isArchivedClient) {
      return err("لا يمكن حذف موعد مرتبط بموكل مؤرشف", 400);
    }

    const deleted = await prisma.appointment.deleteMany({
      where: {
        id: exists.id,
        tenantId: auth.user.tenantId,
      },
    });

    if (deleted.count === 0) {
      return notFound("الموعد غير موجود");
    }

    if (exists.caseId) {
      await logActivity({
        actorId: auth.user.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        tenantId: auth.user.tenantId,
        type: "CASE_UPDATED",
        title: "تم حذف موعد",
        message: exists.title,
        entityType: "CASE",
        entityId: exists.caseId,
      });
    }

    return ok({ deleted: true });
  });
}
