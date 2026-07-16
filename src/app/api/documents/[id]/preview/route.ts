import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { logActivity } from "@/lib/activity";
import {
  type CloudinaryResourceType,
  fetchAuthenticatedCloudinaryAsset,
  isTenantCloudinaryAsset,
  streamPrivateAsset,
} from "@/lib/cloudinary";
import { buildDocumentAccessWhere } from "@/lib/access-control";

type Params = { params: Promise<{ id: string }> };

function getResourceTypes(
  fileType?: string | null,
): CloudinaryResourceType[] {
  if (fileType?.startsWith("video/")) return ["video"];
  if (fileType?.startsWith("image/")) return ["image"];
  if (fileType === "application/pdf") return ["image"];
  return ["raw", "image"];
}

function canRenderInline(fileType?: string | null) {
  return Boolean(
    fileType === "application/pdf" || fileType?.startsWith("image/"),
  );
}

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const { id } = await params;

    const doc = await prisma.document.findFirst({
      where: buildDocumentAccessWhere(auth.user, { id }),
      select: {
        id: true,
        fileName: true,
        fileType: true,
        publicId: true,
        caseId: true,
      },
    });

    if (!doc?.publicId) {
      return NextResponse.json(
        { message: "المستند غير موجود" },
        { status: 404 },
      );
    }

    if (!isTenantCloudinaryAsset(doc.publicId, auth.user.tenantId)) {
      console.error("Rejected document with invalid Cloudinary tenant prefix", {
        documentId: doc.id,
        tenantId: auth.user.tenantId,
      });

      return NextResponse.json(
        { message: "مسار تخزين المستند غير صالح" },
        { status: 403 },
      );
    }

    const range = req.headers.get("range");
    const upstream = await fetchAuthenticatedCloudinaryAsset({
      publicId: doc.publicId,
      fileType: doc.fileType,
      resourceTypes: getResourceTypes(doc.fileType),
      range,
    });

    if (!upstream) {
      return NextResponse.json(
        { message: "تعذر تحميل المستند من التخزين" },
        { status: 404 },
      );
    }

    if (!range || range.startsWith("bytes=0-")) {
      const meta = getRequestMeta(req);

      await logActivity({
        tenantId: auth.user.tenantId,
        actorId: auth.user.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        type: "DOCUMENT_VIEWED",
        title: "تم فتح مستند",
        message: doc.fileName,
        entityType: doc.caseId ? "CASE" : "DOCUMENT",
        entityId: doc.caseId || doc.id,
      });
    }

    const forceDownload = new URL(req.url).searchParams.get("download") === "1";

    return streamPrivateAsset(upstream, {
      fileName: doc.fileName,
      fallbackContentType: doc.fileType,
      disposition:
        forceDownload || !canRenderInline(doc.fileType)
          ? "attachment"
          : "inline",
    });
  });
}
