import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/encryption";
import { createPasswordResetCode } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";
import {
  checkRateLimit,
  hashRateLimitIdentifier,
} from "@/lib/rate-limit";
import { getClientIp } from "@/lib/turnstile";

export const runtime = "nodejs";

const GENERIC_MESSAGE =
  "إذا كان البريد الإلكتروني مسجلاً لدينا، سيتم إرسال كود إعادة تعيين كلمة المرور.";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin) return true;
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json(
        { success: false, message: "طلب غير صالح" },
        { status: 403 }
      );
    }

    const ip = getClientIp(request) || "unknown";
    const ipLimit = await checkRateLimit(ip, {
      keyPrefix: "forgot-password-ip",
      max: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: "تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقًا.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);

    if (!email) {
      return NextResponse.json(
        { success: false, message: "البريد الإلكتروني مطلوب" },
        { status: 400 }
      );
    }

    const accountLimit = await checkRateLimit(
      hashRateLimitIdentifier(email),
      {
        keyPrefix: "forgot-password-account",
        max: 3,
        windowMs: 15 * 60 * 1000,
      }
    );

    if (!accountLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: "تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقًا.",
        },
        { status: 429 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (user?.isActive) {
      const code = await createPasswordResetCode(user.id);

      await sendPasswordResetEmail({
        to: user.email,
        code,
      });
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_MESSAGE,
    });
  } catch (error) {
    console.error("forgot-password error:", error);

    return NextResponse.json({
      success: true,
      message: GENERIC_MESSAGE,
    });
  }
}
