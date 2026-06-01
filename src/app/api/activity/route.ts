import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ok } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])

    if (auth.error || !auth.user) {
      return auth.error
    }

    const sp = new URL(req.url).searchParams
    const limitRaw = Number(sp.get('limit') || 50)
    const type = sp.get('type')?.trim() || undefined
    const q = sp.get('q')?.trim() || undefined

    const limit = Number.isNaN(limitRaw)
      ? 50
      : Math.min(Math.max(limitRaw, 1), 100)

    const where: Prisma.ActivityWhereInput = {
      tenantId: auth.user.tenantId,
    }

    if (type) {
      where.type = type
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        { type: { contains: q, mode: 'insensitive' } },
        { entityType: { contains: q, mode: 'insensitive' } },
      ]
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    const actorIds = Array.from(
      new Set(activities.map((a) => a.actorId).filter(Boolean) as string[])
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

    return ok(
      activities.map((activity) => ({
        ...activity,
        actor: activity.actorId ? actorMap.get(activity.actorId) ?? null : null,
      }))
    )
  })
}
