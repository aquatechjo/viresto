import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const sp = new URL(req.url).searchParams;
    const caseId = sp.get("caseId");
    const clientId = sp.get("clientId");

    const limitRaw = Number(sp.get("limit") || 20);

    const limit = Number.isNaN(limitRaw)
      ? 20
      : Math.min(Math.max(limitRaw, 1), 50);

    if (caseId) {
      const caseExists = await prisma.case.findFirst({
        where: {
          id: caseId,
          tenantId: auth.user.tenantId,
        },
        select: { id: true },
      });

      if (!caseExists) {
        return err("القضية غير موجودة داخل هذا المكتب", 404);
      }
    }

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: {
          id: clientId,
          tenantId: auth.user.tenantId,
        },
        select: { id: true },
      });

      if (!clientExists) {
        return err("الموكل غير موجود داخل هذا المكتب", 404);
      }
    }

    const data = await prisma.document.findMany({
      where: {
        tenantId: auth.user.tenantId,
        ...(caseId ? { caseId } : {}),
        ...(clientId ? { clientId } : {}),
      },
      take: limit,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        notes: true,
        tags: true,
        createdAt: true,
        clientId: true,
        caseId: true,
        client: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            title: true,
            client: {
              select: {
                id: true,
                name: true,
                archivedAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(data);
  });
}
