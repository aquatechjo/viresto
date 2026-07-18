import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import speakeasy from "speakeasy";
import { prisma } from "@/lib/prisma";
import { signToken, buildCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { err } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/log-activity";
import { getLocationFromHeaders } from "@/lib/geo";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { decryptText } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const rl = await checkRateLimit(ip, {
      keyPrefix: "login",
      max: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rl.allowed) {
      return err("محاولات كثيرة لتسجيل الدخول. حاول بعد 15 دقيقة.", 429);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message || "بيانات غير صالحة", 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

    /*
     * حد مستقل لكل بريد يمنع توزيع التخمين على عدة عناوين شبكة.
     * يطبق على البريد سواء كان مسجلًا أم لا لتجنب كشف وجود الحساب.
     */
    const accountLimit = await checkRateLimit(email, {
      keyPrefix: "login-account",
      max: 15,
      windowMs: 15 * 60 * 1000,
    });

    if (!accountLimit.allowed) {
      return err("محاولات كثيرة لتسجيل الدخول. حاول بعد 15 دقيقة.", 429);
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        tenantId: true,
        phone: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
        isActive: true,
        isSystemAdmin: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        emailVerifiedAt: true,
        tenant: {
          select: {
            isSuspended: true,
            status: true,
          },
        },
      },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      if (user) {
        await logActivity({
          req,
          tenantId: user.tenantId,
          actorId: user.id,
          type: "LOGIN_FAILED",
          title: "محاولة تسجيل دخول فاشلة",
          message: email,
          entityType: "AUTH",
          entityId: user.id,
        });
      }

      return err("بيانات الدخول غير صحيحة", 401);
    }

    if (!user.isActive) {
      return err("هذا الحساب معطل. تواصل مع مدير المكتب.", 403);
    }

    if (!user.tenant) {
      return err("المكتب غير موجود", 403);
    }

    if (user.tenant.isSuspended) {
      return err("تم إيقاف هذا المكتب مؤقتًا. تواصل مع الدعم.", 403);
    }

    if (user.tenant.status === "SUSPENDED") {
      return err("تم إيقاف هذا المكتب مؤقتًا. تواصل مع الدعم.", 403);
    }

    if (!user.emailVerifiedAt) {
      return err("يرجى تأكيد البريد الإلكتروني أولاً", 403, {
        code: "EMAIL_NOT_VERIFIED",
        next: "EMAIL_VERIFICATION",
        email: user.email,
      });
    }

    if (user.twoFactorEnabled) {
      const code = String(body.code ?? "").trim();

      if (!user.twoFactorSecret) {
        return err("إعدادات التحقق الثنائي غير مكتملة", 403);
      }

      if (!code) {
        return NextResponse.json(
          {
            success: false,
            requiresTwoFactor: true,
            message: "رمز التحقق الثنائي مطلوب",
          },
          { status: 200 },
        );
      }

      if (!/^\d{6}$/.test(code)) {
        return err("رمز التحقق الثنائي يجب أن يكون 6 أرقام", 400);
      }

      const twoFactorSecret = decryptText(user.twoFactorSecret);

      if (!twoFactorSecret) {
        return err("إعدادات التحقق الثنائي غير مكتملة", 403);
      }

      const valid = speakeasy.totp.verify({
        secret: twoFactorSecret,
        encoding: "base32",
        token: code,
        window: 1,
      });

      if (!valid) {
        await logActivity({
          req,
          tenantId: user.tenantId,
          actorId: user.id,
          type: "TWO_FACTOR_FAILED",
          title: "فشل التحقق الثنائي",
          message: user.email,
          entityType: "AUTH",
          entityId: user.id,
        });

        return err("رمز التحقق الثنائي غير صحيح", 401);
      }
    }

    const location = getLocationFromHeaders(req.headers);

    const now = new Date();

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash: crypto.randomUUID(),
        ipAddress: ip,
        userAgent: req.headers.get("user-agent"),
        country: location.country,
        city: location.city,
        lastActivityAt: now,
      },
    });

    const previousSession = await prisma.session.findFirst({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        id: {
          not: session.id,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        ipAddress: true,
        userAgent: true,
      },
    });

    const isNewDevice =
      previousSession?.userAgent &&
      previousSession.userAgent !== req.headers.get("user-agent");

    const isNewIp =
      previousSession?.ipAddress && previousSession.ipAddress !== ip;

    if (isNewDevice || isNewIp) {
      await logActivity({
        req,
        tenantId: user.tenantId,
        actorId: user.id,
        type: "SUSPICIOUS_LOGIN",
        title: "تسجيل دخول من جهاز أو IP جديد",
        message: user.email,
        entityType: "AUTH",
        entityId: user.id,
      });
    }

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
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    res.cookies.set(buildCookie(token));

    await logActivity({
      req,
      tenantId: user.tenantId,
      actorId: user.id,
      type: "LOGIN_SUCCESS",
      title: "تم تسجيل الدخول بنجاح",
      message: user.email,
      entityType: "AUTH",
      entityId: user.id,
    });

    return res;
  });
}
