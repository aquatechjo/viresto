import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appointmentSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientAccessWhere,
} from "@/lib/access-control";

const appointmentUserSelect = {
  id: true,
  name: true,
  role: true,
  isActive: true,
} as const;

function hasExplicitTimeZone(value: unknown) {
  if (typeof value !== "string") return true;

  const normalized = value.trim();

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

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const sp = new URL(req.url).searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const includeArchivedClients = sp.get("includeArchivedClients") === "true";
    const assignedToId = sp.get("assignedToId")?.trim() || "";

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    if (fromDate && Number.isNaN(fromDate.getTime())) {
      return err("تاريخ البداية غير صالح", 400);
    }

    if (toDate && Number.isNaN(toDate.getTime())) {
      return err("تاريخ النهاية غير صالح", 400);
    }

    const data = await prisma.appointment.findMany({
      where: buildAppointmentAccessWhere(auth.user, {
        ...(assignedToId === "me"
          ? { assignedToId: auth.user.userId }
          : assignedToId
            ? { assignedToId }
            : {}),

        ...(includeArchivedClients
          ? {}
          : {
              AND: [
                {
                  OR: [
                    {
                      clientId: null,
                    },
                    {
                      client: {
                        archivedAt: null,
                      },
                    },
                  ],
                },
                {
                  OR: [
                    {
                      caseId: null,
                    },
                    {
                      case: {
                        client: {
                          archivedAt: null,
                        },
                      },
                    },
                  ],
                },
              ],
            }),

        ...(fromDate || toDate
          ? {
              AND: [
                ...(toDate ? [{ startTime: { lt: toDate } }] : []),
                ...(fromDate
                  ? [
                      {
                        OR: [
                          { endTime: { gt: fromDate } },
                          { endTime: null, startTime: { gte: fromDate } },
                        ],
                      },
                    ]
                  : []),
              ],
            }
          : {}),
      }),

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

      orderBy: {
        startTime: "asc",
      },
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
      "إنشاء موعد",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);

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

    if (!hasExplicitTimeZone(validationBody.startTime)) {
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

    const parsed = appointmentSchema.safeParse(validationBody);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    const startTime = new Date(parsed.data.startTime);
    const endTime = parsed.data.endTime
      ? new Date(parsed.data.endTime)
      : undefined;

    if (Number.isNaN(startTime.getTime())) {
      return err("تاريخ بداية الموعد غير صالح", 400);
    }

    if (endTime && Number.isNaN(endTime.getTime())) {
      return err("تاريخ نهاية الموعد غير صالح", 400);
    }

    if (endTime && endTime <= startTime) {
      return err("تاريخ نهاية الموعد يجب أن يكون بعد تاريخ البداية", 400);
    }

    const { clientId, caseId } = parsed.data;
    const assignedToId = parsed.data.assignedToId || auth.user.userId;

    if (auth.user.role === "STAFF" && assignedToId !== auth.user.userId) {
      return err("الموظف يستطيع إسناد الموعد لنفسه فقط", 403);
    }

    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToId,
        tenantId: auth.user.tenantId,
        isActive: true,
      },
      select: appointmentUserSelect,
    });

    if (!assignee) {
      return err("المسؤول المحدد غير موجود أو حسابه معطل", 400);
    }
    let linkedClientId = clientId || null;

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
        return err("لا يمكن إنشاء موعد لموكل مؤرشف", 400);
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

      if (caseExists.client.archivedAt) {
        return err("لا يمكن إنشاء موعد لقضية مرتبطة بموكل مؤرشف", 400);
      }

      linkedClientId = caseExists.clientId;
    }

    const {
      startTime: _startTime,
      endTime: _endTime,
      clientId: _clientId,
      assignedToId: _assignedToId,
      ...rest
    } = parsed.data;

    const appt = await prisma.appointment.create({
      data: {
        tenantId: auth.user.tenantId,
        ...rest,
        assignedToId,
        createdById: auth.user.userId,
        ...(linkedClientId ? { clientId: linkedClientId } : {}),
        startTime,
        ...(endTime ? { endTime } : {}),
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

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: "APPOINTMENT_CREATED",
      title: "تم إضافة موعد",
      message: appt.title ?? "موعد جديد",
      entityType: caseId ? "CASE" : "APPOINTMENT",
      entityId: caseId || appt.id,
    });

    return ok(appt, 201);
  });
}
