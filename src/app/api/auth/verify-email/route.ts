import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { createVerificationCode, verifyCode } from "@/lib/verification";

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
      },
    });

    if (!user) {
      return err("المستخدم غير موجود", 404);
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({
        success: true,
        data: {
          message: "البريد الإلكتروني مؤكد مسبقًا.",
          emailVerified: true,
          next: "WHATSAPP_VERIFICATION",
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

    const whatsappCode = await createVerificationCode({
  userId: user.id,
  type: "WHATSAPP",
  expiresInMinutes: 10,
});

console.log("WHATSAPP VERIFICATION CODE:", whatsappCode);

return NextResponse.json({
  success: true,
  data: {
    message: "تم تأكيد البريد الإلكتروني بنجاح. يرجى تأكيد رقم الواتساب.",
    emailVerified: true,
    next: "WHATSAPP_VERIFICATION",
    email: user.email,
    phone: user.phone,
  },
});
  });
}
