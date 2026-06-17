import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { verifyCode } from "@/lib/verification";
import { signToken, buildCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

async function createLoginResponse(
  req: NextRequest,
  user: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    role: "ADMIN" | "LAWYER" | "STAFF";
    isSystemAdmin: boolean;
  },
) {
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

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rl = await checkRateLimit(`${ip}:${email || "unknown"}`, {
      keyPrefix: "verify-whatsapp",
      max: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rl.allowed) {
      return err("تم تجاوز عدد محاولات التحقق. حاول لاحقاً.", 429);
    }

    if (!email || !code) {
      return err("البريد الإلكتروني ورمز التحقق مطلوبان", 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err("البريد الإلكتروني غير صالح", 400);
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
        isActive: true,
        phone: true,
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
      return err("رمز التحقق غير صحيح أو منتهي", 400);
    }

    if (!user.emailVerifiedAt) {
      return err("يرجى تأكيد البريد الإلكتروني أولاً", 403);
    }

    if (!user.isActive) {
      return err("الحساب غير فعال", 403);
    }

    if (user.tenant.isSuspended || user.tenant.status === "SUSPENDED") {
      return err("المكتب موقوف", 403);
    }

    if (user.phoneVerifiedAt) {
      return NextResponse.json({
        success: true,
        data: {
          message: "رقم الواتساب مؤكد مسبقًا. يرجى تسجيل الدخول.",
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

    return createLoginResponse(req, user);
  });
}