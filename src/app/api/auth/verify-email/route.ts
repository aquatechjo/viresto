import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { verifyCode } from "@/lib/verification";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const body = await req.json().catch(() => ({}));

    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    const code = String(body.code || "").trim();

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rl = await checkRateLimit(`${ip}:${email || "unknown"}`, {
      keyPrefix: "verify-email",
      max: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rl.allowed) {
      return err("تم تجاوز عدد محاولات التحقق. حاول لاحقاً.", 429);
    }

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
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      return err("رمز التحقق غير صحيح أو منتهي", 400);
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({
        success: true,
        data: {
          message: "الحساب مؤكد مسبقًا. يمكنك تسجيل الدخول.",
          emailVerified: true,
          next: "LOGIN",
          email: user.email,
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

    return NextResponse.json({
      success: true,
      data: {
        message: "تم تأكيد البريد الإلكتروني بنجاح. يمكنك تسجيل الدخول الآن.",
        emailVerified: true,
        next: "LOGIN",
        email: user.email,
      },
    });
  });
}