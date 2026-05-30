import { NextResponse } from 'next/server'
import { clearCookie, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getSession()

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
}