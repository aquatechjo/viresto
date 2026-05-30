import { NextRequest } from 'next/server'
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
    const limitRaw = Number(sp.get('limit') || 15)
    const type = sp.get('type') || undefined

    const limit = Number.isNaN(limitRaw)
      ? 15
      : Math.min(Math.max(limitRaw, 1), 50)

    const activities = await prisma.activity.findMany({
         where: {
           tenantId: auth.user.tenantId,
          ...(type ? { type } : {}),
       },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return ok(activities)
  })
}