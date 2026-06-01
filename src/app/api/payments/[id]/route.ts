import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, getRequestMeta } from '@/lib/api-auth'
import { paymentSchema } from '@/lib/validations'
import { ok, err, notFound } from '@/lib/api-response'
import { logActivity } from '@/lib/activity'
import { apiHandler } from '@/lib/api-handler'

type Params = { params: Promise<{ id: string }> }

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
  return err('لا يمكن تعديل الدفعات لأن المكتب موقوف', 403)
}

if (tenant.status === 'EXPIRED') {
  return err('لا يمكن تعديل الدفعات لأن الاشتراك منتهي', 403)
}


    const { id } = await params

    const exists = await prisma.payment.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        amount: true,
        caseId: true,
        invoiceId: true,
      },
    })

    if (!exists) {
      return notFound('الدفعة غير موجودة')
    }

    const body = await req.json().catch(() => ({}))
    const parsed = paymentSchema.partial().safeParse(body)

    if (!parsed.success) {
      return err('بيانات غير صالحة', 400, parsed.error.flatten())
    }

    if (Object.keys(parsed.data).length === 0) {
      return err('لا توجد بيانات للتعديل', 400)
    }

    if (parsed.data.caseId) {
      const caseExists = await prisma.case.findFirst({
        where: {
          id: parsed.data.caseId,
          tenantId: auth.user.tenantId,
        },
        select: { id: true },
      })

      if (!caseExists) {
        return err('لا يمكن ربط الدفعة بقضية لا تتبع هذا المكتب', 403)
      }
    }

let paidAt: Date | undefined

if (parsed.data.paidAt !== undefined) {
  const date = new Date(parsed.data.paidAt)

  if (Number.isNaN(date.getTime())) {
    return err('تاريخ الدفع غير صالح', 400)
  }

  paidAt = date
}

const { paidAt: _paidAt, ...rest } = parsed.data

const updated = await prisma.payment.update({
  where: { id: exists.id },
  data: {
    ...rest,
    ...(paidAt !== undefined ? { paidAt } : {}),
  },
})

    await logActivity({
      tenantId: auth.user.tenantId,
      type: 'PAYMENT_UPDATED',
      title: 'تم تعديل دفعة',
      message: String(updated.amount),
      entityType: 'CASE',
      entityId: updated.caseId,
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
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
  return err('لا يمكن حذف الدفعات لأن المكتب موقوف', 403)
}

if (tenant.status === 'EXPIRED') {
  return err('لا يمكن حذف الدفعات لأن الاشتراك منتهي', 403)
}


    const { id } = await params

    const exists = await prisma.payment.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        amount: true,
        caseId: true,
        invoiceId: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
          },
        },
      },
    })

    if (!exists) {
      return notFound('الدفعة غير موجودة')
    }

    if (exists.invoiceId) {
      return err(
        'لا يمكن حذف دفعة مرتبطة بفاتورة. افتح الفاتورة وغيّر حالتها أولًا حتى لا يحدث خلل مالي.',
        409,
        { invoiceId: exists.invoiceId, invoiceNumber: exists.invoice?.invoiceNumber }
      )
    }

    await prisma.payment.delete({
      where: { id: exists.id },
    })

    await logActivity({
      tenantId: auth.user.tenantId,
      type: 'PAYMENT_DELETED',
      title: 'تم حذف دفعة',
      message: String(exists.amount),
      entityType: 'CASE',
      entityId: exists.caseId,
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    return ok({ deleted: true })
  })
}