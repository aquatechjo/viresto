import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

const allowedRoles = ['ADMIN', 'LAWYER', 'STAFF'] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN'])
    if (auth.error || !auth.user) return auth.error

    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
        isSystemAdmin: true,
      },
    })

    if (!targetUser) {
      return err('المستخدم غير موجود', 404)
    }

    if (targetUser.isSystemAdmin) {
      return err('لا يمكن تعديل حساب مدير النظام', 403)
    }

    if (targetUser.id === auth.user.userId && body.isActive === false) {
      return err('لا يمكنك تعطيل حسابك الحالي', 400)
    }

    if (
      targetUser.id === auth.user.userId &&
      body.role &&
      body.role !== targetUser.role
    ) {
      return err('لا يمكنك تغيير صلاحية حسابك الحالي', 400)
    }

    const role = body.role ? String(body.role).toUpperCase() : undefined

    if (role && !allowedRoles.includes(role as any)) {
      return err('صلاحية غير صحيحة', 400)
    }

    const updated = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        role: role as any,
        isActive:
          typeof body.isActive === 'boolean' ? body.isActive : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isSystemAdmin: true,
        createdAt: true,
      },
    })

    return ok(updated)
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN'])
    if (auth.error || !auth.user) return auth.error

    const { id } = await params

    if (id === auth.user.userId) {
      return err('لا يمكنك حذف حسابك الحالي', 400)
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        isSystemAdmin: true,
      },
    })

    if (!targetUser) {
      return err('المستخدم غير موجود', 404)
    }

    if (targetUser.isSystemAdmin) {
      return err('لا يمكن حذف حساب مدير النظام', 403)
    }

    await prisma.user.delete({
      where: { id: targetUser.id },
    })

    return ok({ message: 'تم حذف المستخدم بنجاح' })
  })
}