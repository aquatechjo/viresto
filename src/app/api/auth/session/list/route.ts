import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ok, err } from '@/lib/api-response'

export async function GET() {
  const session = await getSession()

  if (!session) {
    return err('غير مصرح', 401)
  }

  const sessions = await prisma.session.findMany({
    where: {
      userId: session.userId,
      tenantId: session.tenantId,
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
      isCurrent: s.id === session.sessionId,
    }))
  )
}