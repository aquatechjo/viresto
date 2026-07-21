import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import {
  buildCaseAccessWhere,
  buildClientAccessWhere,
  buildDocumentAccessWhere,
} from "@/lib/access-control";

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const sp = new URL(req.url).searchParams;
    const caseId = sp.get("caseId");
    const clientId = sp.get("clientId");
    const q = sp.get("q")?.trim();
    const type = sp.get("type");
    const tag = sp.get("tag")?.trim();

    const pageRaw = Number(sp.get("page") || 1);
    const page = Number.isNaN(pageRaw) ? 1 : Math.max(pageRaw, 1);

    const limitRaw = Number(sp.get("limit") || 20);

    const limit = Number.isNaN(limitRaw)
      ? 20
      : Math.min(Math.max(limitRaw, 1), 50);
    const skip = (page - 1) * limit;

    if (caseId) {
      const caseExists = await prisma.case.findFirst({
        where: buildCaseAccessWhere(auth.user, { id: caseId }),
        select: { id: true },
      });

      if (!caseExists) {
        return err("القضية غير موجودة داخل هذا المكتب", 404);
      }
    }

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: buildClientAccessWhere(auth.user, { id: clientId }),
        select: { id: true },
      });

      if (!clientExists) {
        return err("الموكل غير موجود داخل هذا المكتب", 404);
      }
    }

    const requestedWhere: Prisma.DocumentWhereInput = {
        ...(caseId ? { caseId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
        ...(type === "pdf"
          ? { fileType: "application/pdf" }
          : type === "image"
            ? { fileType: { startsWith: "image/" } }
            : type === "doc"
              ? {
                  OR: [
                    { fileType: { contains: "word" } },
                    { fileType: { contains: "officedocument" } },
                  ],
                }
              : {}),
        ...(q
          ? {
              OR: [
                { fileName: { contains: q, mode: "insensitive" } },
                { client: { is: { name: { contains: q, mode: "insensitive" } } } },
                { case: { is: { title: { contains: q, mode: "insensitive" } } } },
              ],
            }
          : {}),
      };
    const where = buildDocumentAccessWhere(auth.user, requestedWhere);
    const summaryWhere = buildDocumentAccessWhere(auth.user);

    const [data, total, summaryTotal, pdfCount, imageCount, wordCount, size] =
      await Promise.all([
        prisma.document.findMany({
      where,
      skip,
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
        }),
        prisma.document.count({ where }),
        prisma.document.count({ where: summaryWhere }),
        prisma.document.count({ where: { AND: [summaryWhere, { fileType: "application/pdf" }] } }),
        prisma.document.count({ where: { AND: [summaryWhere, { fileType: { startsWith: "image/" } }] } }),
        prisma.document.count({ where: { AND: [summaryWhere, { OR: [{ fileType: { contains: "word" } }, { fileType: { contains: "officedocument" } }] }] } }),
        prisma.document.aggregate({ where: summaryWhere, _sum: { fileSize: true } }),
      ]);

    return ok({
      data,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        summary: {
          total: summaryTotal,
          pdf: pdfCount,
          images: imageCount,
          word: wordCount,
          totalSize: size._sum.fileSize ?? 0,
        },
      },
    });
  });
}
