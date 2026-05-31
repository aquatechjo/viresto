import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireAuth(req)
    if (auth.error || !auth.user) return auth.error

    if (!auth.user.sessionId) {
      return err('جلسة غير صالحة', 401)
    }

    await prisma.session.updateMany({
      where: {
        userId: auth.user.userId,
        tenantId: auth.user.tenantId,
        isActive: true,
        id: {
          not: auth.user.sessionId,
        },
      },
      data: {
        isActive: false,
      },
    })

    return ok({ revoked: true })
  })
}
