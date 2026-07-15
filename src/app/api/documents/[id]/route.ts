import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, notFound } from "@/lib/api-response";
import cloudinary from "@/lib/cloudinary";
import { logActivity } from "@/lib/activity";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";

type Params = { params: Promise<{ id: string }> };

function getResourceType(fileType?: string | null): "image" | "raw" | "video" {
  if (fileType?.startsWith("image/")) return "image";
  if (fileType === "application/pdf") return "image";
  if (fileType?.startsWith("video/")) return "video";
  return "raw";
}

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const { id } = await params;

    const doc = await prisma.document.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        publicId: true,
      },
    });

    if (!doc) {
      return notFound("المستند غير موجود");
    }

    if (!doc.publicId) {
      return notFound("رابط المستند غير متاح");
    }

    return ok({
      url: `/api/documents/${doc.id}/preview`,
      fileName: doc.fileName,
    });
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "حذف مستند",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const meta = getRequestMeta(req);
    const { id } = await params;

    const exists = await prisma.document.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        publicId: true,
        caseId: true,
        clientId: true,
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
      return notFound("المستند غير موجود");
    }

    const isArchivedClient = Boolean(
      exists.client?.archivedAt || exists.case?.client?.archivedAt,
    );

    if (isArchivedClient) {
      return err("لا يمكن حذف مستند مرتبط بموكل مؤرشف", 400);
    }

    if (exists.publicId) {
      try {
        await cloudinary.uploader.destroy(exists.publicId, {
          resource_type: getResourceType(exists.fileType),
          type: "authenticated",
        });
      } catch (e) {
        console.error("Cloudinary delete failed:", e);
      }
    }

    const deleted = await prisma.document.deleteMany({
      where: {
        id: exists.id,
        tenantId: auth.user.tenantId,
      },
    });

    if (deleted.count === 0) {
      return notFound("المستند غير موجود");
    }

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: "DOCUMENT_DELETED",
      title: exists.caseId ? "تم حذف مستند من القضية" : "تم حذف مستند",
      message: exists.fileName,
      entityType: exists.caseId ? "CASE" : "DOCUMENT",
      entityId: exists.caseId || exists.id,
    });

    return ok({ deleted: true });
  });
}
