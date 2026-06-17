import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, buildCookie } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validations";
import { err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";

export async function PATCH(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;
    const auth = await requireAuth(req);
    if (auth.error || !auth.user) return auth.error;

    const body = await req.json().catch(() => ({}));
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    const { name, email, currentPassword, newPassword } = parsed.data;
    if (email) {
      return err("تغيير البريد الإلكتروني غير متاح حالياً", 400);
    }
const user = await prisma.user.findFirst({
  where: {
    id: auth.user.userId,
    tenantId: auth.user.tenantId,
    isActive: true,
  },
  select: {
    id: true,
    tenantId: true,
    email: true,
    name: true,
    role: true,
    isSystemAdmin: true,
    passwordHash: true,
  },
});

    if (!user) return err("غير مصرح", 401);

    if (newPassword) {
      if (!currentPassword) return err("كلمة المرور الحالية مطلوبة", 400);

      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return err("كلمة المرور الحالية غير صحيحة", 401);
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name ? { name } : {}),
        ...(newPassword
          ? { passwordHash: await bcrypt.hash(newPassword, 12) }
          : {}),
      },
    });

    const token = await signToken({
      userId: updated.id,
      tenantId: updated.tenantId,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      sessionId: auth.user.sessionId,
      isSystemAdmin: updated.isSystemAdmin,
    });

    const res = NextResponse.json({
      success: true,
      data: {
        name: updated.name,
        email: updated.email,
      },
    });

    res.cookies.set(buildCookie(token));
    return res;
  });
}
