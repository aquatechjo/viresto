import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ok } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const session = await getSession()

  if (!session?.sessionId) {
    return ok({ updated: false })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  await prisma.session.updateMany({
    where: {
      id: session.sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      isActive: true,
    },
    data: {
      lastActivityAt: new Date(),
      ipAddress: ip,
      userAgent: req.headers.get('user-agent'),
    },
  })

  return ok({ updated: true })
}