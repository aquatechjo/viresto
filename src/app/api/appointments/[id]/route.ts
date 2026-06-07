import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { appointmentSchema } from '@/lib/validations'
import { ok, err, notFound } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole, getRequestMeta } from '@/lib/api-auth'
import { logActivity } from '@/lib/activity'

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

    const meta = getRequestMeta(req)

    const tenantError = await ensureTenantActive(auth.user.tenantId)
    if (tenantError) return tenantError

    const { id } = await params

    const exists = await prisma.appointment.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        title: true,
        caseId: true,
        clientId: true,
        startTime: true,
        endTime: true,
        client: {
          select: {
            id: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            client: {
              select: {
                id: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    })

    if (!exists) {
      return notFound('الموعد غير موجود')
    }

    const isCurrentlyArchivedClient = Boolean(
      exists.client?.archivedAt || exists.case?.client?.archivedAt
    )

    if (isCurrentlyArchivedClient) {
      return err('لا يمكن تعديل موعد مرتبط بموكل مؤرشف', 400)
    }

    const body = await req.json().catch(() => ({}))
    const parsed = appointmentSchema.partial().safeParse(body)

    if (!parsed.success) {
      return err('بيانات غير صالحة', 400, parsed.error.flatten())
    }

    if (Object.keys(parsed.data).length === 0) {
      return err('لا توجد بيانات للتعديل', 400)
    }

    let startTime: Date | undefined
    let endTime: Date | undefined | null

    if (parsed.data.startTime !== undefined) {
      startTime = new Date(parsed.data.startTime)

      if (Number.isNaN(startTime.getTime())) {
        return err('تاريخ بداية الموعد غير صالح', 400)
      }
    }

    if (parsed.data.endTime !== undefined) {
      if (parsed.data.endTime) {
        endTime = new Date(parsed.data.endTime)

        if (Number.isNaN(endTime.getTime())) {
          return err('تاريخ نهاية الموعد غير صالح', 400)
        }
      } else {
        endTime = null
      }
    }

    const finalStart = startTime ?? exists.startTime
    const finalEnd = endTime !== undefined ? endTime : exists.endTime

    if (finalEnd && finalEnd <= finalStart) {
      return err('تاريخ نهاية الموعد يجب أن يكون بعد تاريخ البداية', 400)
    }

    const {
      startTime: _startTime,
      endTime: _endTime,
      clientId,
      caseId,
      ...rest
    } = parsed.data

    let linkedClientId =
      clientId !== undefined ? clientId : exists.clientId

    if (clientId) {
      const clientExists = await prisma.client.findFirst({
        where: {
          id: clientId,
          tenantId: auth.user.tenantId,
        },
        select: {
          id: true,
          archivedAt: true,
        },
      })

      if (!clientExists) {
        return err('لا يمكن ربط الموعد بموكل لا يتبع هذا المكتب', 403)
      }

      if (clientExists.archivedAt) {
        return err('لا يمكن ربط الموعد بموكل مؤرشف', 400)
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
          clientId: true,
          client: {
            select: {
              id: true,
              archivedAt: true,
            },
          },
        },
      })

      if (!caseExists) {
        return err(
          'لا يمكن ربط الموعد بقضية لا تتبع هذا المكتب أو لا تتبع الموكل المحدد',
          403
        )
      }

      if (caseExists.client?.archivedAt) {
        return err('لا يمكن ربط الموعد بقضية موكلها مؤرشف', 400)
      }

      linkedClientId = caseExists.clientId
    }

    const updated = await prisma.appointment.update({
      where: {
        id: exists.id,
      },
      data: {
        ...rest,
        ...(clientId !== undefined ? { clientId: linkedClientId } : {}),
        ...(caseId !== undefined ? { caseId } : {}),
        ...(startTime !== undefined ? { startTime } : {}),
        ...(endTime !== undefined ? { endTime } : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
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
                archivedAt: true,
              },
            },
          },
        },
      },
    })

    const activityCaseId = updated.caseId || exists.caseId

    if (activityCaseId) {
      await logActivity({
        actorId: auth.user.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        tenantId: auth.user.tenantId,
        type: 'CASE_UPDATED',
        title: 'تم تعديل موعد',
        message: updated.title,
        entityType: 'CASE',
        entityId: activityCaseId,
      })
    }

    return ok(updated)
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const meta = getRequestMeta(req)

    const tenantError = await ensureTenantActive(auth.user.tenantId)
    if (tenantError) return tenantError

    const { id } = await params

    const exists = await prisma.appointment.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        title: true,
        caseId: true,
        clientId: true,
        client: {
          select: {
            id: true,
            archivedAt: true,
          },
        },
        case: {
          select: {
            id: true,
            client: {
              select: {
                id: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    })

    if (!exists) {
      return notFound('الموعد غير موجود')
    }

    const isArchivedClient = Boolean(
      exists.client?.archivedAt || exists.case?.client?.archivedAt
    )

    if (isArchivedClient) {
      return err('لا يمكن حذف موعد مرتبط بموكل مؤرشف', 400)
    }

    await prisma.appointment.delete({
      where: {
        id: exists.id,
      },
    })

    if (exists.caseId) {
      await logActivity({
        actorId: auth.user.userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        tenantId: auth.user.tenantId,
        type: 'CASE_UPDATED',
        title: 'تم حذف موعد',
        message: exists.title,
        entityType: 'CASE',
        entityId: exists.caseId,
      })
    }

    return ok({ deleted: true })
  })
}