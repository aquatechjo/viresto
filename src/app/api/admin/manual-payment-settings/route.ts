import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole, getRequestMeta } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { MANUAL_PAYMENT_SETTINGS_ID } from "@/lib/manual-payment-settings";

export const runtime = "nodejs";

const DEFAULT_SETTINGS = {
  id: MANUAL_PAYMENT_SETTINGS_ID,
  isEnabled: false,
  accountHolderName: null,
  cliqEnabled: false,
  cliqAlias: null,
  bankTransferEnabled: false,
  bankName: null,
  iban: null,
  instructionsAr: null,
  instructionsEn: null,
  updatedById: null,
  createdAt: null,
  updatedAt: null,
};

function optionalText(value: unknown, maxLength: number) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeIban(value: unknown) {
  const iban = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 34);

  return iban || null;
}

async function requireSettingsAdmin(req: NextRequest) {
  const auth = await requireRole(req, ["ADMIN"]);

  if (auth.error || !auth.user) return auth;

  if (!auth.user.isSystemAdmin) {
    return {
      error: err("لا تملك صلاحية إدارة معلومات الدفع", 403),
      user: null,
    };
  }

  return auth;
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireSettingsAdmin(req);
    if (auth.error || !auth.user) return auth.error;

    const settings = await prisma.manualPaymentSettings.findUnique({
      where: {
        id: MANUAL_PAYMENT_SETTINGS_ID,
      },
    });

    return ok({
      settings: settings ?? DEFAULT_SETTINGS,
    });
  });
}

export async function PUT(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireSettingsAdmin(req);
    if (auth.error || !auth.user) return auth.error;

    const body = await req.json().catch(() => ({}));
    const isEnabled = body.isEnabled === true;
    const cliqEnabled = body.cliqEnabled === true;
    const bankTransferEnabled = body.bankTransferEnabled === true;
    const accountHolderName = optionalText(body.accountHolderName, 150);
    const cliqAlias = optionalText(body.cliqAlias, 100);
    const bankName = optionalText(body.bankName, 150);
    const iban = normalizeIban(body.iban);
    const instructionsAr = optionalText(body.instructionsAr, 1000);
    const instructionsEn = optionalText(body.instructionsEn, 1000);

    if (isEnabled && !cliqEnabled && !bankTransferEnabled) {
      return err("فعّل طريقة دفع واحدة على الأقل", 400);
    }

    if (isEnabled && !accountHolderName) {
      return err("اسم صاحب الحساب مطلوب قبل تفعيل الدفع اليدوي", 400);
    }

    if (isEnabled && cliqEnabled && !cliqAlias) {
      return err("معرّف CliQ مطلوب قبل تفعيل هذه الطريقة", 400);
    }

    if (isEnabled && bankTransferEnabled) {
      if (!bankName) {
        return err("اسم البنك مطلوب قبل تفعيل التحويل البنكي", 400);
      }

      if (!iban || iban.length < 15) {
        return err("أدخل رقم IBAN صالحًا قبل تفعيل التحويل البنكي", 400);
      }
    }

    const meta = getRequestMeta(req);

    const settings = await prisma.$transaction(async (tx) => {
      const saved = await tx.manualPaymentSettings.upsert({
        where: {
          id: MANUAL_PAYMENT_SETTINGS_ID,
        },
        create: {
          id: MANUAL_PAYMENT_SETTINGS_ID,
          isEnabled,
          accountHolderName,
          cliqEnabled,
          cliqAlias,
          bankTransferEnabled,
          bankName,
          iban,
          instructionsAr,
          instructionsEn,
          updatedById: auth.user.userId,
        },
        update: {
          isEnabled,
          accountHolderName,
          cliqEnabled,
          cliqAlias,
          bankTransferEnabled,
          bankName,
          iban,
          instructionsAr,
          instructionsEn,
          updatedById: auth.user.userId,
        },
      });

      await tx.activity.create({
        data: {
          tenantId: auth.user.tenantId,
          actorId: auth.user.userId,
          type: "SYSTEM_ADMIN_MANUAL_PAYMENT_SETTINGS_UPDATED",
          title: "تم تحديث إعدادات الدفع اليدوي",
          message: `الحالة: ${isEnabled ? "مفعلة" : "متوقفة"} | CliQ: ${cliqEnabled ? "مفعل" : "متوقف"} | التحويل البنكي: ${bankTransferEnabled ? "مفعل" : "متوقف"}`,
          entityType: "ManualPaymentSettings",
          entityId: MANUAL_PAYMENT_SETTINGS_ID,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });

      return saved;
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard/billing");

    return ok({
      settings,
      message: isEnabled
        ? "تم حفظ وتفعيل معلومات الدفع اليدوي"
        : "تم حفظ المعلومات والدفع اليدوي ما زال متوقفًا",
    });
  });
}
