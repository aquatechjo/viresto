import { NextRequest } from "next/server";
import OpenAI from "openai";
import { apiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeAiInput, detectPromptInjection } from "@/lib/ai-security";
import { logActivity } from "@/lib/log-activity";
import { verifySameOrigin } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);

    if (auth.error || !auth.user) {
      return auth.error;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.user.tenantId },
      select: {
        aiEnabled: true,
        isSuspended: true,
        status: true,
      },
    });

    if (!tenant) {
      return err("المكتب غير موجود", 404);
    }

    if (tenant.isSuspended || tenant.status === "SUSPENDED") {
      return err("المكتب موقوف", 403);
    }

    if (tenant.status === "EXPIRED") {
      return err("لا يمكن استخدام المساعد الذكي لأن الاشتراك منتهي", 403);
    }

    if (!tenant.aiEnabled) {
      return err("ميزة الذكاء الاصطناعي غير مفعلة لهذا المكتب", 403);
    }

    const rl = await checkRateLimit(
      `${auth.user.tenantId}:${auth.user.userId}`,
      {
        keyPrefix: "ai-chat",
        windowMs: 60 * 60 * 1000,
        max: 20,
      },
    );

    if (!rl.allowed) {
      return err(
        "تم تجاوز الحد المسموح لاستخدام المساعد الذكي، حاول لاحقًا",
        429,
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return err("المساعد الذكي غير مُهيأ", 503);
    }

    const openai = new OpenAI({ apiKey });

    const body = await req.json().catch(() => ({}));
    const rawMessage = String(body.message ?? "").trim();
    const message = sanitizeAiInput(rawMessage);

    if (!message) {
      return err("الرسالة مطلوبة", 400);
    }

    if (message.length > 1000) {
      return err("الرسالة طويلة جدًا", 400);
    }

    if (detectPromptInjection(rawMessage)) {
      await logActivity({
        req,
        tenantId: auth.user.tenantId,
        actorId: auth.user.userId,
        type: "AI_PROMPT_INJECTION_BLOCKED",
        title: "تم حظر محاولة Prompt Injection",
        message: auth.user.email,
        entityType: "AI",
        entityId: auth.user.userId,
      });

      return err("تم حظر الرسالة لأنها تحتوي على تعليمات غير آمنة", 400);
    }

    const [
      casesCount,
      openCasesCount,
      appointmentsCount,
      clientsCount,
      upcomingAppointments,
    ] = await Promise.all([
      prisma.case.count({
        where: { tenantId: auth.user.tenantId },
      }),

      prisma.case.count({
        where: {
          tenantId: auth.user.tenantId,
          status: {
            in: ["OPEN", "IN_PROGRESS"],
          },
        },
      }),

      prisma.appointment.count({
        where: { tenantId: auth.user.tenantId },
      }),

      prisma.client.count({
        where: { tenantId: auth.user.tenantId },
      }),

      prisma.appointment.findMany({
        where: {
          tenantId: auth.user.tenantId,
          startTime: {
            gte: new Date(),
          },
        },
        take: 5,
        orderBy: { startTime: "asc" },
        select: {
          title: true,
          type: true,
          startTime: true,
          endTime: true,
          location: true,
        },
      }),
    ]);

    const systemPrompt = `
أنت مساعد ذكي داخل نظام Viresto لإدارة مكاتب المحاماة.

القواعد:
- أجب بالعربية فقط.
- أجب باختصار وبشكل مهني.
- اعتمد فقط على البيانات العامة الموجودة أدناه.
- لا تخترع قضايا أو مواعيد أو موكلين غير موجودين.
- لا تطلب أو تكشف بيانات حساسة عن الموكلين.
- إذا لم تجد المعلومة، قل: لا توجد بيانات كافية داخل النظام.
- لا تقدم استشارة قانونية نهائية، فقط ساعد في التنظيم والشرح والمتابعة.

ملاحظة خصوصية:
لا توجد أسماء موكلين أو تفاصيل حساسة ضمن السياق المرسل لك.

ملخص المكتب:
- عدد الموكلين: ${clientsCount}
- عدد القضايا الكلي: ${casesCount}
- عدد القضايا المفتوحة أو قيد التنفيذ: ${openCasesCount}
- عدد المواعيد الكلي: ${appointmentsCount}

المواعيد القادمة/الأقرب:
${JSON.stringify(upcomingAppointments, null, 2)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply =
      completion.choices[0]?.message?.content ?? "لم أستطع إنشاء رد";

    await logActivity({
      req,
      tenantId: auth.user.tenantId,
      actorId: auth.user.userId,
      type: "AI_CHAT_USED",
      title: "استخدام المساعد الذكي",
      message: auth.user.email,
      entityType: "AI",
      entityId: auth.user.userId,
    });

    return ok({ reply });
  });
}
