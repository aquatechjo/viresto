import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/tenant'
import { ok } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const ctx = await requireTenant(req)

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)

    const [upcomingAppointments, pendingPayments, overdueTasks] =
      await Promise.all([
        prisma.appointment.findMany({
          where: {
            tenantId: ctx.tenantId,
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
            tenantId: ctx.tenantId,
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
            tenantId: ctx.tenantId,
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