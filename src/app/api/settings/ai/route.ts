import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'
import { verifySameOrigin } from '@/lib/csrf'
import { logActivity } from '@/lib/log-activity'
import { assertTenantCanWrite } from '@/lib/billing-limits'

export async function PATCH(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req)
    if (csrf) return csrf

    const auth = await requireRole(req, ['ADMIN'])

    if (auth.error || !auth.user) {
      return auth.error
    }

    const writeCheck = await assertTenantCanWrite(
      auth.user.tenantId,
      'تعديل إعدادات الذكاء الاصطناعي'
    )

    if (!writeCheck.ok) {
      return err(writeCheck.message, writeCheck.status)
    }

    const body = await req.json().catch(() => ({}))
    const enabled = Boolean(body.enabled)

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.user.tenantId },
      select: {
        id: true,
        isSuspended: true,
        status: true,
      },
    })

    if (!tenant) {
      return err('المكتب غير موجود', 404)
    }

    if (tenant.isSuspended || tenant.status === 'SUSPENDED') {
      return err('لا يمكن تعديل إعدادات الذكاء الاصطناعي لأن المكتب موقوف', 403)
    }

    if (tenant.status === 'EXPIRED') {
      return err('لا يمكن تعديل إعدادات الذكاء الاصطناعي لأن الاشتراك منتهي', 403)
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: auth.user.tenantId },
      data: {
        aiEnabled: enabled,
        aiConsentAt: enabled ? new Date() : null,
        aiConsentBy: enabled ? auth.user.userId : null,
      },
      select: {
        id: true,
        aiEnabled: true,
        aiConsentAt: true,
        aiConsentBy: true,
      },
    })

    await logActivity({
      req,
      tenantId: auth.user.tenantId,
      actorId: auth.user.userId,
      type: enabled ? 'AI_ENABLED' : 'AI_DISABLED',
      title: enabled
        ? 'تم تفعيل المساعد الذكي'
        : 'تم تعطيل المساعد الذكي',
      message: auth.user.email,
      entityType: 'TENANT',
      entityId: auth.user.tenantId,
    })

    return ok(updatedTenant)
  })
}