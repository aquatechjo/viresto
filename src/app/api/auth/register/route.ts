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
import { getClientIp, verifyTurnstileToken } from "@/lib/turnstile";

const TRIAL_DAYS = 7;
const TRIAL_PLAN_CODE = "PRO";

function normalizeJordanPhone(phone: string) {
  const cleaned = phone.replace(/\s+/g, "").trim();

  if (cleaned.startsWith("+962")) return cleaned;

  if (cleaned.startsWith("07")) {
    return `+962${cleaned.slice(1)}`;
  }

  return cleaned;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

    const ip = getClientIp(req) ?? "unknown";

    const rl = await checkRateLimit(ip, {
      keyPrefix: "register",
      max: 5,
      windowMs: 30 * 60 * 1000,
    });

    if (!rl.allowed) {
      return err("تم تجاوز عدد محاولات إنشاء الحساب. حاول لاحقاً.", 429);
    }

    const body = await req.json().catch(() => ({}));

    const turnstile = await verifyTurnstileToken(
      body.turnstileToken,
      ip === "unknown" ? undefined : ip,
    );

    if (!turnstile.success) {
      return err("فشل التحقق الأمني. حدّث الصفحة وحاول مرة أخرى.", 403);
    }

    const bodyForValidation = { ...body };
    delete bodyForValidation.turnstileToken;

    const parsed = registerSchema.safeParse(bodyForValidation);

    if (!parsed.success) {
      return err("بيانات غير صالحة", 400, parsed.error.flatten());
    }

    const { tenantName, name, phone, password } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();
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

    const exists = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (exists) {
      return err("البريد الإلكتروني مستخدم مسبقاً", 409);
    }

    const trialPlan = await prisma.billingPlan.findUnique({
      where: {
        code: TRIAL_PLAN_CODE,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (!trialPlan) {
      return err("خطة التجربة غير موجودة. تأكد من تشغيل seed للخطط.", 500);
    }

    const baseSlug = slugify(tenantName) || `office-${Date.now().toString(36)}`;
    let slug = baseSlug;
    let i = 1;

    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const trialStartsAt = new Date();
    const trialEndsAt = addDays(trialStartsAt, TRIAL_DAYS);

    const tenant = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug,
          status: "ACTIVE",
          users: {
            create: {
              name,
              email,
              phone: normalizedPhone,
              passwordHash,
              role: "ADMIN",
              emailVerifiedAt: null,
            },
          },
        },
        include: {
          users: true,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: createdTenant.id,
          planId: trialPlan.id,
          status: "TRIALING",
          interval: "MONTHLY",
          amount: 0,
          currency: "JOD",
          trialEndsAt: trialEndsAt,
          currentPeriodStart: trialStartsAt,
          currentPeriodEnd: trialEndsAt,
        },
      });

      return createdTenant;
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
          message:
            "تم إنشاء المكتب. حصلت على تجربة مجانية لمدة 7 أيام، وأرسلنا رمز تأكيد إلى بريدك الإلكتروني.",
          requiresVerification: true,
          next: "EMAIL_VERIFICATION",
          email: adminUser.email,
          trial: {
            plan: trialPlan.code,
            days: TRIAL_DAYS,
            startsAt: trialStartsAt,
            endsAt: trialEndsAt,
          },
        },
      },
      { status: 201 },
    );
  });
}
