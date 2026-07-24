export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { requireRole } from "@/lib/api-auth";
import {
  assertTenantCanCreate,
  assertTenantCanUseStorage,
} from "@/lib/billing-limits";
import { documentUploadIntentSchema } from "@/lib/document-upload";
import { buildCaseAccessWhere } from "@/lib/access-control";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
    const KEY = process.env.CLOUDINARY_API_KEY;
    const SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!CLOUD || !KEY || !SECRET) {
      return err("رفع الملفات غير مُهيأ", 503);
    }

    const uploadLimit = await checkRateLimit(
      `${auth.user.tenantId}:${auth.user.userId}`,
      {
        keyPrefix: "document-upload-sign",
        max: 30,
        windowMs: 60 * 60 * 1000,
      },
    );

    if (!uploadLimit.allowed) {
      return err("تم تجاوز عدد محاولات رفع الملفات. حاول لاحقًا.", 429);
    }

    const parsed = documentUploadIntentSchema.safeParse(
      await req.json().catch(() => null),
    );

    if (!parsed.success) {
      return err("بيانات الملف غير صالحة", 400, parsed.error.flatten());
    }

    const intent = parsed.data;
    const caseRecord = await prisma.case.findFirst({
      where: buildCaseAccessWhere(auth.user, { id: intent.caseId }),
      select: {
        id: true,
        client: {
          select: {
            archivedAt: true,
          },
        },
      },
    });

    if (!caseRecord) {
      return err("القضية غير موجودة أو لا تتبع لهذا المكتب", 404);
    }

    if (caseRecord.client.archivedAt) {
      return err("لا يمكن رفع مستند لقضية موكلها مؤرشف", 409);
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
      intent.fileSize,
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

    const timestamp = Math.floor(Date.now() / 1_000);
    const folder = `Viresto/${auth.user.tenantId}/documents`;
    const publicId = randomUUID();
    const type = "authenticated" as const;
    const signature = cloudinary.utils.api_sign_request(
      {
        folder,
        overwrite: false,
        public_id: publicId,
        timestamp,
        type,
      },
      SECRET,
    );

    return ok({
      uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`,
      apiKey: KEY,
      timestamp,
      signature,
      folder,
      publicId,
      type,
    });
  });
}
