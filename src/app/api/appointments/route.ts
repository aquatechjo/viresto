import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { appointmentSchema } from '@/lib/validations'
import { ok, err } from '@/lib/api-response'
import { logActivity } from '@/lib/activity'
import { apiHandler } from '@/lib/api-handler'
import { requireRole, getRequestMeta } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const sp = new URL(req.url).searchParams
    const from = sp.get('from')
    const to = sp.get('to')
    const includeArchivedClients = sp.get('includeArchivedClients') === 'true'

    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null

    if (fromDate && Number.isNaN(fromDate.getTime())) {
      return err('تاريخ البداية غير صالح', 400)
    }

    if (toDate && Number.isNaN(toDate.getTime())) {
      return err('تاريخ النهاية غير صالح', 400)
    }

    const data = await prisma.appointment.findMany({
      where: {
        tenantId: auth.user.tenantId,

...(includeArchivedClients
  ? {}
  : {
      AND: [
        {
          OR: [
            {
              clientId: null,
            },
            {
              client: {
                archivedAt: null,
              },
            },
          ],
        },
        {
          OR: [
            {
              caseId: null,
            },
            {
              case: {
                client: {
                  archivedAt: null,
                },
              },
            },
          ],
        },
      ],
    }),

        ...(fromDate || toDate
          ? {
              startTime: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },

      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
case: {
  select: {
    id: true,
    title: true,
    client: {
      select: {
        id: true,
        name: true,
      },
    },
  },
},
      },

      orderBy: {
        startTime: 'asc',
      },
    })

    return ok(data)
  })
}


export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const meta = getRequestMeta(req)

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: auth.user.tenantId,
      },
      select: {
        isSuspended: true,
        status: true,
      },
    })

    if (!tenant) {
      return err('المكتب غير موجود', 404)
    }

    if (tenant.isSuspended || tenant.status === 'SUSPENDED') {
      return err('لا يمكن إنشاء مواعيد لأن المكتب موقوف', 403)
    }

    if (tenant.status === 'EXPIRED') {
      return err('لا يمكن إنشاء مواعيد لأن الاشتراك منتهي', 403)
    }

    const body = await req.json().catch(() => ({}))
    const parsed = appointmentSchema.safeParse(body)

    if (!parsed.success) {
      return err('بيانات غير صالحة', 400, parsed.error.flatten())
    }

    const startTime = new Date(parsed.data.startTime)
    const endTime = parsed.data.endTime
      ? new Date(parsed.data.endTime)
      : undefined

    if (Number.isNaN(startTime.getTime())) {
      return err('تاريخ بداية الموعد غير صالح', 400)
    }

    if (endTime && Number.isNaN(endTime.getTime())) {
      return err('تاريخ نهاية الموعد غير صالح', 400)
    }

    if (endTime && endTime <= startTime) {
      return err('تاريخ نهاية الموعد يجب أن يكون بعد تاريخ البداية', 400)
    }

    const { clientId, caseId } = parsed.data

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: {
          id: clientId,
          tenantId: auth.user.tenantId,
        },
        select: {
          id: true,
        },
      })

      if (!clientExists) {
        return err('لا يمكن ربط الموعد بموكل لا يتبع هذا المكتب', 403)
      }
    }

    if (caseId) {
      const caseExists = await prisma.case.findFirst({
        where: {
          id: caseId,
          tenantId: auth.user.tenantId,
          ...(clientId ? { clientId } : {}),
        },
        select: {
          id: true,
        },
      })

      if (!caseExists) {
        return err(
          'لا يمكن ربط الموعد بقضية لا تتبع هذا المكتب أو لا تتبع الموكل المحدد',
          403
        )
      }
    }

    const appt = await prisma.appointment.create({
      data: {
        tenantId: auth.user.tenantId,
        ...parsed.data,
        startTime,
        endTime,
      },
    })

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: 'APPOINTMENT_CREATED',
      title: 'تم إضافة موعد',
      message: appt.title ?? 'موعد جديد',
      entityType: caseId ? 'CASE' : 'APPOINTMENT',
      entityId: caseId || appt.id,
    })

    return ok(appt, 201)
  })
}