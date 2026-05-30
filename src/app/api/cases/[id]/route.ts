import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, getRequestMeta } from '@/lib/api-auth'
import { caseSchema } from '@/lib/validations'
import { ok, err, notFound } from '@/lib/api-response'
import { logActivity } from '@/lib/activity'
import { apiHandler } from '@/lib/api-handler'
type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {

    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const { id } = await params

const c = await prisma.case.findFirst({
  where: {
    id,
    tenantId: auth.user.tenantId,
  },
  include: {
client: {
  select: {
    id: true,
    name: true,
  },
},

    payments: {
      orderBy: { paidAt: 'desc' },
    },

    appointments: {
      orderBy: { startTime: 'asc' },
    },

    documents: {
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        notes: true,
        tags: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    },

    tasks: {
      orderBy: { dueDate: 'asc' },
    },
  },
})

    if (!c) {
      return notFound('القضية غير موجودة')
    }

    return ok(c)

  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {

    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error
    const meta = getRequestMeta(req)

    const tenant = await prisma.tenant.findUnique({
  where: { id: auth.user.tenantId },
  select: {
    isSuspended: true,
    status: true,
  },
})

if (!tenant) {
  return err('المكتب غير موجود', 404)
}

if (tenant.isSuspended || tenant.status === 'SUSPENDED') {
  return err('لا يمكن تعديل القضايا لأن المكتب موقوف', 403)
}

if (tenant.status === 'EXPIRED') {
  return err('لا يمكن تعديل القضايا لأن الاشتراك منتهي', 403)
}


    const { id } = await params

    const exists = await prisma.case.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        title: true,
      },
    })

    if (!exists) {
      return notFound('القضية غير موجودة')
    }

    const body = await req.json().catch(() => ({}))
    const parsed = caseSchema.partial().safeParse(body)

    if (!parsed.success) {
      return err('بيانات غير صالحة', 400, parsed.error.flatten())
    }

    if (Object.keys(parsed.data).length === 0) {
      return err('لا توجد بيانات للتعديل', 400)
    }

    if (parsed.data.clientId) {
      const clientExists = await prisma.client.findFirst({
        where: {
          id: parsed.data.clientId,
          tenantId: auth.user.tenantId,
        },
        select: { id: true },
      })

      if (!clientExists) {
        return err('لا يمكن ربط القضية بموكل لا يتبع هذا المكتب', 403)
      }
    }

    if (parsed.data.caseNumber) {
      const duplicate = await prisma.case.findFirst({
        where: {
          tenantId: auth.user.tenantId,
          caseNumber: parsed.data.caseNumber,
          NOT: { id },
        },
        select: { id: true },
      })

      if (duplicate) {
        return err('رقم القضية مستخدم مسبقًا', 409)
      }
    }

    const updated = await prisma.case.update({
      where: { id: exists.id },
      data: parsed.data,
    })

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: 'CASE_UPDATED',
      title: 'تم تعديل قضية',
      message: updated.title,
      entityType: 'CASE',
      entityId: updated.id,
    })

    return ok(updated)

  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {

    const auth = await requireRole(req, ['ADMIN'])
    if (auth.error || !auth.user) return auth.error
    const meta = getRequestMeta(req)

    const tenant = await prisma.tenant.findUnique({
  where: { id: auth.user.tenantId },
  select: {
    isSuspended: true,
    status: true,
  },
})

if (!tenant) {
  return err('المكتب غير موجود', 404)
}

if (tenant.isSuspended || tenant.status === 'SUSPENDED') {
  return err('لا يمكن حذف القضايا لأن المكتب موقوف', 403)
}

if (tenant.status === 'EXPIRED') {
  return err('لا يمكن حذف القضايا لأن الاشتراك منتهي', 403)
}


    const { id } = await params

    const exists = await prisma.case.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        title: true,
      },
    })

    if (!exists) {
      return notFound('القضية غير موجودة')
    }

    await prisma.case.delete({
      where: { id: exists.id },
    })

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: 'CASE_DELETED',
      title: 'تم حذف قضية',
      message: exists.title,
      entityType: 'CASE',
      entityId: exists.id,
    })

    return ok({ deleted: true })

  })
}