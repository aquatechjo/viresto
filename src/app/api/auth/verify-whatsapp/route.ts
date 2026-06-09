import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { verifyCode } from "@/lib/verification";
import crypto from "crypto";
import { signToken, buildCookie } from "@/lib/auth";

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
        tenantId: true,
        name: true,
        email: true,
        role: true,
        isSystemAdmin: true,
        phone: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
      },
    });

    if (!user) {
      return err("المستخدم غير موجود", 404);
    }

    if (!user.emailVerifiedAt) {
      return err("يرجى تأكيد البريد الإلكتروني أولاً", 403);
    }

    if (user.phoneVerifiedAt) {
      return NextResponse.json({
        success: true,
        data: {
          message: "رقم الواتساب مؤكد مسبقًا.",
          phoneVerified: true,
          next: "LOGIN",
        },
      });
    }

    const result = await verifyCode({
      userId: user.id,
      type: "WHATSAPP",
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
    phoneVerifiedAt: new Date(),
  },
});

const ip =
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  req.headers.get("x-real-ip") ??
  "unknown";

const session = await prisma.session.create({
  data: {
    userId: user.id,
    tenantId: user.tenantId,
    tokenHash: crypto.randomUUID(),
    ipAddress: ip,
    userAgent: req.headers.get("user-agent"),
  },
});

const token = await signToken({
  userId: user.id,
  tenantId: user.tenantId,
  email: user.email,
  name: user.name,
  role: user.role,
  sessionId: session.id,
  isSystemAdmin: user.isSystemAdmin,
});

const res = NextResponse.json({
  success: true,
  data: {
    message: "تم تأكيد رقم الواتساب بنجاح.",
    phoneVerified: true,
    next: "DASHBOARD",
  },
});

res.cookies.set(buildCookie(token));

return res;
  });
}
