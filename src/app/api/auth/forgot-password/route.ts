import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/encryption";
import { createPasswordResetCode } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";

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

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);

    if (!email) {
      return NextResponse.json(
        { success: false, message: "البريد الإلكتروني مطلوب" },
        { status: 400 }
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