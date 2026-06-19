import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/encryption";
import { verifyPasswordResetCode } from "@/lib/password-reset";

export const runtime = "nodejs";

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

    const body = await request.json().catch(() => ({}));

    const email = normalizeEmail(body.email);
    const code = String(body.code || "").replace(/\D/g, "");
    const password = String(body.password || "");

    if (!email) {
      return NextResponse.json(
        { success: false, message: "البريد الإلكتروني مطلوب" },
        { status: 400 }
      );
    }

    if (code.length !== 6) {
      return NextResponse.json(
        { success: false, message: "رمز التحقق يجب أن يتكون من 6 أرقام" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, message: "رمز التحقق غير صحيح أو منتهي" },
        { status: 400 }
      );
    }

    const verification = await verifyPasswordResetCode({
      userId: user.id,
      code,
    });

    if (!verification.ok) {
      return NextResponse.json(
        { success: false, message: verification.message },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetCode.updateMany({
        where: {
          id: verification.codeId,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      if (consumed.count !== 1) {
        throw new Error("RESET_CODE_ALREADY_USED");
      }

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash,
        },
      });

      await tx.session.deleteMany({
        where: {
          userId: user.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.",
    });
  } catch (error) {
    console.error("reset-password error:", error);

    return NextResponse.json(
      { success: false, message: "تعذر تغيير كلمة المرور" },
      { status: 500 }
    );
  }
}