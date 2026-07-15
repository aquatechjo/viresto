import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptText } from "@/lib/encryption";
import { requireRole } from "@/lib/api-auth";
import { ok, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

type Params = { params: Promise<{ id: string }> };

function clientLookupWhere(
  identifier: string,
  tenantId: string,
): Prisma.ClientWhereInput {
  const publicId = Number(identifier);
  const hasPublicId = Number.isSafeInteger(publicId) && publicId > 0;

  return {
    tenantId,
    OR: hasPublicId ? [{ id: identifier }, { publicId }] : [{ id: identifier }],
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: clientLookupWhere(id, auth.user.tenantId),
      include: {
        cases: true,
        appointments: true,
      },
    });

    if (!client) {
      return notFound("الموكل غير موجود");
    }

    return ok({
      ...client,
      email: decryptText(client.email),
      phone: decryptText(client.phone),
      nationalId: decryptText(client.nationalId),
      address: decryptText(client.address),
      notes: decryptText(client.notes),
    });
  });
}