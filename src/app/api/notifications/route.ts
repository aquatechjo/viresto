import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)

    const [upcomingAppointments, pendingPayments, overdueTasks] =
      await Promise.all([
        prisma.appointment.findMany({
          where: {
            tenantId: auth.user.tenantId,
            startTime: {
              gte: now,
              lte: tomorrow,
            },
          },
          take: 5,
          orderBy: { startTime: 'asc' },
          include: {
            client: { select: { name: true } },
            case: { select: { title: true } },
          },
        }),

        prisma.payment.findMany({
          where: {
            tenantId: auth.user.tenantId,
            status: 'PENDING',
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            case: {
              select: {
                title: true,
                client: {
                  select: { name: true },
                },
              },
            },
          },
        }),

        prisma.task.findMany({
          where: {
            tenantId: auth.user.tenantId,
            completed: false,
            dueDate: {
              lt: now,
            },
          },
          take: 5,
          orderBy: { dueDate: 'asc' },
          include: {
            client: { select: { name: true } },
            case: { select: { title: true } },
          },
        }),
      ])

    return ok({
      upcomingAppointments,
      pendingPayments,
      overdueTasks,
      count:
        upcomingAppointments.length +
        pendingPayments.length +
        overdueTasks.length,
    })
  })
}
