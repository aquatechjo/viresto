import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { encryptText } from "@/lib/encryption";
import { verifySameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const ip = getClientIp(req) || "unknown";
    const rateLimit = await checkRateLimit(`${auth.user.userId}:${ip}`, {
      keyPrefix: "two-factor-setup",
      max: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return err("تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقًا.", 429);
    }

    const body = await req.json().catch(() => ({}));
    const password = String(body.password ?? "");

    if (!password) {
      return err("كلمة المرور الحالية مطلوبة", 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: auth.user.userId,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return err("المستخدم غير موجود", 404);
    }

    if (user.twoFactorEnabled) {
      return err("التحقق الثنائي مفعّل مسبقًا", 400);
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      return err("كلمة المرور غير صحيحة", 401);
    }

    const secret = speakeasy.generateSecret({
      name: `Viresto (${user.email})`,
      issuer: "Viresto",
      length: 20,
    });

    if (!secret.base32 || !secret.otpauth_url) {
      return err("فشل إنشاء رمز التحقق الثنائي", 500);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: encryptText(secret.base32),
        twoFactorEnabled: false,
      },
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return ok({ qrCode });
  });
}
