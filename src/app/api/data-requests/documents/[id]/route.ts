import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requirePermission } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/log-activity";
import { DOCUMENT_FILE_EXPORT_RATE_LIMIT } from "@/lib/expensive-route-limits";
import {
  type CloudinaryResourceType,
  fetchAuthenticatedCloudinaryAsset,
  isTenantCloudinaryAsset,
  streamPrivateAsset,
} from "@/lib/cloudinary";

// AUDIT_REPORT.md M4: the office ADMIN downloads one document file, also
// while the office is locked (the regular preview route answers 402 then).
// Always an attachment; each download is logged.

type Params = { params: Promise<{ id: string }> };

function getResourceTypes(fileType?: string | null): CloudinaryResourceType[] {
  if (fileType?.startsWith("video/")) return ["video"];
  if (fileType?.startsWith("image/")) return ["image"];
  if (fileType === "application/pdf") return ["image"];
  return ["raw", "image"];
}

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requirePermission(req, "office.data.manage");
    if (auth.error || !auth.user) return auth.error;

    const { id } = await params;
    const { tenantId, userId } = auth.user;

    const doc = await prisma.document.findFirst({
      where: { id, tenantId },
      select: { id: true, fileName: true, fileType: true, publicId: true },
    });
    if (!doc?.publicId) return notFound("المستند غير موجود");

    if (!isTenantCloudinaryAsset(doc.publicId, tenantId)) {
      console.error("Rejected document export with invalid Cloudinary tenant prefix", {
        documentId: doc.id,
        tenantId,
      });
      return err("مسار تخزين المستند غير صالح", 403);
    }

    const limit = await checkRateLimit(tenantId, DOCUMENT_FILE_EXPORT_RATE_LIMIT);
    if (!limit.allowed) {
      return err("تم تجاوز عدد تنزيلات الملفات المسموح، حاول بعد ساعة", 429);
    }

    const upstream = await fetchAuthenticatedCloudinaryAsset({
      publicId: doc.publicId,
      fileType: doc.fileType,
      resourceTypes: getResourceTypes(doc.fileType),
    });
    if (!upstream) return err("تعذر تحميل المستند من التخزين", 502);

    await logActivity({
      req,
      tenantId,
      actorId: userId,
      type: "DOCUMENT_FILE_EXPORTED",
      title: "تم تنزيل ملف مستند ضمن تصدير بيانات المكتب",
      message: doc.fileName,
      entityType: "DOCUMENT",
      entityId: doc.id,
    });

    return streamPrivateAsset(upstream, {
      fileName: doc.fileName,
      fallbackContentType: doc.fileType,
      disposition: "attachment",
    });
  });
}
