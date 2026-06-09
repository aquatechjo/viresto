import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { err } from "@/lib/api-response";
import { slugify } from "@/lib/utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiHandler } from "@/lib/api-handler";
import { verifySameOrigin } from "@/lib/csrf";
import { createVerificationCode } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";

function normalizeJordanPhone(phone: string) {
  const cleaned = phone.replace(/\s+/g, "");

  if (cleaned.startsWith("+962")) return cleaned;

  if (cleaned.startsWith("07")) {
    return `+962${cleaned.slice(1)}`;
  }

  return cleaned;
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;
    const publicRegisterEnabled =
      process.env.PUBLIC_REGISTER_ENABLED === "true";

    if (!publicRegisterEnabled) {
      return err("إنشاء الحسابات غير متاح حالياً", 403);
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const rl = await checkRateLimit(ip, {
      keyPrefix: "register",
      max: 30,
      windowMs: 10 * 60 * 1000,
    });

    if (!rl.allowed) {
      return err("تم تجاوز عدد محاولات إنشاء الحساب. حاول لاحقاً.", 429);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    const { tenantName, name, email, phone, password } = parsed.data;
    const normalizedPhone = normalizeJordanPhone(phone);

    const existingPhone = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
      },
      select: {
        id: true,
      },
    });

    if (existingPhone) {
      return err("رقم الهاتف مستخدم مسبقًا", 409);
    }
    const exists = await prisma.user.findFirst({ where: { email } });

    if (exists) {
      return err("البريد الإلكتروني مستخدم مسبقاً", 409);
    }

    const baseSlug = slugify(tenantName);
    let slug = baseSlug;
    let i = 1;

    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug,
        users: {
          create: {
            name,
            email,
            phone: normalizedPhone,
            passwordHash,
            role: "ADMIN",
            emailVerifiedAt: null,
            phoneVerifiedAt: null,
          },
        },
      },
      include: { users: true },
    });

    const adminUser = tenant.users[0];

    const emailCode = await createVerificationCode({
      userId: adminUser.id,
      type: "EMAIL",
      expiresInMinutes: 10,
    });

    await sendVerificationEmail({
      to: adminUser.email,
      code: emailCode,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "تم إنشاء المكتب. يرجى تأكيد البريد الإلكتروني.",
          requiresVerification: true,
          next: "EMAIL_VERIFICATION",
          email: adminUser.email,
        },
      },
      { status: 201 },
    );
  });
}
