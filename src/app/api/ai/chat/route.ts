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
import { assertTenantCanUseAi } from "@/lib/billing-limits";
import {
  AI_CONSENT_REQUIRED_CODE,
  hasCurrentAiConsent,
} from "@/lib/ai-consent";
import {
  AI_QUOTA_EXCEEDED_CODE,
  estimateAiTokenBudget,
} from "@/lib/ai-usage-core";
import {
  commitAiUsage,
  releaseAiUsage,
  reserveAiUsage,
} from "@/lib/server/ai-usage";

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
        aiConsentAt: true,
        aiConsentBy: true,
        aiConsentPolicyVersion: true,
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

    const aiCheck = await assertTenantCanUseAi(
      auth.user.tenantId,
      "استخدام المساعد الذكي",
    );

    if (!aiCheck.ok) {
      return err(aiCheck.message, aiCheck.status, {
        code: aiCheck.billing?.canCreate
          ? "AI_NOT_INCLUDED"
          : "SUBSCRIPTION_INACTIVE",
        billing: aiCheck.billing ?? null,
      });
    }
    if (!tenant.aiEnabled) {
      return err("ميزة الذكاء الاصطناعي غير مفعلة لهذا المكتب", 403);
    }

    if (!hasCurrentAiConsent(tenant)) {
      return err(
        "يجب على مدير المكتب مراجعة سياسة معالجة بيانات الذكاء الاصطناعي والموافقة عليها من الإعدادات",
        403,
        { code: AI_CONSENT_REQUIRED_CODE },
      );
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

    const openai = new OpenAI({
      apiKey,
      timeout: 45_000,
      maxRetries: 1,
    });

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

    const systemPrompt = `
أنت مساعد ذكي داخل نظام Viresto لإدارة مكاتب المحاماة.

القواعد:
- أجب بالعربية فقط.
- أجب باختصار وبشكل مهني.
- لم يتم تزويدك تلقائيًا بأي بيانات من المكتب أو القضايا أو المواعيد.
- اعتمد فقط على سؤال المستخدم، ولا تدّع الوصول إلى سجلات النظام.
- لا تطلب من المستخدم إدخال بيانات شخصية أو أسرار أو محتوى قانوني غير ضروري.
- إذا لم تجد المعلومة، قل: لا توجد بيانات كافية داخل النظام.
- لا تقدم استشارة قانونية نهائية، فقط ساعد في التنظيم والشرح والمتابعة.
`;

    const limitTokens = aiCheck.billing.limits.aiMonthlyTokens;
    const requestedTokens = estimateAiTokenBudget(
      [systemPrompt, message],
      500,
    );
    const reservation = await reserveAiUsage({
      tenantId: auth.user.tenantId,
      limitTokens,
      requestedTokens,
    });

    if (!reservation.ok) {
      return err(
        "تم استهلاك حصة الذكاء الاصطناعي الشهرية لهذه الخطة",
        429,
        {
          code: AI_QUOTA_EXCEEDED_CODE,
          usage: reservation.usage,
        },
      );
    }

    let completion;

    try {
      completion = await openai.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_completion_tokens: 500,
        store: false,
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
    } catch (error) {
      await releaseAiUsage({
        tenantId: auth.user.tenantId,
        reservationId: reservation.reservation.id,
      }).catch((releaseError) => {
        console.error("Failed to release AI chat reservation:", releaseError);
      });

      throw error;
    }

    const usage = await commitAiUsage({
      tenantId: auth.user.tenantId,
      reservationId: reservation.reservation.id,
      limitTokens,
      actualTokens: completion.usage?.total_tokens,
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

    return ok({ reply, usage });
  });
}
