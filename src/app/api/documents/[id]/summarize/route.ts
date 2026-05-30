import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/tenant'
import { ok, err, notFound } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import openai from '@/lib/openai'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const { id } = await params
    const ctx = await requireTenant(req)

    const doc = await prisma.document.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        notes: true,
        aiSummary: true,
      },
    })

    if (!doc) {
      return notFound('المستند غير موجود')
    }

    if (!process.env.OPENAI_API_KEY) {
      return err('خدمة التلخيص غير مفعلة حاليًا', 503)
    }

    const prompt = `
أنت مساعد قانوني.
لخص معلومات المستند التالية بشكل مختصر ومنظم باللغة العربية.

اسم الملف:
${doc.fileName}

نوع الملف:
${doc.fileType || 'غير محدد'}

ملاحظات المستخدم:
${doc.notes || 'لا توجد ملاحظات'}

المطلوب:
- ملخص قصير
- أهم النقاط المحتملة
- ملاحظات قانونية عامة بدون إصدار حكم نهائي
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'أنت مساعد قانوني داخل نظام إدارة مكاتب محاماة. لا تختلق معلومات غير موجودة.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    })

    const summary =
      completion.choices[0]?.message?.content?.trim() ||
      'تعذر إنشاء ملخص للمستند.'

    const updated = await prisma.document.update({
      where: { id: doc.id },
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
    })

    return ok(updated)
  })
}