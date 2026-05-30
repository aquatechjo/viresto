import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { apiHandler } from '@/lib/api-handler'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAiInput, detectPromptInjection } from '@/lib/ai-security'
import { logActivity } from '@/lib/log-activity'

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])

    if (auth.error || !auth.user) {
      return auth.error
    }
    const rl = checkRateLimit(
  `${auth.user.tenantId}:${auth.user.userId}`,
  {
    keyPrefix: 'ai-chat',
    windowMs: 60 * 60 * 1000,
    max: 20,
  }
)

if (!rl.allowed) {
  return err(
    'تم تجاوز الحد المسموح لاستخدام المساعد الذكي، حاول لاحقًا',
    429
  )
}

const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  return err('المساعد الذكي غير مُهيأ', 503)
}

const openai = new OpenAI({ apiKey })

    const body = await req.json().catch(() => ({}))
    const rawMessage = String(body.message ?? '').trim()
    const message = sanitizeAiInput(rawMessage)

    if (!message) {
      return err('الرسالة مطلوبة', 400)
    }

    if (message.length > 1000) {
      return err('الرسالة طويلة جدًا', 400)
    }

    if (detectPromptInjection(rawMessage)) {
  await logActivity({
    req,
    tenantId: auth.user.tenantId,
    actorId: auth.user.userId,
    type: 'AI_PROMPT_INJECTION_BLOCKED',
    title: 'تم حظر محاولة Prompt Injection',
    message: auth.user.email,
    entityType: 'AI',
    entityId: auth.user.userId,
  })

  return err('تم حظر الرسالة لأنها تحتوي على تعليمات غير آمنة', 400)
}

    const [cases, appointments, clients] = await Promise.all([
      prisma.case.findMany({
        where: { tenantId: auth.user.tenantId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          caseNumber: true,
          title: true,
          court: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      }),

      prisma.appointment.findMany({
        where: { tenantId: auth.user.tenantId },
        take: 10,
        orderBy: { startTime: 'asc' },
        select: {
          title: true,
          type: true,
          startTime: true,
          endTime: true,
          location: true,
        },
      }),

prisma.client.findMany({
  where: { tenantId: auth.user.tenantId },
  take: 10,
  orderBy: { createdAt: 'desc' },
  select: {
    name: true,
  },
}),
    ])

    const systemPrompt = `
أنت مساعد ذكي داخل نظام Viresto لإدارة مكاتب المحاماة.

القواعد:
- أجب بالعربية فقط.
- أجب باختصار وبشكل مهني.
- اعتمد فقط على البيانات الموجودة أدناه.
- لا تخترع قضايا أو مواعيد أو موكلين غير موجودين.
- إذا لم تجد المعلومة، قل: لا توجد بيانات كافية داخل النظام.
- لا تقدم استشارة قانونية نهائية، فقط ساعد في التنظيم والشرح والمتابعة.

بيانات المكتب:

القضايا:
${JSON.stringify(cases, null, 2)}

المواعيد:
${JSON.stringify(appointments, null, 2)}

الموكلون:
${JSON.stringify(clients, null, 2)}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const reply =
      completion.choices[0]?.message?.content ??
      'لم أستطع إنشاء رد'
    

      await logActivity({
  req,
  tenantId: auth.user.tenantId,
  actorId: auth.user.userId,
  type: 'AI_CHAT_USED',
  title: 'استخدام المساعد الذكي',
  message: auth.user.email,
  entityType: 'AI',
  entityId: auth.user.userId,
})


    return ok({ reply })
    })
}