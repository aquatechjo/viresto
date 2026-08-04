import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertTenantCanCreate,
  assertTenantCanWrite,
} from "@/lib/billing-limits";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { clientSchema } from "@/lib/validations";
import { ok, err, notFound } from "@/lib/api-response";
import { logActivity } from "@/lib/activity";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import {
  encryptText,
  decryptText,
  normalizeEmail,
  normalizePhone,
  hashSearchValue,
} from "@/lib/encryption";
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientIdentifierAccessWhere,
  buildTaskAccessWhere,
} from "@/lib/access-control";
import { canReadFinance } from "@/lib/permissions";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";

type Params = { params: Promise<{ id: string }> };

function decryptClient<
  T extends {
    email?: string | null;
    phone?: string | null;
    nationalId?: string | null;
    address?: string | null;
    notes?: string | null;
    emailHash?: string | null;
    phoneHash?: string | null;
    nationalIdHash?: string | null;
    createdById?: string | null;
  },
>(client: T, revealSensitive = true) {
  const {
    emailHash: _emailHash,
    phoneHash: _phoneHash,
    nationalIdHash: _nationalIdHash,
    createdById: _createdById,
    ...safeClient
  } = client;

  return {
    ...safeClient,
    email: revealSensitive ? decryptText(client.email) : null,
    phone: revealSensitive ? decryptText(client.phone) : null,
    nationalId: revealSensitive ? decryptText(client.nationalId) : null,
    address: revealSensitive ? decryptText(client.address) : null,
    notes: revealSensitive ? decryptText(client.notes) : null,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: buildClientIdentifierAccessWhere(id, auth.user),
      include: {
        cases: {
          where: buildCaseAccessWhere(auth.user),
          include: {
            payments: true,
            _count: {
              select: {
                appointments: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        appointments: {
          where: buildAppointmentAccessWhere(auth.user),
          orderBy: {
            startTime: "desc",
          },
          take: 5,
        },
        tasks: {
          where: buildTaskAccessWhere(auth.user),
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
    });

    if (!client) {
      return notFound("الموكل غير موجود");
    }

    const revealSensitive = auth.user.role !== "STAFF";
    const canViewFinance = canReadFinance(auth.user.role);

    return ok({
      ...decryptClient(client, revealSensitive),
      cases: client.cases.map((caseItem) => ({
        ...caseItem,
        payments: canViewFinance ? caseItem.payments : [],
      })),
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعديل بيانات الموكل",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;

    const exists = await prisma.client.findFirst({
      where: buildClientIdentifierAccessWhere(id, auth.user),
      select: {
        id: true,
        name: true,
        archivedAt: true,
      },
    });

    if (!exists) {
      return notFound("الموكل غير موجود");
    }

    const body = await req.json().catch(() => ({}));

    if (body?.action === "archive") {
      if (exists.archivedAt) {
        return err("الموكل مؤرشف مسبقًا", 400);
      }

      const updated = await prisma.client.update({
        where: {
          id: exists.id,
        },
        data: {
          archivedAt: new Date(),
        },
      });

      await logActivity({
        tenantId: auth.user.tenantId,
        type: "CLIENT_ARCHIVED",
        title: "تمت أرشفة موكل",
        message: updated.name,
        entityType: "CLIENT",
        entityId: updated.id,
        actorId: auth.user.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return ok({
        ...decryptClient(updated),
        message: "تمت أرشفة الموكل بنجاح",
      });
    }

    if (body?.action === "restore") {
      if (!exists.archivedAt) {
        return err("الموكل غير مؤرشف", 400);
      }

      const restoreResult = await prisma.$transaction(async (tx) => {
        await lockTenantMutation(tx, auth.user.tenantId);

        const lockedClient = await tx.client.findFirst({
          where: buildClientIdentifierAccessWhere(id, auth.user),
          select: {
            id: true,
            archivedAt: true,
          },
        });

        if (!lockedClient) return { error: "NOT_FOUND" as const };
        if (!lockedClient.archivedAt) {
          return { error: "NOT_ARCHIVED" as const };
        }

        const lockedLimitCheck = await assertTenantCanCreate(
          auth.user.tenantId,
          "clients",
          tx,
        );

        if (!lockedLimitCheck.ok) {
          return {
            error: "LIMIT" as const,
            limitCheck: lockedLimitCheck,
          };
        }

        const updated = await tx.client.update({
          where: {
            id: lockedClient.id,
          },
          data: {
            archivedAt: null,
          },
        });

        await tx.activity.create({
          data: {
            tenantId: auth.user.tenantId,
            type: "CLIENT_RESTORED",
            title: "تمت استعادة موكل",
            message: updated.name,
            entityType: "CLIENT",
            entityId: updated.id,
            actorId: auth.user.userId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
          },
        });

        return { updated };
      });

      if ("error" in restoreResult) {
        if (restoreResult.error === "NOT_FOUND") {
          return notFound("الموكل غير موجود");
        }
        if (restoreResult.error === "NOT_ARCHIVED") {
          return err("الموكل غير مؤرشف", 409);
        }
        if (restoreResult.error === "LIMIT") {
          const lockedLimitCheck = restoreResult.limitCheck;
          const isPlanLimit = lockedLimitCheck.billing?.canCreate === true;

          return err(lockedLimitCheck.message, isPlanLimit ? 400 : 402, {
            code: isPlanLimit
              ? "PLAN_LIMIT_REACHED"
              : "SUBSCRIPTION_INACTIVE",
            resource: "clients",
            billing: lockedLimitCheck.billing ?? null,
          });
        }
      }

      const updated = restoreResult.updated;

      return ok({
        ...decryptClient(updated),
        message: "تمت استعادة الموكل بنجاح",
      });
    }

    const parsed = clientSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    const normalizedPhone = normalizePhone(parsed.data.phone);
    const normalizedNationalId = parsed.data.nationalId.trim();

    const emailHash = normalizedEmail ? hashSearchValue(normalizedEmail) : null;
    const phoneHash = normalizedPhone ? hashSearchValue(normalizedPhone) : null;
    const nationalIdHash = normalizedNationalId
      ? hashSearchValue(normalizedNationalId)
      : null;

    const duplicateConditions = [
      ...(phoneHash ? [{ phoneHash }] : []),
      ...(nationalIdHash ? [{ nationalIdHash }] : []),
      ...(emailHash ? [{ emailHash }] : []),
    ];

    const duplicateClient =
      duplicateConditions.length > 0
        ? await prisma.client.findFirst({
            where: {
              tenantId: auth.user.tenantId,
              NOT: {
                id: exists.id,
              },
              OR: duplicateConditions,
            },
            select: {
              id: true,
              name: true,
              archivedAt: true,
            },
          })
        : null;

    if (duplicateClient) {
      const duplicateIsVisible =
        (await prisma.client.count({
          where: buildClientIdentifierAccessWhere(
            duplicateClient.id,
            auth.user,
          ),
        })) > 0;

      return err(
        duplicateIsVisible
          ? duplicateClient.archivedAt
            ? "يوجد موكل مؤرشف بنفس البيانات. يمكنك استعادته بدل استخدام نفس البيانات."
            : "يوجد موكل آخر بنفس البيانات داخل المكتب."
          : "هذه البيانات مستخدمة داخل المكتب. تواصل مع مدير المكتب إذا احتجت الوصول للسجل.",
        409,
        {
          code: "CLIENT_DUPLICATE",
          ...(duplicateIsVisible
            ? {
                clientId: duplicateClient.id,
                archived: !!duplicateClient.archivedAt,
              }
            : {}),
        },
      );
    }

    const secureData = {
      ...parsed.data,
      email: encryptText(parsed.data.email || ""),
      phone: encryptText(parsed.data.phone),
      nationalId: encryptText(parsed.data.nationalId),
      address: encryptText(parsed.data.address || ""),
      notes: encryptText(parsed.data.notes || ""),
      emailHash,
      phoneHash,
      nationalIdHash,
    };

    const updated = await prisma.client.update({
      where: {
        id: exists.id,
      },
      data: secureData,
    });

    await logActivity({
      tenantId: auth.user.tenantId,
      type: "CLIENT_UPDATED",
      title: "تم تعديل بيانات موكل",
      message: updated.name,
      entityType: "CLIENT",
      entityId: updated.id,
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok(decryptClient(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "حذف موكل",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;

    const exists = await prisma.client.findFirst({
      where: buildClientIdentifierAccessWhere(id, auth.user),
      select: {
        id: true,
        name: true,
      },
    });

    if (!exists) {
      return notFound("الموكل غير موجود");
    }

    const [
      casesCount,
      appointmentsCount,
      documentsCount,
      tasksCount,
      invoicesCount,
    ] = await prisma.$transaction([
      prisma.case.count({
        where: {
          tenantId: auth.user.tenantId,
          clientId: exists.id,
        },
      }),
      prisma.appointment.count({
        where: {
          tenantId: auth.user.tenantId,
          clientId: exists.id,
        },
      }),
      prisma.document.count({
        where: {
          tenantId: auth.user.tenantId,
          clientId: exists.id,
        },
      }),
      prisma.task.count({
        where: {
          tenantId: auth.user.tenantId,
          clientId: exists.id,
        },
      }),
      prisma.invoice.count({
        where: {
          tenantId: auth.user.tenantId,
          clientId: exists.id,
        },
      }),
    ]);

    const relatedTotal =
      casesCount +
      appointmentsCount +
      documentsCount +
      tasksCount +
      invoicesCount;

    if (relatedTotal > 0) {
      return err(
        "لا يمكن حذف موكل لديه بيانات مرتبطة. يمكنك أرشفته بدل الحذف.",
        409,
        {
          cases: casesCount,
          appointments: appointmentsCount,
          documents: documentsCount,
          tasks: tasksCount,
          invoices: invoicesCount,
        },
      );
    }

    const deleted = await prisma.client.deleteMany({
      where: {
        id: exists.id,
        tenantId: auth.user.tenantId,
      },
    });

    if (deleted.count === 0) {
      return notFound("الموكل غير موجود");
    }

    await logActivity({
      tenantId: auth.user.tenantId,
      type: "CLIENT_DELETED",
      title: "تم حذف موكل",
      message: exists.name,
      entityType: "CLIENT",
      entityId: exists.id,
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return ok({
      deleted: true,
      message: "تم حذف الموكل بنجاح",
    });
  });
}
