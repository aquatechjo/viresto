import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireAuth(req)

    if (auth.error || !auth.user?.sessionId) {
      return ok({ updated: false })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'

    await prisma.session.updateMany({
      where: {
        id: auth.user.sessionId,
        userId: auth.user.userId,
        tenantId: auth.user.tenantId,
        isActive: true,
      },
      data: {
        lastActivityAt: new Date(),
        ipAddress: ip,
        userAgent: req.headers.get('user-agent'),
      },
    })

    return ok({ updated: true })
  })
}
