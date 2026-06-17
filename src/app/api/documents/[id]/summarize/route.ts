import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";
import { verifySameOrigin } from "@/lib/csrf";
import { assertTenantCanWrite } from "@/lib/billing-limits";
import openai from "@/lib/openai";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      "تلخيص مستند",
    );

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status);
    }

    if (!writeCheck.billing?.limits.aiEnabled) {
      return err("خطة الاشتراك الحالية لا تدعم تلخيص المستندات بالذكاء الاصطناعي", 402);
    }

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: auth.user.tenantId,
      },
      select: {
        id: true,
        aiEnabled: true,
      },
    });

    if (!tenant) {
      return err("المكتب غير موجود", 404);
    }

    if (!tenant.aiEnabled) {
      return err("المساعد الذكي غير مفعّل لهذا المكتب", 403);
    }

    const { id } = await params;

    const doc = await prisma.document.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        notes: true,
        aiSummary: true,
        client: {
          select: {
            id: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            client: {
              select: {
                id: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    });

    if (!doc) {
      return notFound("المستند غير موجود");
    }

    const isArchivedClient = Boolean(
      doc.client?.archivedAt || doc.case?.client?.archivedAt,
    );

    if (isArchivedClient) {
      return err("لا يمكن تلخيص مستند مرتبط بموكل مؤرشف", 400);
    }

    if (!openai) {
      return err("خدمة التلخيص غير مفعلة حاليًا", 503);
    }

    const prompt = `
أنت مساعد قانوني.
لخص معلومات المستند التالية بشكل مختصر ومنظم باللغة العربية.

اسم الملف:
${doc.fileName}

نوع الملف:
${doc.fileType || "غير محدد"}

ملاحظات المستخدم:
${doc.notes || "لا توجد ملاحظات"}

المطلوب:
- ملخص قصير
- أهم النقاط المحتملة
- ملاحظات قانونية عامة بدون إصدار حكم نهائي
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "أنت مساعد قانوني داخل نظام إدارة مكاتب محاماة. لا تختلق معلومات غير موجودة.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() ||
      "تعذر إنشاء ملخص للمستند.";

    const updated = await prisma.document.update({
      where: {
        id: doc.id,
      },
      data: {
        aiSummary: summary,
        aiAnalyzedAt: new Date(),
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        aiSummary: true,
        aiAnalyzedAt: true,
        createdAt: true,
      },
    });

    return ok(updated);
  });
}