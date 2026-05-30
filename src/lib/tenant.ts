import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { unauthorized } from '@/lib/api-response'

export interface TenantCtx {
  tenantId: string
  userId: string
  role: string
  email: string
  name: string
  isSystemAdmin: boolean
}

export async function requireTenant(req?: NextRequest): Promise<TenantCtx> {
  if (req) {
    const auth = await requireAuth(req)

    if (auth.error || !auth.user) {
      throw unauthorized()
    }

    return {
      tenantId: auth.user.tenantId,
      userId: auth.user.userId,
      role: auth.user.role ?? 'USER',
      email: auth.user.email ?? '',
      name: auth.user.name ?? '',
      isSystemAdmin: Boolean(auth.user.isSystemAdmin),
    }
  }

  throw unauthorized()
}