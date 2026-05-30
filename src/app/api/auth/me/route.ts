import { NextRequest } from 'next/server'
import { ok, unauthorized } from '@/lib/api-response'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)

  if (auth.error || !auth.user) {
    return auth.error
  }

  const user = await prisma.user.findFirst({
    where: {
      id: auth.user.userId,
      tenantId: auth.user.tenantId,
      isActive: true,
      tenant: {
        isSuspended: false,
        status: {
          notIn: ['SUSPENDED', 'EXPIRED'],
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSystemAdmin: true,
      twoFactorEnabled: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          status: true,
          isSuspended: true,
          trialEndsAt: true,
        },
      },
    },
  })

  if (!user) {
    return unauthorized()
  }

  return ok(user)
}