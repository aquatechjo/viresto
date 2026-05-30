import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { taskSchema } from '@/lib/validations'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const completed = new URL(req.url).searchParams.get('completed')

    if (
      completed !== null &&
      completed !== 'true' &&
      completed !== 'false'
    ) {
      return err('قيمة completed غير صالحة', 400)
    }

    const data = await prisma.task.findMany({
      where: {
        tenantId: auth.user.tenantId,
        ...(completed !== null
          ? {
              completed: completed === 'true',
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
          },
        },
      },
      orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }],
    })

    return ok(data)
  })
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

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
      return err('لا يمكن إنشاء مهام لأن المكتب موقوف', 403)
    }

    if (tenant.status === 'EXPIRED') {
      return err('لا يمكن إنشاء مهام لأن الاشتراك منتهي', 403)
    }

    const body = await req.json().catch(() => ({}))
    const parsed = taskSchema.safeParse(body)

    if (!parsed.success) {
      return err('بيانات غير صالحة', 400, parsed.error.flatten())
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
        return err('لا يمكن ربط المهمة بموكل لا يتبع هذا المكتب', 403)
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
          'لا يمكن ربط المهمة بقضية لا تتبع هذا المكتب أو لا تتبع الموكل المحدد',
          403
        )
      }
    }

    let dueDate: Date | undefined

    if (parsed.data.dueDate !== undefined) {
      const date = new Date(parsed.data.dueDate)

      if (Number.isNaN(date.getTime())) {
        return err('تاريخ المهمة غير صالح', 400)
      }

      dueDate = date
    }

    const { dueDate: _dueDate, ...rest } = parsed.data

    const task = await prisma.task.create({
      data: {
        tenantId: auth.user.tenantId,
        ...rest,
        ...(dueDate !== undefined ? { dueDate } : {}),
      },
    })

    return ok(task, 201)
  })
}