import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";

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
} as const;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.user.tenantId },
      select: tenantSelect,
    });

    if (!tenant) return err("الشركة غير موجودة", 404);

    return ok(tenant);
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
      typeof body.email === "string" ? body.email.trim() : undefined;
    const phone =
      typeof body.phone === "string" ? body.phone.trim() : undefined;
    const address =
      typeof body.address === "string" ? body.address.trim() : undefined;
    const logoUrl =
      typeof body.logoUrl === "string" ? body.logoUrl.trim() : undefined;

    if (name !== undefined && name.length < 2) {
      return err("اسم الشركة قصير جدًا", 400);
    }

    if (email && !email.includes("@")) {
      return err("البريد الإلكتروني غير صالح", 400);
    }

    const tenant = await prisma.tenant.update({
      where: { id: auth.user.tenantId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(address !== undefined ? { address: address || null } : {}),
        ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
      },
      select: tenantSelect,
    });

    return ok(tenant);
  });
}
