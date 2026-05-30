import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, getRequestMeta } from '@/lib/api-auth'
import { paymentSchema } from '@/lib/validations'
import { ok, err } from '@/lib/api-response'
import { logActivity } from '@/lib/activity'
import { apiHandler } from '@/lib/api-handler'

const allowedStatuses = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'] as const

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])

    if (auth.error || !auth.user) {
      return auth.error
    }

    const sp = new URL(req.url).searchParams
    const caseId = sp.get('caseId')
    const status = sp.get('status')

    const limitRaw = Number(sp.get('limit') || 50)
    const limit = Number.isNaN(limitRaw)
      ? 50
      : Math.min(Math.max(limitRaw, 1), 100)

    if (status && !allowedStatuses.includes(status as any)) {
      return err('حالة الدفعة غير صالحة', 400)
    }

    if (caseId) {
      const caseExists = await prisma.case.findFirst({
        where: {
          id: caseId,
          tenantId: auth.user.tenantId,
        },
        select: { id: true },
      })

      if (!caseExists) {
        return err('القضية غير موجودة داخل هذا المكتب', 404)
      }
    }

    const data = await prisma.payment.findMany({
      where: {
        tenantId: auth.user.tenantId,
        ...(caseId ? { caseId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            client: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return ok(data)
  })
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])

    if (auth.error || !auth.user) {
      return auth.error
    }

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
      return err('لا يمكن تسجيل دفعات لأن المكتب موقوف', 403)
    }

    if (tenant.status === 'EXPIRED') {
      return err('لا يمكن تسجيل دفعات لأن الاشتراك منتهي', 403)
    }

    const body = await req.json().catch(() => ({}))
    const parsed = paymentSchema.safeParse(body)

    if (!parsed.success) {
      return err('بيانات غير صالحة', 400, parsed.error.flatten())
    }

    const c = await prisma.case.findFirst({
      where: {
        id: parsed.data.caseId,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        title: true,
      },
    })

    if (!c) {
      return err('القضية غير موجودة', 404)
    }

    const payment = await prisma.payment.create({
      data: {
        tenantId: auth.user.tenantId,
        ...parsed.data,
        paidAt: parsed.data.paidAt
          ? new Date(parsed.data.paidAt)
          : new Date(),
      },
    })

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: 'PAYMENT_CREATED',
      title: 'تم تسجيل دفعة جديدة',
      message: `${payment.amount} - ${c.title}`,
      entityType: 'PAYMENT',
      entityId: payment.id,
    })

    return ok(payment, 201)
  })
}