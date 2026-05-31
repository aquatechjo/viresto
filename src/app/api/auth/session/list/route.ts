import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireAuth(req)
    if (auth.error || !auth.user) return auth.error

    const sessions = await prisma.session.findMany({
      where: {
        userId: auth.user.userId,
        tenantId: auth.user.tenantId,
        isActive: true,
      },
      orderBy: {
        lastActivityAt: 'desc',
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        country: true,
        city: true,
        lastActivityAt: true,
        createdAt: true,
      },
    })

    return ok(
      sessions.map((s) => ({
        ...s,
        isCurrent: s.id === auth.user?.sessionId,
      }))
    )
  })
}
