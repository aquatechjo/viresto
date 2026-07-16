import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";
import { hasCurrentAiConsent } from "@/lib/ai-consent";

const tenantSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  logoUrl: true,
  slug: true,
  plan: true,
  aiEnabled: true,
  aiConsentAt: true,
  aiConsentBy: true,
  aiConsentPolicyVersion: true,
} as const;

function settingsResponse<T extends {
  aiEnabled: boolean;
  aiConsentAt: Date | null;
  aiConsentBy: string | null;
  aiConsentPolicyVersion: string | null;
}>(tenant: T) {
  return {
    ...tenant,
    aiEnabled: hasCurrentAiConsent(tenant),
  };
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.user.tenantId },
      select: tenantSelect,
    });

    if (!tenant) return err("الشركة غير موجودة", 404);

    return ok(settingsResponse(tenant));
  });
}

export async function PATCH(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تعديل إعدادات المكتب",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    const body = await req.json().catch(() => ({}));

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : undefined;
    const phone =
      typeof body.phone === "string" ? body.phone.trim() : undefined;
    const address =
      typeof body.address === "string" ? body.address.trim() : undefined;

    if (name !== undefined && name.length < 2) {
      return err("اسم الشركة قصير جدًا", 400);
    }

    if (name !== undefined && name.length > 120) {
      return err("اسم الشركة طويل جدًا", 400);
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err("البريد الإلكتروني غير صالح", 400);
    }

    if (email !== undefined && email.length > 160) {
      return err("البريد الإلكتروني طويل جدًا", 400);
    }

    if (phone !== undefined && phone.length > 30) {
      return err("رقم الهاتف طويل جدًا", 400);
    }

    if (address !== undefined && address.length > 300) {
      return err("العنوان طويل جدًا", 400);
    }

    if (
      name === undefined &&
      email === undefined &&
      phone === undefined &&
      address === undefined
    ) {
      return err("لا توجد بيانات للتعديل", 400);
    }

    const tenant = await prisma.tenant.update({
      where: { id: auth.user.tenantId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(address !== undefined ? { address: address || null } : {}),
      },
      select: tenantSelect,
    });

    return ok(settingsResponse(tenant));
  });
}
