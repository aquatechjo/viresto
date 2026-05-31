import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { caseSchema } from '@/lib/validations'
import { ok, err } from '@/lib/api-response'
import { logActivity } from '@/lib/activity'
import { requireRole, getRequestMeta } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { enforceResourceLimit } from '@/lib/plan-enforcement'
import { Prisma } from '@prisma/client'

const allowedStatuses = [
  'OPEN',
  'IN_PROGRESS',
  'CLOSED',
  'ARCHIVED',
] as const

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const sp = new URL(req.url).searchParams

    const status = sp.get('status')
    const clientId = sp.get('clientId')
    const q = sp.get('q')?.trim()

    const pageRaw = Number(sp.get('page') || 1)
    const limitRaw = Number(sp.get('limit') || 10)

    const page = Number.isNaN(pageRaw) ? 1 : Math.max(pageRaw, 1)
    const limit = Number.isNaN(limitRaw)
      ? 10
      : Math.min(Math.max(limitRaw, 1), 50)

    const skip = (page - 1) * limit

    if (status && !allowedStatuses.includes(status as any)) {
      return err('حالة القضية غير صالحة', 400)
    }

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: {
          id: clientId,
          tenantId: auth.user.tenantId,
        },
        select: { id: true },
      })

      if (!clientExists) {
        return err('الموكل غير موجود داخل هذا المكتب', 404)
      }
    }

    const where: Prisma.CaseWhereInput = {
      tenantId: auth.user.tenantId,
      ...(status ? { status: status as any } : {}),
      ...(clientId ? { clientId } : {}),
      ...(q
        ? {
            OR: [
              {
                title: {
                  contains: q,
                  mode: 'insensitive',
                },
              },
              {
                caseNumber: {
                  contains: q,
                  mode: 'insensitive',
                },
              },
              {
                client: {
                  name: {
                    contains: q,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.case.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          payments: { select: { amount: true, status: true } },
          _count: {
            select: {
              appointments: true,
              documents: true,
              tasks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),

      prisma.case.count({ where }),
    ])

    return ok({
      data,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  })
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const limitError = await enforceResourceLimit(auth.user.tenantId, 'cases')
    if (limitError) return limitError

    const meta = getRequestMeta(req)
    const body = await req.json().catch(() => ({}))
    const parsed = caseSchema.safeParse(body)

    if (!parsed.success) {
      return err('بيانات غير صالحة', 400, parsed.error.flatten())
    }

    const client = await prisma.client.findFirst({
      where: {
        id: parsed.data.clientId,
        tenantId: auth.user.tenantId,
      },
    })

    if (!client) return err('الموكل غير موجود', 404)

    if (parsed.data.caseNumber) {
      const exists = await prisma.case.findFirst({
        where: {
          tenantId: auth.user.tenantId,
          caseNumber: parsed.data.caseNumber,
        },
        select: { id: true },
      })

      if (exists) {
        return err('رقم القضية مستخدم مسبقًا', 409)
      }
    }

    const newCase = await prisma.case.create({
      data: {
        tenantId: auth.user.tenantId,
        ...parsed.data,
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    })

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: 'CASE_CREATED',
      title: 'تم إنشاء قضية جديدة',
      message: newCase.title,
      entityType: 'CASE',
      entityId: newCase.id,
    })

    return ok(newCase, 201)
  })
}
