import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { decryptText } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;
    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const ip = getClientIp(req) || "unknown";
    const rateLimit = await checkRateLimit(`${auth.user.userId}:${ip}`, {
      keyPrefix: "two-factor-disable",
      max: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return err("تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقًا.", 429);
    }

    const body = await req.json().catch(() => ({}));
    const password = String(body.password ?? "");
    const code = String(body.code ?? "").trim();

    if (!password || !/^\d{6}$/.test(code)) {
      return err("كلمة المرور ورمز التحقق مطلوبان", 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: auth.user.userId,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        passwordHash: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return err("المستخدم غير موجود", 404);
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return err("التحقق الثنائي غير مفعّل", 400);
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      return err("كلمة المرور غير صحيحة", 401);
    }

    const twoFactorSecret = decryptText(user.twoFactorSecret);

    if (!twoFactorSecret) {
      return err("إعدادات التحقق الثنائي غير مكتملة", 403);
    }

    const codeOk = speakeasy.totp.verify({
      secret: twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });

    if (!codeOk) {
      return err("رمز التحقق غير صحيح", 401);
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return ok({
      disabled: true,
    });
  });
}
