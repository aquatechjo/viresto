import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import {
  buildPublicManualPaymentSettings,
  MANUAL_PAYMENT_SETTINGS_ID,
  normalizeManualPaymentMethod,
} from "@/lib/manual-payment-settings";
import {
  type PreparedUploadFile,
  prepareUploadFile,
} from "@/lib/server/compress-upload-image";
import {
  RECEIPT_UPLOAD_MIME_TYPES,
  validateUploadFileContent,
} from "@/lib/server/upload-file-security";
import {
  getBillingPlanConfig,
  parseBillingInterval,
} from "@/lib/subscription-consistency";
import { lockTenantMutation } from "@/lib/tenant-mutation-lock";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const STALE_UPLOAD_MINUTES = 15;
const OPEN_PAYMENT_STATUSES = ["UPLOADING", "PENDING", "PROCESSING"];

async function uploadReceiptToCloudinary(
  file: PreparedUploadFile,
  tenantId: string,
  reservationId: string,
) {
  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const KEY = process.env.CLOUDINARY_API_KEY;
  const SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD || !KEY || !SECRET) {
    throw new Error("Cloudinary environment variables are missing");
  }

  const ts = Math.floor(Date.now() / 1000);
  const folder = `Viresto/${tenantId}/receipts`;
  const uploadType = "authenticated";

  const str = `folder=${folder}&public_id=${reservationId}&timestamp=${ts}&type=${uploadType}${SECRET}`;

  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );

  const sig = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const fd = new FormData();
  const uploadBlob = new Blob([new Uint8Array(file.buffer)], {
    type: file.mimeType,
  });

  fd.append("file", uploadBlob, file.fileName);
  fd.append("api_key", KEY);
  fd.append("timestamp", String(ts));
  fd.append("signature", sig);
  fd.append("folder", folder);
  fd.append("public_id", reservationId);
  fd.append("type", uploadType);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`,
    {
      method: "POST",
      body: fd,
    },
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? "Failed to upload receipt");
  }

  return {
    secureUrl: String(data.secure_url),
    publicId: String(data.public_id),
    resourceType: String(data.resource_type || "image"),
  };
}

function expectedReceiptPublicId(tenantId: string, reservationId: string) {
  return `Viresto/${tenantId}/receipts/${reservationId}`;
}

async function cleanupReceiptAsset(
  publicId: string,
  resourceTypes: Array<"image" | "raw"> = ["image", "raw"],
) {
  for (const resourceType of resourceTypes) {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        type: "authenticated",
        invalidate: true,
      });
    } catch (error) {
      console.error("Manual payment receipt cleanup failed:", error);
    }
  }
}

async function markReservationFailed(
  reservationId: string,
  metadata: Record<string, unknown>,
  reason: string,
) {
  try {
    await prisma.subscriptionPayment.updateMany({
      where: {
        id: reservationId,
        status: "UPLOADING",
      },
      data: {
        status: "UPLOAD_FAILED",
        receiptUrl: null,
        receiptPublicId: null,
        raw: {
          ...metadata,
          uploadState: "FAILED",
          failureReason: reason,
          failedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Failed to mark manual payment reservation:", error);
  }
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const uploadLimit = await checkRateLimit(
      `${auth.user.tenantId}:${auth.user.userId}`,
      {
        keyPrefix: "manual-payment-upload",
        max: 5,
        windowMs: 60 * 60 * 1000,
      },
    );

    if (!uploadLimit.allowed) {
      return err("تم تجاوز عدد محاولات إرسال الإيصال. حاول لاحقًا.", 429);
    }

    const formData = await req.formData();

    const planId = String(formData.get("planId") || "").trim();
    const interval = parseBillingInterval(formData.get("interval"));
    const method = normalizeManualPaymentMethod(formData.get("method"));
    const receipt = formData.get("receipt");

    if (!planId) {
      return err("الخطة مطلوبة", 400);
    }

    if (!interval) {
      return err("دورة الاشتراك غير صحيحة", 400);
    }

    if (!method) {
      return err("طريقة الدفع غير صالحة", 400);
    }

    if (!(receipt instanceof File)) {
      return err("إيصال الدفع مطلوب", 400);
    }

    if (receipt.size <= 0) {
      return err("ملف الإيصال فارغ", 400);
    }

    if (receipt.size > MAX_RECEIPT_SIZE) {
      return err("حجم الإيصال يجب ألا يتجاوز 5MB", 400);
    }

    if (!RECEIPT_UPLOAD_MIME_TYPES.has(receipt.type)) {
      return err("نوع الملف غير مدعوم. ارفع صورة JPG/PNG/WebP أو PDF", 400);
    }

    let receiptBuffer: Buffer;

    try {
      receiptBuffer = Buffer.from(await receipt.arrayBuffer());
    } catch {
      return err("تعذر قراءة ملف الإيصال", 400);
    }

    const receiptValidation = await validateUploadFileContent({
      buffer: receiptBuffer,
      fileName: receipt.name,
      declaredMimeType: receipt.type,
      allowedMimeTypes: RECEIPT_UPLOAD_MIME_TYPES,
    });

    if (!receiptValidation.ok) {
      return err(receiptValidation.message, 400, {
        code: receiptValidation.code,
      });
    }

    let preparedReceipt: PreparedUploadFile;

    try {
      preparedReceipt = await prepareUploadFile(receipt, receiptBuffer);
    } catch {
      return err("تعذر تجهيز ملف الإيصال", 400);
    }

    const manualPaymentSettings =
      await prisma.manualPaymentSettings.findUnique({
        where: {
          id: MANUAL_PAYMENT_SETTINGS_ID,
        },
      });

    const publicPaymentSettings = buildPublicManualPaymentSettings(
      manualPaymentSettings,
    );

    if (!publicPaymentSettings.enabled) {
      return err("الدفع اليدوي غير متاح حاليًا", 409);
    }

    if (
      !publicPaymentSettings.methods.some(
        (configuredMethod) => configuredMethod.code === method,
      )
    ) {
      return err("طريقة الدفع المختارة غير مفعّلة", 400);
    }

    const plan = await prisma.billingPlan.findFirst({
      where: {
        id: planId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        currency: true,
        priceMonthly: true,
        priceYearly: true,
      },
    });

    if (!plan) {
      return err("الخطة غير موجودة أو غير فعالة", 404);
    }

    const configuredPlan = getBillingPlanConfig(plan.code, interval);

    if (!configuredPlan) {
      return err("رمز الخطة غير مدعوم", 409);
    }

    const amount = configuredPlan.amount;

    if (amount <= 0) {
      return err("سعر الخطة غير صالح", 400);
    }

    const reservationId = randomUUID();
    const reservationMetadata = {
      fileName: preparedReceipt.fileName,
      originalFileName: receipt.name,
      fileType: preparedReceipt.mimeType,
      fileSize: preparedReceipt.size,
      originalFileSize: receipt.size,
      compressed: preparedReceipt.wasCompressed,
      planCode: plan.code,
      planName: plan.name,
      interval,
      paymentMethod: method,
      pricingSnapshot: {
        version: 1,
        planId: plan.id,
        planCode: plan.code,
        amountMinor: amount,
        currency: configuredPlan.currency,
        interval,
      },
    };
    const staleBefore = new Date(
      Date.now() - STALE_UPLOAD_MINUTES * 60 * 1000,
    );

    const reservation = await prisma.$transaction(async (tx) => {
      await lockTenantMutation(tx, auth.user.tenantId);

      const staleReservations = await tx.subscriptionPayment.findMany({
        where: {
          tenantId: auth.user.tenantId,
          status: "UPLOADING",
          updatedAt: { lt: staleBefore },
        },
        select: { id: true },
      });

      if (staleReservations.length > 0) {
        await tx.subscriptionPayment.updateMany({
          where: {
            id: { in: staleReservations.map((item) => item.id) },
            status: "UPLOADING",
          },
          data: {
            status: "UPLOAD_FAILED",
            receiptUrl: null,
            receiptPublicId: null,
            adminNote: "انتهت مهلة رفع الإيصال قبل اكتمال الطلب",
          },
        });
      }

      const existing = await tx.subscriptionPayment.findFirst({
        where: {
          tenantId: auth.user.tenantId,
          status: { in: OPEN_PAYMENT_STATUSES },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true },
      });

      if (existing) {
        return {
          existing,
          payment: null,
          staleReservationIds: staleReservations.map((item) => item.id),
        };
      }

      const payment = await tx.subscriptionPayment.create({
        data: {
          id: reservationId,
          tenantId: auth.user.tenantId,
          requestedPlanId: plan.id,
          requestedInterval: interval,
          amount,
          currency: configuredPlan.currency,
          status: "UPLOADING",
          method,
          raw: {
            ...reservationMetadata,
            uploadState: "RESERVED",
            reservedAt: new Date().toISOString(),
          },
        },
        select: { id: true },
      });

      return {
        existing: null,
        payment,
        staleReservationIds: staleReservations.map((item) => item.id),
      };
    });

    await Promise.all(
      reservation.staleReservationIds.map((id) =>
        cleanupReceiptAsset(expectedReceiptPublicId(auth.user.tenantId, id)),
      ),
    );

    if (reservation.existing || !reservation.payment) {
      return err(
        "لديك طلب دفع مفتوح بالفعل. انتظر اكتمال الرفع أو مراجعة الإدارة قبل إرسال طلب جديد.",
        409,
        {
          paymentId: reservation.existing?.id,
          status: reservation.existing?.status,
          createdAt: reservation.existing?.createdAt,
        },
      );
    }

    let upload: Awaited<ReturnType<typeof uploadReceiptToCloudinary>>;

    try {
      upload = await uploadReceiptToCloudinary(
        preparedReceipt,
        auth.user.tenantId,
        reservation.payment.id,
      );
    } catch (error) {
      console.error("Manual payment receipt upload failed:", error);
      await markReservationFailed(
        reservation.payment.id,
        reservationMetadata,
        "CLOUDINARY_UPLOAD_FAILED",
      );
      return err("تعذر رفع إيصال الدفع. حاول مرة أخرى.", 502);
    }

    const result = await prisma
      .$transaction(async (tx) => {
        const finalized = await tx.subscriptionPayment.updateMany({
          where: {
            id: reservation.payment!.id,
            tenantId: auth.user.tenantId,
            status: "UPLOADING",
          },
          data: {
            status: "PENDING",
            receiptUrl: upload.secureUrl,
            receiptPublicId: upload.publicId,
            raw: {
              ...reservationMetadata,
              uploadState: "PENDING_REVIEW",
              resourceType: upload.resourceType,
              uploadedAt: new Date().toISOString(),
            },
          },
        });

        if (finalized.count !== 1) return null;

        await tx.activity.create({
          data: {
            tenantId: auth.user.tenantId,
            actorId: auth.user.userId,
            type: "MANUAL_PAYMENT_SUBMITTED",
            title: "تم إرسال طلب دفع يدوي",
            message: `${plan.name} (${interval})`,
            entityType: "SubscriptionPayment",
            entityId: reservation.payment!.id,
          },
        });

        return tx.subscriptionPayment.findUnique({
          where: { id: reservation.payment!.id },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            method: true,
            createdAt: true,
            requestedInterval: true,
            requestedPlan: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        });
      })
      .catch((error) => {
        console.error("Manual payment finalization failed:", error);
        return null;
      });

    if (!result) {
      await cleanupReceiptAsset(upload.publicId, [
        upload.resourceType === "raw" ? "raw" : "image",
      ]);
      await markReservationFailed(
        reservation.payment.id,
        reservationMetadata,
        "DATABASE_FINALIZATION_FAILED",
      );
      return err("تعذر تثبيت طلب الدفع. تم تنظيف الإيصال؛ حاول مرة أخرى.", 503);
    }

    return ok(
      {
        payment: result,
        message:
          "تم إرسال إيصال الدفع بنجاح. طلبك الآن بانتظار مراجعة الإدارة.",
      },
      201,
    );
  });
}
