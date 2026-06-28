import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ok } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

function addAndCondition(
  where: Prisma.ActivityWhereInput,
  condition: Prisma.ActivityWhereInput
) {
  const currentAnd = where.AND

  if (!currentAnd) {
    where.AND = [condition]
    return
  }

  where.AND = Array.isArray(currentAnd)
    ? [...currentAnd, condition]
    : [currentAnd, condition]
}

function categoryCondition(category: string): Prisma.ActivityWhereInput | null {
  const contains = (value: string): Prisma.StringFilter<'Activity'> => ({
    contains: value,
    mode: 'insensitive',
  })

  const fields = (values: string[]): Prisma.ActivityWhereInput => ({
    OR: values.flatMap((value) => [
      { type: contains(value) },
      { title: contains(value) },
      { message: contains(value) },
      { entityType: contains(value) },
    ]),
  })

  switch (category) {
    case 'clients':
      return fields(['CLIENT', 'موكل'])
    case 'cases':
      return fields(['CASE', 'قضية'])
    case 'appointments':
      return fields(['APPOINTMENT', 'موعد'])
    case 'tasks':
      return fields(['TASK', 'مهمة'])
    case 'documents':
      return fields(['DOCUMENT', 'مستند'])
    case 'payments':
      return fields(['PAYMENT', 'دفعة'])
    case 'invoices':
      return fields(['INVOICE', 'فاتورة'])
    case 'security':
      return fields([
        'LOGIN',
        'LOGOUT',
        'SESSION',
        'PASSWORD',
        '2FA',
        'TWO_FACTOR',
        'AUTH',
        'تسجيل دخول',
        'تسجيل خروج',
        'كلمة المرور',
        'التحقق الثنائي',
      ])
    default:
      return null
  }
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])

    if (auth.error || !auth.user) {
      return auth.error
    }

    const sp = new URL(req.url).searchParams

    const pageRaw = Number(sp.get('page') || 1)
    const limitRaw = Number(sp.get('limit') || 10)

    const type = sp.get('type')?.trim() || undefined
    const category = sp.get('category')?.trim() || undefined
    const q = sp.get('q')?.trim() || undefined

    const page = Number.isNaN(pageRaw) ? 1 : Math.max(pageRaw, 1)
    const limit = Number.isNaN(limitRaw)
      ? 10
      : Math.min(Math.max(limitRaw, 1), 100)

    const skip = (page - 1) * limit

    const where: Prisma.ActivityWhereInput = {
      tenantId: auth.user.tenantId,
    }

    if (type) {
      where.type = type
    }

    if (category && category !== 'all') {
      const condition = categoryCondition(category)

      if (condition) {
        addAndCondition(where, condition)
      }
    }

    if (q) {
      addAndCondition(where, {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { message: { contains: q, mode: 'insensitive' } },
          { type: { contains: q, mode: 'insensitive' } },
          { entityType: { contains: q, mode: 'insensitive' } },
        ],
      })
    }

    const [pageActivities, total] = await prisma.$transaction([
      prisma.activity.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ])

    const actorIds = Array.from(
      new Set(pageActivities.map((a) => a.actorId).filter(Boolean) as string[])
    )

    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: {
            tenantId: auth.user.tenantId,
            id: { in: actorIds },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        })
      : []

    const actorMap = new Map(actors.map((u) => [u.id, u]))
    const totalPages = Math.ceil(total / limit)

    return ok({
      items: pageActivities.map((activity) => ({
        ...activity,
        actor: activity.actorId ? actorMap.get(activity.actorId) ?? null : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        from: total === 0 ? 0 : skip + 1,
        to: Math.min(skip + limit, total),
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    })
  })
}
