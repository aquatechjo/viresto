import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";

// AUDIT_REPORT.md M4: the office ADMIN lists the office's document files to
// download them one by one (./[id]). Reachable while the office is locked.
// Newest first, 100 per page; pass `cursor` (the last id) for the next page.

const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const cursor = req.nextUrl.searchParams.get("cursor")?.trim() || null;

    const documents = await prisma.document.findMany({
      where: { tenantId: auth.user.tenantId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        caseId: true,
        clientId: true,
        createdAt: true,
      },
    });

    const page = documents.slice(0, PAGE_SIZE);

    return ok({
      documents: page,
      nextCursor: documents.length > PAGE_SIZE ? page[page.length - 1].id : null,
    });
  });
}
