import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { createVerificationCode, verifyCode } from "@/lib/verification";
import { sendWhatsappVerificationCode } from "@/lib/whatsapp";

async function createAndSendWhatsappCode(user: { id: string; phone: string | null }) {
  if (!user.phone) {
    return {
      ok: false as const,
      response: err("لا يوجد رقم واتساب مرتبط بهذا الحساب", 400),
    };
  }

  const whatsappCode = await createVerificationCode({
    userId: user.id,
    type: "WHATSAPP",
    expiresInMinutes: 10,
  });

  await sendWhatsappVerificationCode({
    to: user.phone,
    code: whatsappCode,
  });

  return {
    ok: true as const,
  };
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const body = await req.json().catch(() => ({}));

    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const code = String(body.code || "").trim();

    if (!email || !code) {
      return err("البريد الإلكتروني ورمز التحقق مطلوبان", 400);
    }

    if (!/^\d{6}$/.test(code)) {
      return err("رمز التحقق يجب أن يكون 6 أرقام", 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
      },
    });

    if (!user) {
      return err("المستخدم غير موجود", 404);
    }

    if (user.emailVerifiedAt && user.phoneVerifiedAt) {
      return NextResponse.json({
        success: true,
        data: {
          message: "الحساب مؤكد مسبقًا. يمكنك تسجيل الدخول.",
          emailVerified: true,
          phoneVerified: true,
          next: "LOGIN",
          email: user.email,
        },
      });
    }

    if (user.emailVerifiedAt && !user.phoneVerifiedAt) {
      const whatsapp = await createAndSendWhatsappCode(user);
      if (!whatsapp.ok) return whatsapp.response;

      return NextResponse.json({
        success: true,
        data: {
          message: "البريد الإلكتروني مؤكد مسبقًا. أرسلنا رمز واتساب جديد.",
          emailVerified: true,
          next: "WHATSAPP_VERIFICATION",
          email: user.email,
          phone: user.phone,
        },
      });
    }

    const result = await verifyCode({
      userId: user.id,
      type: "EMAIL",
      code,
    });

    if (!result.ok) {
      if (result.reason === "EXPIRED") {
        return err("انتهت صلاحية رمز التحقق", 400);
      }

      if (result.reason === "TOO_MANY_ATTEMPTS") {
        return err("تم تجاوز عدد محاولات التحقق", 429);
      }

      return err("رمز التحقق غير صحيح", 400);
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerifiedAt: new Date(),
      },
    });

    const whatsapp = await createAndSendWhatsappCode(user);
    if (!whatsapp.ok) return whatsapp.response;

    return NextResponse.json({
      success: true,
      data: {
        message: "تم تأكيد البريد الإلكتروني. أرسلنا رمز تأكيد إلى واتساب.",
        emailVerified: true,
        next: "WHATSAPP_VERIFICATION",
        email: user.email,
        phone: user.phone,
      },
    });
  });
}
