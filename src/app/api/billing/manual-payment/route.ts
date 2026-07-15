import { NextRequest } from "next/server";
import { BillingInterval } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import {
  buildPublicManualPaymentSettings,
  MANUAL_PAYMENT_SETTINGS_ID,
  normalizeManualPaymentMethod,
} from "@/lib/manual-payment-settings";

export const runtime = "nodejs";

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

const ALLOWED_RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function normalizeInterval(value: FormDataEntryValue | null): BillingInterval {
  return value === "YEARLY" ? "YEARLY" : "MONTHLY";
}

async function uploadReceiptToCloudinary(file: File, tenantId: string) {
  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const KEY = process.env.CLOUDINARY_API_KEY;
  const SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD || !KEY || !SECRET) {
    throw new Error("Cloudinary environment variables are missing");
  }

  const ts = Math.floor(Date.now() / 1000);
  const folder = `Viresto/${tenantId}/receipts`;
  const uploadType = "authenticated";

  const str = `folder=${folder}&timestamp=${ts}&type=${uploadType}${SECRET}`;

  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );

  const sig = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const fd = new FormData();
  fd.append("file", file);
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

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const formData = await req.formData();

    const planId = String(formData.get("planId") || "").trim();
    const interval = normalizeInterval(formData.get("interval"));
    const method = normalizeManualPaymentMethod(formData.get("method"));
    const receipt = formData.get("receipt");

    if (!planId) {
      return err("الخطة مطلوبة", 400);
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

    if (!ALLOWED_RECEIPT_TYPES.has(receipt.type)) {
      return err("نوع الملف غير مدعوم. ارفع صورة JPG/PNG/WebP أو PDF", 400);
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

    const amount = interval === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

    if (amount <= 0) {
      return err("سعر الخطة غير صالح", 400);
    }

    const pendingPayment = await prisma.subscriptionPayment.findFirst({
      where: {
        tenantId: auth.user.tenantId,
        status: "PENDING",
        receiptUrl: {
          not: null,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    if (pendingPayment) {
      return err(
        "لديك طلب دفع قيد المراجعة بالفعل. انتظر مراجعة الإدارة قبل إرسال إيصال جديد.",
        409,
        {
          paymentId: pendingPayment.id,
          createdAt: pendingPayment.createdAt,
        },
      );
    }

    const upload = await uploadReceiptToCloudinary(receipt, auth.user.tenantId);

    const result = await prisma.subscriptionPayment.create({
      data: {
        tenantId: auth.user.tenantId,
        requestedPlanId: plan.id,
        requestedInterval: interval,
        amount,
        currency: plan.currency,
        status: "PENDING",
        method,
        receiptUrl: upload.secureUrl,
        receiptPublicId: upload.publicId,
        raw: {
          fileName: receipt.name,
          fileType: receipt.type,
          fileSize: receipt.size,
          resourceType: upload.resourceType,
          planCode: plan.code,
          planName: plan.name,
          interval,
          paymentMethod: method,
        },
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        method: true,
        receiptUrl: true,
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
