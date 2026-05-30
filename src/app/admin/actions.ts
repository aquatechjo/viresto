'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireSystemAdmin } from '@/lib/system-admin'

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