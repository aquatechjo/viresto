import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ok, err } from '@/lib/api-response'

export async function POST() {
  const current = await getSession()

  if (!current?.sessionId) {
    return err('غير مصرح', 401)
  }

  await prisma.session.updateMany({
    where: {
      userId: current.userId,
      tenantId: current.tenantId,
      isActive: true,
      id: {
        not: current.sessionId,
      },
    },
    data: {
      isActive: false,
    },
  })

  return ok({ revoked: true })
}