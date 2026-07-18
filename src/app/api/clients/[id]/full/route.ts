import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptText } from "@/lib/encryption";
import { requireRole } from "@/lib/api-auth";
import { ok, err, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientIdentifierAccessWhere,
} from "@/lib/access-control";
import {
  assertTenantCanWrite,
  assertTenantHasFeature,
} from "@/lib/billing-limits";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const [exportAccess, writeAccess] = await Promise.all([
      assertTenantHasFeature(auth.user.tenantId, "fullExport"),
      assertTenantCanWrite(auth.user.tenantId, "تصدير ملف الموكل الكامل"),
    ]);

    if (!exportAccess.ok) {
      return err(exportAccess.message, exportAccess.status, {
        code: "PLAN_FEATURE_UNAVAILABLE",
        feature: "fullExport",
      });
    }

    if (!writeAccess.ok) {
      return err(writeAccess.message, writeAccess.status, {
        code: "SUBSCRIPTION_INACTIVE",
      });
    }

    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: buildClientIdentifierAccessWhere(id, auth.user),
      include: {
        cases: {
          where: buildCaseAccessWhere(auth.user),
        },
        appointments: {
          where: buildAppointmentAccessWhere(auth.user),
        },
      },
    });

    if (!client) {
      return notFound("الموكل غير موجود");
    }

    const {
      emailHash: _emailHash,
      phoneHash: _phoneHash,
      nationalIdHash: _nationalIdHash,
      ...safeClient
    } = client;
    const revealSensitive = auth.user.role !== "STAFF";

    return ok({
      ...safeClient,
      email: revealSensitive ? decryptText(client.email) : null,
      phone: revealSensitive ? decryptText(client.phone) : null,
      nationalId: revealSensitive ? decryptText(client.nationalId) : null,
      address: revealSensitive ? decryptText(client.address) : null,
      notes: revealSensitive ? decryptText(client.notes) : null,
    });
  });
}
