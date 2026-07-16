import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";
import { logActivity } from "@/lib/log-activity";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import {
  AI_CONSENT_REQUIRED_CODE,
  AI_DATA_POLICY_VERSION,
} from "@/lib/ai-consent";

export async function PATCH(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) {
      return auth.error;
    }

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعديل إعدادات الذكاء الاصطناعي",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const body = await req.json().catch(() => ({}));

    if (typeof body.enabled !== "boolean") {
      return err("قيمة إعداد الذكاء الاصطناعي غير صالحة", 400);
    }

    const enabled = body.enabled;

    if (
      enabled &&
      (body.consentAccepted !== true ||
        body.policyVersion !== AI_DATA_POLICY_VERSION)
    ) {
      return err(
        "يجب قراءة سياسة معالجة بيانات الذكاء الاصطناعي والموافقة عليها قبل التفعيل",
        400,
        {
          code: AI_CONSENT_REQUIRED_CODE,
          policyVersion: AI_DATA_POLICY_VERSION,
        },
      );
    }

    if (enabled && !writeCheck.billing?.limits.aiEnabled) {
      return err("خطة الاشتراك الحالية لا تدعم المساعد الذكي", 402);
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: auth.user.tenantId,
      },
      data: {
        aiEnabled: enabled,
        aiConsentAt: enabled ? new Date() : null,
        aiConsentBy: enabled ? auth.user.userId : null,
        aiConsentPolicyVersion: enabled ? AI_DATA_POLICY_VERSION : null,
      },
      select: {
        id: true,
        aiEnabled: true,
        aiConsentAt: true,
        aiConsentBy: true,
        aiConsentPolicyVersion: true,
      },
    });

    await logActivity({
      req,
      tenantId: auth.user.tenantId,
      actorId: auth.user.userId,
      type: enabled ? "AI_ENABLED" : "AI_DISABLED",
      title: enabled ? "تم تفعيل المساعد الذكي" : "تم تعطيل المساعد الذكي",
      message: enabled
        ? `${auth.user.email} — policy ${AI_DATA_POLICY_VERSION}`
        : `${auth.user.email} — consent revoked`,
      entityType: "TENANT",
      entityId: auth.user.tenantId,
    });

    return ok(updatedTenant);
  });
}
