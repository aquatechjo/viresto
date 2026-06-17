import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTenantCanWrite } from "@/lib/billing-limits";
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

type Params = { params: Promise<{ id: string }> };

function decryptClient<T extends {
  email?: string | null;
  phone?: string | null;
  nationalId?: string | null;
  address?: string | null;
  notes?: string | null;
}>(client: T) {
  return {
    ...client,
    email: decryptText(client.email),
    phone: decryptText(client.phone),
    nationalId: decryptText(client.nationalId),
    address: decryptText(client.address),
    notes: decryptText(client.notes),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      include: {
        cases: {
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
          orderBy: {
            startTime: "desc",
          },
          take: 5,
        },
        tasks: {
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

    return ok(decryptClient(client));
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
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
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

      const updated = await prisma.client.update({
        where: {
          id: exists.id,
        },
        data: {
          archivedAt: null,
        },
      });

      await logActivity({
        tenantId: auth.user.tenantId,
        type: "CLIENT_RESTORED",
        title: "تمت استعادة موكل",
        message: updated.name,
        entityType: "CLIENT",
        entityId: updated.id,
        actorId: auth.user.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

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
      return err(
        duplicateClient.archivedAt
          ? "يوجد موكل مؤرشف بنفس البيانات. يمكنك استعادته بدل استخدام نفس البيانات."
          : "يوجد موكل آخر بنفس البيانات داخل المكتب.",
        409,
        {
          code: "CLIENT_DUPLICATE",
          clientId: duplicateClient.id,
          archived: !!duplicateClient.archivedAt,
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
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
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