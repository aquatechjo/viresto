export const runtime = "nodejs";

import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import cloudinary, {
  fetchAuthenticatedCloudinaryAsset,
} from "@/lib/cloudinary";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import {
  assertTenantCanCreate,
  assertTenantCanUseStorage,
} from "@/lib/billing-limits";
import {
  DOCUMENT_MAX_STORED_BYTES,
  documentUploadCompletionSchema,
  isExpectedCloudinaryResourceType,
  isTrustedCloudinaryUrl,
  type CloudinaryResourceType,
} from "@/lib/document-upload";
import {
  DOCUMENT_UPLOAD_MIME_TYPES,
  validateUploadFileContent,
} from "@/lib/server/upload-file-security";
import { buildCaseAccessWhere } from "@/lib/access-control";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";

type StoredDocument = Awaited<ReturnType<typeof findStoredDocument>>;

function safeSignatureEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function cleanupUploadedAsset(
  publicId: string,
  resourceType: CloudinaryResourceType,
) {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      invalidate: true,
    });
  } catch (error) {
    console.error("Cloudinary cleanup failed after document upload:", error);
  }
}

function findStoredDocument(tenantId: string, publicId: string) {
  return prisma.document.findFirst({
    where: {
      tenantId,
      publicId,
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
}

function documentResponse(doc: NonNullable<StoredDocument>, status = 201) {
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
    },
    status,
  );
}

function matchesUploadIntent(
  doc: NonNullable<StoredDocument>,
  intent: {
    caseId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  },
) {
  return (
    doc.caseId === intent.caseId &&
    doc.fileName === intent.fileName &&
    doc.fileType === intent.mimeType &&
    doc.fileSize === intent.fileSize
  );
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
    const SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!CLOUD || !SECRET) {
      return err("رفع الملفات غير مُهيأ", 503);
    }

    const parsed = documentUploadCompletionSchema.safeParse(
      await req.json().catch(() => null),
    );

    if (!parsed.success) {
      return err("بيانات إتمام رفع الملف غير صالحة", 400, parsed.error.flatten());
    }

    const intent = parsed.data;
    const uploaded = intent.upload;
    const expectedPrefix = `Viresto/${auth.user.tenantId}/documents/`;
    const trustedLocation =
      uploaded.publicId.startsWith(expectedPrefix) &&
      isTrustedCloudinaryUrl(uploaded.secureUrl, CLOUD) &&
      isExpectedCloudinaryResourceType(
        intent.mimeType,
        uploaded.resourceType,
      ) &&
      uploaded.bytes === intent.fileSize;

    const expectedSignature = cloudinary.utils.api_sign_request(
      {
        public_id: uploaded.publicId,
        version: uploaded.version,
      },
      SECRET,
    );
    const signatureValid = safeSignatureEqual(
      uploaded.signature,
      expectedSignature,
    );

    if (!trustedLocation || !signatureValid) {
      return err("استجابة تخزين الملف غير موثوقة", 400);
    }

    const caseRecord = await prisma.case.findFirst({
      where: buildCaseAccessWhere(auth.user, { id: intent.caseId }),
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

    if (!caseRecord) {
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
      return err("القضية غير موجودة أو لا تتبع لهذا المكتب", 404);
    }

    if (caseRecord.client.archivedAt) {
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
      return err("لا يمكن رفع مستند لقضية موكلها مؤرشف", 409);
    }

    const existingDocument = await findStoredDocument(
      auth.user.tenantId,
      uploaded.publicId,
    );

    if (existingDocument) {
      if (!matchesUploadIntent(existingDocument, intent)) {
        return err("تم تسجيل أصل الملف مسبقًا ببيانات مختلفة", 409);
      }

      return documentResponse(existingDocument, 200);
    }

    const documentsLimitCheck = await assertTenantCanCreate(
      auth.user.tenantId,
      "documents",
    );

    if (!documentsLimitCheck.ok) {
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
      const isPlanLimit = documentsLimitCheck.billing?.canCreate === true;

      return err(documentsLimitCheck.message, isPlanLimit ? 400 : 402, {
        code: isPlanLimit ? "PLAN_LIMIT_REACHED" : "SUBSCRIPTION_INACTIVE",
        resource: "documents",
        billing: documentsLimitCheck.billing ?? null,
      });
    }

    const storageLimitCheck = await assertTenantCanUseStorage(
      auth.user.tenantId,
      uploaded.bytes,
    );

    if (!storageLimitCheck.ok) {
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
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

    const storedAsset = await fetchAuthenticatedCloudinaryAsset({
      publicId: uploaded.publicId,
      fileType: intent.mimeType,
      resourceTypes: [uploaded.resourceType],
    });

    if (!storedAsset) {
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
      return err("تعذر التحقق من الملف المرفوع", 502);
    }

    const announcedLength = Number(
      storedAsset.headers.get("content-length") || 0,
    );

    if (
      announcedLength > DOCUMENT_MAX_STORED_BYTES ||
      (announcedLength > 0 && announcedLength !== uploaded.bytes)
    ) {
      await storedAsset.body?.cancel().catch(() => undefined);
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
      return err("حجم الملف المخزن لا يطابق عملية الرفع", 400);
    }

    let storedBuffer: Buffer;

    try {
      storedBuffer = Buffer.from(await storedAsset.arrayBuffer());
    } catch {
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
      return err("تعذر قراءة الملف المخزن للتحقق منه", 502);
    }

    if (
      storedBuffer.length <= 0 ||
      storedBuffer.length > DOCUMENT_MAX_STORED_BYTES ||
      storedBuffer.length !== uploaded.bytes
    ) {
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
      return err("حجم الملف المخزن غير صالح", 400);
    }

    const contentValidation = await validateUploadFileContent({
      buffer: storedBuffer,
      fileName: intent.fileName,
      declaredMimeType: intent.mimeType,
      allowedMimeTypes: DOCUMENT_UPLOAD_MIME_TYPES,
    });

    if (!contentValidation.ok) {
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
      return err(contentValidation.message, 400, {
        code: contentValidation.code,
      });
    }

    const meta = getRequestMeta(req);
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
          uploaded.bytes,
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
            fileName: intent.fileName,
            fileType: intent.mimeType,
            fileUrl: uploaded.secureUrl,
            fileSize: uploaded.bytes,
            publicId: uploaded.publicId,
            notes: intent.notes || null,
            tags: intent.tags,
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
            message: `${intent.fileName} — ${lockedCase.title}`,
            entityType: "CASE",
            entityId: lockedCase.id,
          },
        });

        return { doc };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const racedDocument = await findStoredDocument(
          auth.user.tenantId,
          uploaded.publicId,
        );

        if (racedDocument) {
          if (!matchesUploadIntent(racedDocument, intent)) {
            return err("تم تسجيل أصل الملف مسبقًا ببيانات مختلفة", 409);
          }

          return documentResponse(racedDocument, 200);
        }
      }

      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);
      throw error;
    }

    if ("error" in finalizeResult) {
      await cleanupUploadedAsset(uploaded.publicId, uploaded.resourceType);

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

    return documentResponse(finalizeResult.doc);
  });
}
