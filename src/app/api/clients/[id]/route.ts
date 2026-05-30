import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, getRequestMeta } from '@/lib/api-auth'
import { clientSchema } from '@/lib/validations'
import { ok, err, notFound } from '@/lib/api-response'
import { logActivity } from '@/lib/activity'
import { apiHandler } from '@/lib/api-handler'
import {
  encryptText,
  decryptText,
  normalizeEmail,
  normalizePhone,
  hashSearchValue,
} from '@/lib/encryption'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {

  const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
  if (auth.error || !auth.user) return auth.error

  const { id } = await params

  const client = await prisma.client.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
    },
    include: {
      cases: {
        include: {
          payments: true,
          _count: {
            select: {
              
              appointments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      appointments: { orderBy: { startTime: 'desc' }, take: 5 },
      tasks: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })

  if (!client) {
    return notFound('الموكل غير موجود')
  }

  const decryptedClient = {
  ...client,
  email: decryptText(client.email),
  phone: decryptText(client.phone),
  nationalId: decryptText(client.nationalId),
  address: decryptText(client.address),
  notes: decryptText(client.notes),
}

return ok(decryptedClient)
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
  return err('لا يمكن تعديل الموكلين لأن المكتب موقوف', 403)
}

if (tenant.status === 'EXPIRED') {
  return err('لا يمكن تعديل الموكلين لأن الاشتراك منتهي', 403)
}


    const { id } = await params

    const exists = await prisma.client.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (!exists) {
      return notFound('الموكل غير موجود')
    }

    const body = await req.json().catch(() => ({}))
    const parsed = clientSchema.partial().safeParse(body)

    if (!parsed.success) {
      return err('بيانات غير صالحة', 400, parsed.error.flatten())
    }

    if (Object.keys(parsed.data).length === 0) {
      return err('لا توجد بيانات للتعديل', 400)
    }

const secureData = {
  ...parsed.data,

  ...(parsed.data.email !== undefined
    ? {
        email: encryptText(parsed.data.email),
        emailHash: hashSearchValue(normalizeEmail(parsed.data.email)),
      }
    : {}),

  ...(parsed.data.phone !== undefined
    ? {
        phone: encryptText(parsed.data.phone),
        phoneHash: hashSearchValue(normalizePhone(parsed.data.phone)),
      }
    : {}),

...(parsed.data.nationalId !== undefined
  ? {
      nationalId: encryptText(parsed.data.nationalId),
      nationalIdHash: parsed.data.nationalId?.trim()
        ? hashSearchValue(parsed.data.nationalId.trim())
        : null,
    }
  : {}),

  ...(parsed.data.address !== undefined
    ? { address: encryptText(parsed.data.address) }
    : {}),

  ...(parsed.data.notes !== undefined
    ? { notes: encryptText(parsed.data.notes) }
    : {}),
}

    const updated = await prisma.client.update({
      where: { id: exists.id },
      data: secureData,
    })

    await logActivity({
      tenantId: auth.user.tenantId,
      type: 'CLIENT_UPDATED',
      title: 'تم تعديل بيانات موكل',
      message: updated.name,
      entityType: 'CLIENT',
      entityId: updated.id,
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
     userAgent: meta.userAgent,
    })

    return ok({
  ...updated,
  email: decryptText(updated.email),
  phone: decryptText(updated.phone),
  nationalId: decryptText(updated.nationalId),
  address: decryptText(updated.address),
  notes: decryptText(updated.notes),
})
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
  return err('لا يمكن حذف الموكلين لأن المكتب موقوف', 403)
}

if (tenant.status === 'EXPIRED') {
  return err('لا يمكن حذف الموكلين لأن الاشتراك منتهي', 403)
}


    const { id } = await params

    const exists = await prisma.client.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            cases: true,
          },
        },
      },
    })

    if (!exists) {
      return notFound('الموكل غير موجود')
    }

    if (exists._count.cases > 0) {
      return err('لا يمكن حذف موكل لديه قضايا مرتبطة. يمكنك أرشفته أو حذف القضايا أولًا.', 409)
    }

    await prisma.client.delete({
      where: { id: exists.id },
    })

    await logActivity({
      tenantId: auth.user.tenantId,
      type: 'CLIENT_DELETED',
      title: 'تم حذف موكل',
      message: exists.name,
      entityType: 'CLIENT',
      entityId: exists.id,
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({ deleted: true })
  })
}