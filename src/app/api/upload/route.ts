export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import {
  assertTenantCanCreate,
  assertTenantCanUseStorage,
} from "@/lib/billing-limits";

import {
  prepareUploadFile,
  validatePreparedUploadSize,
} from "@/lib/server/compress-upload-image";
import {
  DOCUMENT_UPLOAD_MIME_TYPES,
  validateUploadFileContent,
} from "@/lib/server/upload-file-security";
import { buildCaseAccessWhere } from "@/lib/access-control";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_INPUT_SIZE_BYTES = 25 * 1024 * 1024;

const compressibleImageTypes = ["image/png", "image/jpeg", "image/webp"];

type CloudinaryResourceType = "image" | "raw" | "video";

function isCompressibleImageType(type: string) {
  return compressibleImageTypes.includes(type);
}

function getCloudinaryResourceType(
  value: unknown,
): CloudinaryResourceType | null {
  return value === "image" || value === "raw" || value === "video"
    ? value
    : null;
}

function isTrustedCloudinaryUrl(value: unknown, cloudName: string) {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.startsWith(`/${cloudName}/`)
    );
  } catch {
    return false;
  }
}

async function cleanupUploadedAsset(
  publicId: string,
  resourceType: CloudinaryResourceType,
) {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: "authenticated",
    });
  } catch (error) {
    console.error("Cloudinary cleanup failed after document upload:", error);
  }
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const meta = getRequestMeta(req);

    const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
    const KEY = process.env.CLOUDINARY_API_KEY;
    const SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!CLOUD || !KEY || !SECRET) {
      return err("رفع الملفات غير مُهيأ", 503);
    }

    const form = await req.formData();

    const fileValue = form.get("file");
    const file = fileValue instanceof File ? fileValue : null;

    const caseIdRaw = form.get("caseId");
    const notesRaw = form.get("notes");
    const tagsRaw = form.get("tags");

    const caseId = typeof caseIdRaw === "string" ? caseIdRaw.trim() : "";
    const notes = typeof notesRaw === "string" ? notesRaw : null;
    const tagsValue = typeof tagsRaw === "string" ? tagsRaw : null;

    if (!file) return err("لم يتم إرسال ملف", 400);

    if (file.size <= 0) {
      return err("لا يمكن رفع ملف فارغ", 400);
    }

    if (!caseId) {
      return err("يجب اختيار قضية قبل رفع المستند", 400);
    }

    if (!DOCUMENT_UPLOAD_MIME_TYPES.has(file.type)) {
      return err(
        "نوع الملف غير مسموح. الرجاء رفع PDF أو صورة أو ملف DOCX فقط.",
        400,
      );
    }

    if (file.name.length > 180) {
      return err("اسم الملف طويل جدًا", 400);
    }

    const isImage = isCompressibleImageType(file.type);

    if (!isImage && file.size > MAX_UPLOAD_SIZE_BYTES) {
      return err("حجم الملف يتجاوز 10 ميجابايت", 400);
    }

    if (isImage && file.size > MAX_IMAGE_INPUT_SIZE_BYTES) {
      return err("حجم الصورة كبير جدًا. الحد الأقصى للصور قبل الضغط هو 25 ميجابايت", 400);
    }

    let originalBuffer: Buffer;

    try {
      originalBuffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return err("تعذر قراءة الملف المرفوع", 400);
    }

    const contentValidation = await validateUploadFileContent({
      buffer: originalBuffer,
      fileName: file.name,
      declaredMimeType: file.type,
      allowedMimeTypes: DOCUMENT_UPLOAD_MIME_TYPES,
    });

    if (!contentValidation.ok) {
      return err(contentValidation.message, 400, {
        code: contentValidation.code,
      });
    }

    let preparedFile;

    try {
      preparedFile = await prepareUploadFile(file, originalBuffer);
    } catch {
      return err("فشل تجهيز الملف قبل الرفع", 400);
    }

    if (!validatePreparedUploadSize(preparedFile)) {
      return err("حجم الملف بعد المعالجة يتجاوز الحد المسموح 10 ميجابايت", 400);
    }

    let tags: string[] = [];

    if (tagsValue) {
      try {
        const parsed = JSON.parse(tagsValue);
        tags = Array.isArray(parsed)
          ? parsed
              .map(String)
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 10)
              .map((t) => t.slice(0, 50))
          : [];
      } catch {
        return err("صيغة التصنيفات غير صحيحة", 400);
      }
    }

    const caseRecord = await prisma.case.findFirst({
      where: buildCaseAccessWhere(auth.user, { id: caseId }),
      select: {
        id: true,
        title: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
          },
        },
      },
    });

    if (!caseRecord) {
      return err("القضية غير موجودة أو لا تتبع لهذا المكتب", 404);
    }

    if (caseRecord.client?.archivedAt) {
      return err("لا يمكن رفع مستند لقضية موكلها مؤرشف", 400);
    }

    const documentsLimitCheck = await assertTenantCanCreate(
      auth.user.tenantId,
      "documents",
    );

    if (!documentsLimitCheck.ok) {
      const isPlanLimit = documentsLimitCheck.billing?.canCreate === true;

      return err(documentsLimitCheck.message, isPlanLimit ? 400 : 402, {
        code: isPlanLimit ? "PLAN_LIMIT_REACHED" : "SUBSCRIPTION_INACTIVE",
        resource: "documents",
        billing: documentsLimitCheck.billing ?? null,
      });
    }

    const storageLimitCheck = await assertTenantCanUseStorage(
      auth.user.tenantId,
      preparedFile.size,
    );

    if (!storageLimitCheck.ok) {
      const isStorageLimit = storageLimitCheck.billing?.canCreate === true;

      return err(storageLimitCheck.message, isStorageLimit ? 400 : 402, {
        code: isStorageLimit
          ? "STORAGE_LIMIT_REACHED"
          : "SUBSCRIPTION_INACTIVE",
        resource: "storage",
        billing: storageLimitCheck.billing ?? null,
        usedBytes: storageLimitCheck.usedBytes,
        incomingBytes: storageLimitCheck.incomingBytes,
        limitBytes: storageLimitCheck.limitBytes,
      });
    }

    const ts = Math.floor(Date.now() / 1000);
    const folder = `Viresto/${auth.user.tenantId}`;
    const uploadType = "authenticated";

    const str = `folder=${folder}&timestamp=${ts}&type=${uploadType}${SECRET}`;

    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(str),
    );

    const sig = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const uploadBlob = new Blob([new Uint8Array(preparedFile.buffer)], {
      type: preparedFile.mimeType,
    });

    const fd = new FormData();
    fd.append("file", uploadBlob, preparedFile.fileName);
    fd.append("api_key", KEY);
    fd.append("timestamp", String(ts));
    fd.append("signature", sig);
    fd.append("folder", folder);
    fd.append("type", uploadType);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`,
      {
        method: "POST",
        body: fd,
      },
    );

    const d = await res.json();

    if (!res.ok) {
      return err(d.error?.message ?? "فشل رفع الملف", 500);
    }

    const publicId =
      typeof d.public_id === "string" ? d.public_id.trim() : null;
    const secureUrl =
      typeof d.secure_url === "string" ? d.secure_url.trim() : null;
    const resourceType = getCloudinaryResourceType(d.resource_type);
    const storedSize = Number.isSafeInteger(d.bytes) ? Number(d.bytes) : null;
    const expectedPublicIdPrefix = `${folder}/`;

    const isValidUpload =
      publicId?.startsWith(expectedPublicIdPrefix) === true &&
      isTrustedCloudinaryUrl(secureUrl, CLOUD) &&
      resourceType !== null &&
      storedSize !== null &&
      storedSize > 0 &&
      storedSize <= MAX_UPLOAD_SIZE_BYTES;

    if (
      !isValidUpload ||
      !publicId ||
      !secureUrl ||
      !resourceType ||
      !storedSize
    ) {
      if (publicId?.startsWith(expectedPublicIdPrefix) && resourceType) {
        await cleanupUploadedAsset(publicId, resourceType);
      }

      return err("استجابة تخزين الملف غير صالحة", 502);
    }

    let finalizeResult;

    try {
      finalizeResult = await prisma.$transaction(async (tx) => {
        await lockTenantMutation(tx, auth.user.tenantId);

        const lockedDocumentsLimit = await assertTenantCanCreate(
          auth.user.tenantId,
          "documents",
          tx,
        );

        if (!lockedDocumentsLimit.ok) {
          return {
            error: "DOCUMENT_LIMIT" as const,
            limitCheck: lockedDocumentsLimit,
          };
        }

        const lockedStorageLimit = await assertTenantCanUseStorage(
          auth.user.tenantId,
          storedSize,
          tx,
        );

        if (!lockedStorageLimit.ok) {
          return {
            error: "STORAGE_LIMIT" as const,
            limitCheck: lockedStorageLimit,
          };
        }

        const lockedCase = await tx.case.findFirst({
          where: buildCaseAccessWhere(auth.user, { id: caseRecord.id }),
          select: {
            id: true,
            title: true,
            clientId: true,
            client: {
              select: {
                archivedAt: true,
              },
            },
          },
        });

        if (!lockedCase) return { error: "CASE_NOT_FOUND" as const };
        if (lockedCase.client.archivedAt) {
          return { error: "CLIENT_ARCHIVED" as const };
        }

        const doc = await tx.document.create({
          data: {
            tenantId: auth.user.tenantId,
            clientId: lockedCase.clientId,
            caseId: lockedCase.id,
            fileName: preparedFile.fileName,
            fileType: preparedFile.mimeType,
            fileUrl: secureUrl,
            fileSize: storedSize,
            publicId,
            notes: notes?.trim().slice(0, 1000) || null,
            tags,
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

        await tx.activity.create({
          data: {
            actorId: auth.user.userId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            tenantId: auth.user.tenantId,
            type: "DOCUMENT_UPLOADED",
            title: "تم رفع مستند",
            message: `${preparedFile.fileName} — ${lockedCase.title}`,
            entityType: "CASE",
            entityId: lockedCase.id,
          },
        });

        return { doc };
      });
    } catch (error) {
      await cleanupUploadedAsset(publicId, resourceType);
      throw error;
    }

    if ("error" in finalizeResult) {
      await cleanupUploadedAsset(publicId, resourceType);

      if (finalizeResult.error === "DOCUMENT_LIMIT") {
        const lockedLimitCheck = finalizeResult.limitCheck;
        const isPlanLimit = lockedLimitCheck.billing?.canCreate === true;

        return err(lockedLimitCheck.message, isPlanLimit ? 400 : 402, {
          code: isPlanLimit
            ? "PLAN_LIMIT_REACHED"
            : "SUBSCRIPTION_INACTIVE",
          resource: "documents",
          billing: lockedLimitCheck.billing ?? null,
        });
      }

      if (finalizeResult.error === "STORAGE_LIMIT") {
        const lockedLimitCheck = finalizeResult.limitCheck;
        const isStorageLimit = lockedLimitCheck.billing?.canCreate === true;

        return err(lockedLimitCheck.message, isStorageLimit ? 400 : 402, {
          code: isStorageLimit
            ? "STORAGE_LIMIT_REACHED"
            : "SUBSCRIPTION_INACTIVE",
          resource: "storage",
          billing: lockedLimitCheck.billing ?? null,
          usedBytes: lockedLimitCheck.usedBytes,
          incomingBytes: lockedLimitCheck.incomingBytes,
          limitBytes: lockedLimitCheck.limitBytes,
        });
      }

      if (finalizeResult.error === "CASE_NOT_FOUND") {
        return err("القضية غير موجودة أو لا تتبع لهذا المكتب", 404);
      }

      return err("لا يمكن رفع مستند لقضية موكلها مؤرشف", 409);
    }

    const doc = finalizeResult.doc;

    return ok(
      {
        document: {
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
        compression: {
          wasCompressed: preparedFile.wasCompressed,
          originalSize: preparedFile.originalSize,
          finalSize: preparedFile.size,
        },
      },
      201,
    );
  });
}
