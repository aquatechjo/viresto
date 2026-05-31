import { NextRequest, NextResponse } from 'next/server'
import { clearCookie, COOKIE, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiHandler } from '@/lib/api-handler'

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const token = req.cookies.get(COOKIE)?.value
    const session = token ? await verifyToken(token) : null

    if (session?.sessionId) {
      await prisma.session.updateMany({
        where: {
          id: session.sessionId,
          userId: session.userId,
          tenantId: session.tenantId,
        },
        data: {
          isActive: false,
        },
      })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set(clearCookie())
    return res
  })
}
