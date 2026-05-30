import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { ok, err } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const current = await getSession()

  if (!current) {
    return err('غير مصرح', 401)
  }

  const body = await req.json().catch(() => ({}))

  const sessionId = String(body.sessionId || '')

  if (!sessionId) {
    return err('sessionId مطلوب', 400)
  }

  await prisma.session.updateMany({
    where: {
      id: sessionId,
      tenantId: current.tenantId,
      userId: current.userId,
    },
    data: {
      isActive: false,
    },
  })

  return ok({ revoked: true })
}