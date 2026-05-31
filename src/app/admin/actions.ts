'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireSystemAdmin } from '@/lib/system-admin'

const plans = ['FREE', 'PRO', 'ENTERPRISE'] as const
const statuses = ['ACTIVE', 'TRIAL', 'EXPIRED', 'SUSPENDED'] as const

export async function suspendTenant(id: string) {
  await requireSystemAdmin()

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      users: {
        select: {
          isSystemAdmin: true,
        },
      },
    },
  })

  if (!tenant) {
    throw new Error('المكتب غير موجود')
  }

  const hasSystemAdmin = tenant.users.some((user) => user.isSystemAdmin)

  if (hasSystemAdmin) {
    throw new Error('لا يمكن تعليق مكتب النظام الرئيسي')
  }

  await prisma.tenant.update({
    where: { id },
    data: {
      isSuspended: true,
      status: 'SUSPENDED',
    },
  })

  revalidatePath('/admin')
}

export async function activateTenant(id: string) {
  await requireSystemAdmin()

  await prisma.tenant.update({
    where: { id },
    data: {
      isSuspended: false,
      status: 'ACTIVE',
    },
  })

  revalidatePath('/admin')
}

export async function updateTenantBilling(id: string, formData: FormData) {
  await requireSystemAdmin()

  const plan = String(formData.get('plan') ?? '').toUpperCase()
  const status = String(formData.get('status') ?? '').toUpperCase()
  const maxUsersRaw = Number(formData.get('maxUsers') ?? 0)
  const trialEndsAtRaw = String(formData.get('trialEndsAt') ?? '').trim()

  if (!plans.includes(plan as any)) {
    throw new Error('الخطة غير صحيحة')
  }

  if (!statuses.includes(status as any)) {
    throw new Error('حالة الاشتراك غير صحيحة')
  }

  if (!Number.isFinite(maxUsersRaw) || maxUsersRaw < 1 || maxUsersRaw > 10000) {
    throw new Error('عدد المستخدمين غير صالح')
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      users: {
        select: { isSystemAdmin: true },
      },
    },
  })

  if (!tenant) {
    throw new Error('المكتب غير موجود')
  }

  const hasSystemAdmin = tenant.users.some((user) => user.isSystemAdmin)
  const nextStatus = status as any

  if (hasSystemAdmin && nextStatus === 'SUSPENDED') {
    throw new Error('لا يمكن إيقاف مكتب النظام الرئيسي')
  }

  await prisma.tenant.update({
    where: { id },
    data: {
      plan: plan as any,
      status: nextStatus,
      isSuspended: nextStatus === 'SUSPENDED',
      maxUsers: Math.floor(maxUsersRaw),
      trialEndsAt: trialEndsAtRaw ? new Date(`${trialEndsAtRaw}T23:59:59.000Z`) : null,
    },
  })

  revalidatePath('/admin')
}

export async function deactivateUser(id: string) {
  await requireSystemAdmin()

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      isSystemAdmin: true,
    },
  })

  if (!user) {
    throw new Error('المستخدم غير موجود')
  }

  if (user.isSystemAdmin) {
    throw new Error('لا يمكن تعطيل حساب مدير النظام')
  }

  await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
    },
  })

  revalidatePath('/admin')
}

export async function activateUser(id: string) {
  await requireSystemAdmin()

  await prisma.user.update({
    where: { id },
    data: {
      isActive: true,
    },
  })

  revalidatePath('/admin')
}
