import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { documentSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { logActivity } from "@/lib/log-activity";
import { assertTenantCanCreate } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";
import { createTenantNotification } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const sp = new URL(req.url).searchParams;
    const caseId = sp.get("caseId");
    const clientId = sp.get("clientId");

    const limitRaw = Number(sp.get("limit") || 20);

    const limit = Number.isNaN(limitRaw)
      ? 20
      : Math.min(Math.max(limitRaw, 1), 50);

    if (caseId) {
      const caseExists = await prisma.case.findFirst({
        where: {
          id: caseId,
          tenantId: auth.user.tenantId,
        },
        select: { id: true },
      });

      if (!caseExists) {
        return err("القضية غير موجودة داخل هذا المكتب", 404);
      }
    }

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: {
          id: clientId,
          tenantId: auth.user.tenantId,
        },
        select: { id: true },
      });

      if (!clientExists) {
        return err("الموكل غير موجود داخل هذا المكتب", 404);
      }
    }

    const data = await prisma.document.findMany({
      where: {
        tenantId: auth.user.tenantId,
        ...(caseId ? { caseId } : {}),
        ...(clientId ? { clientId } : {}),
      },
      take: limit,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        notes: true,
        tags: true,
        createdAt: true,
        clientId: true,
        caseId: true,
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
      orderBy: { createdAt: "desc" },
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

    const limitCheck = await assertTenantCanCreate(
      auth.user.tenantId,
      "documents",
    );

    if (!limitCheck.ok) {
      const isPlanLimit = limitCheck.billing?.canCreate === true;

      return err(limitCheck.message, isPlanLimit ? 400 : 402, {
        code: isPlanLimit ? "PLAN_LIMIT_REACHED" : "SUBSCRIPTION_INACTIVE",
        resource: "documents",
        billing: limitCheck.billing ?? null,
      });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = documentSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    const { caseId, clientId: _ignoredClientId, ...documentData } = parsed.data;

    if (!caseId) {
      return err("يجب ربط المستند بقضية", 400);
    }

    const linkedCase = await prisma.case.findFirst({
      where: {
        id: caseId,
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

    if (!linkedCase) {
      return err("القضية غير موجودة أو لا تتبع هذا المكتب", 403);
    }

    if (linkedCase.client?.archivedAt) {
      return err("لا يمكن رفع مستند لقضية موكلها مؤرشف", 400);
    }
    const doc = await prisma.document.create({
      data: {
        tenantId: auth.user.tenantId,
        ...documentData,
        caseId: linkedCase.id,
        clientId: linkedCase.clientId,
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
      req,
      tenantId: auth.user.tenantId,
      actorId: auth.user.userId,
      type: "DOCUMENT_UPLOADED",
      title: "تم رفع مستند جديد",
      message: doc.fileName,
      entityType: "DOCUMENT",
      entityId: doc.id,
    });

    await createTenantNotification({
      tenantId: auth.user.tenantId,
      type: NotificationType.DOCUMENT,
      titleAr: "تم رفع مستند جديد",
      titleEn: "New document uploaded",
      messageAr: `تم رفع المستند ${doc.fileName}${doc.case?.title ? ` للقضية ${doc.case.title}` : ""}.`,
      messageEn: `The document ${doc.fileName} was uploaded${doc.case?.title ? ` for case ${doc.case.title}` : ""}.`,
      href: "/dashboard/documents",
    }).catch(() => null);

    return ok(
      {
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        notes: doc.notes,
        tags: doc.tags,
        createdAt: doc.createdAt,
        clientId: doc.clientId,
        caseId: doc.caseId,
        client: doc.client,
        case: doc.case,
      },
      201,
    );
  });
}
