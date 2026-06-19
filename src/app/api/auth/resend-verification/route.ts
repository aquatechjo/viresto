import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { createVerificationCode } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";
import { sendWhatsappVerificationCode } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const body = await req.json().catch(() => ({}));

    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return err("البريد الإلكتروني مطلوب", 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err("البريد الإلكتروني غير صالح", 400);
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rl = await checkRateLimit(`${ip}:${email}`, {
      keyPrefix: "resend-verification",
      max: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (!rl.allowed) {
      return err("تم تجاوز عدد مرات إعادة الإرسال. حاول لاحقاً.", 429);
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        phone: true,
        isActive: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        tenant: {
          select: {
            isSuspended: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        data: {
          message: "إذا كان البريد مسجلاً لدينا، سيتم إرسال كود التحقق.",
          next: "EMAIL_VERIFICATION",
          email,
        },
      });
    }

    if (!user.isActive) {
      return err("الحساب غير فعال", 403);
    }

    if (user.tenant?.isSuspended || user.tenant?.status === "SUSPENDED") {
      return err("المكتب موقوف", 403);
    }

    if (!user.emailVerifiedAt) {
      const code = await createVerificationCode({
        userId: user.id,
        type: "EMAIL",
        expiresInMinutes: 10,
      });

      await sendVerificationEmail({
        to: user.email,
        code,
      });

      return NextResponse.json({
        success: true,
        data: {
          message: "تم إرسال كود تأكيد جديد إلى بريدك الإلكتروني.",
          next: "EMAIL_VERIFICATION",
          email: user.email,
        },
      });
    }

    if (!user.phoneVerifiedAt) {
      if (!user.phone) {
        return err("لا يوجد رقم واتساب مرتبط بهذا الحساب", 400);
      }

      const code = await createVerificationCode({
        userId: user.id,
        type: "WHATSAPP",
        expiresInMinutes: 10,
      });

      await sendWhatsappVerificationCode({
        to: user.phone,
        code,
      });

      return NextResponse.json({
        success: true,
        data: {
          message: "تم إرسال كود واتساب جديد.",
          next: "WHATSAPP_VERIFICATION",
          email: user.email,
          phone: user.phone,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "الحساب مؤكد مسبقاً. يمكنك تسجيل الدخول.",
        next: "LOGIN",
        email: user.email,
      },
    });
  });
}