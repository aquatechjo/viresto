import { NextRequest } from 'next/server'
import { TaskPriority } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ok, err, notFound } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'

type Params = { params: Promise<{ id: string }> }

async function ensureTenantActive(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      isSuspended: true,
      status: true,
    },
  })

  if (!tenant) {
    return err('المكتب غير موجود', 404)
  }

  if (tenant.isSuspended || tenant.status === 'SUSPENDED') {
    return err('لا يمكن تنفيذ العملية لأن المكتب موقوف', 403)
  }

  if (tenant.status === 'EXPIRED') {
    return err('لا يمكن تنفيذ العملية لأن الاشتراك منتهي', 403)
  }

  return null
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const tenantError = await ensureTenantActive(auth.user.tenantId)
    if (tenantError) return tenantError

    const { id } = await params

    const exists = await prisma.task.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
      },
    })

    if (!exists) {
      return notFound('المهمة غير موجودة')
    }

    const body = await req.json().catch(() => ({}))

    const data: {
      completed?: boolean
      title?: string
      priority?: TaskPriority
      dueDate?: Date | null
    } = {}

    if ('completed' in body) {
      data.completed = Boolean(body.completed)
    }

    if ('title' in body) {
      const title = String(body.title).trim()

      if (!title) {
        return err('عنوان المهمة مطلوب', 400)
      }

      if (title.length > 200) {
        return err('عنوان المهمة طويل جدًا', 400)
      }

      data.title = title
    }

    if ('priority' in body) {
      const priority = String(body.priority).toUpperCase()

      if (!Object.values(TaskPriority).includes(priority as TaskPriority)) {
        return err('أولوية المهمة غير صحيحة', 400)
      }

      data.priority = priority as TaskPriority
    }

    if ('dueDate' in body) {
      if (body.dueDate) {
        const date = new Date(body.dueDate)

        if (Number.isNaN(date.getTime())) {
          return err('تاريخ المهمة غير صالح', 400)
        }

        data.dueDate = date
      } else {
        data.dueDate = null
      }
    }

    if (Object.keys(data).length === 0) {
      return err('لا توجد بيانات للتعديل', 400)
    }

    const updated = await prisma.task.update({
      where: {
        id: exists.id,
      },
      data,
    })

    return ok(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const tenantError = await ensureTenantActive(auth.user.tenantId)
    if (tenantError) return tenantError

    const { id } = await params

    const exists = await prisma.task.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
      },
    })

    if (!exists) {
      return notFound('المهمة غير موجودة')
    }

    await prisma.task.delete({
      where: {
        id: exists.id,
      },
    })

    return ok({ deleted: true })
  })
}