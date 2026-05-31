import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'
import { ok } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const tid = auth.user.tenantId

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const [
      clientCount,
      activeCaseCount,
      totalCasesCount,
      closedCasesCount,
      todayAppts,
      upcomingAppointments,
      payments,
      monthPayments,
      newClientsThisMonth,
    ] = await Promise.all([
      prisma.client.count({
        where: { tenantId: tid },
      }),

      prisma.case.count({
        where: {
          tenantId: tid,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),

      prisma.case.count({
        where: { tenantId: tid },
      }),

      prisma.case.count({
        where: {
          tenantId: tid,
          status: 'CLOSED',
        },
      }),

      prisma.appointment.findMany({
        where: {
          tenantId: tid,
          startTime: {
            gte: today,
            lt: tomorrow,
          },
        },
        orderBy: { startTime: 'asc' },
        include: {
          client: { select: { name: true } },
          case: { select: { title: true } },
        },
      }),

      prisma.appointment.findMany({
        where: {
          tenantId: tid,
          startTime: { gte: new Date() },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
        include: {
          client: { select: { name: true } },
          case: { select: { title: true } },
        },
      }),

      prisma.payment.findMany({
        where: { tenantId: tid },
        select: {
          amount: true,
          status: true,
        },
      }),

      prisma.payment.findMany({
        where: {
          tenantId: tid,
          status: 'PAID',
          paidAt: { gte: monthStart },
        },
        select: { amount: true },
      }),

      prisma.client.count({
        where: {
          tenantId: tid,
          createdAt: { gte: monthStart },
        },
      }),
    ])

    const totalRevenue = payments
      .filter((p) => p.status === 'PAID')
      .reduce((s, p) => s + Number(p.amount || 0), 0)

    const pendingAmount = payments
      .filter((p) => p.status === 'PENDING')
      .reduce((s, p) => s + Number(p.amount || 0), 0)

    const monthlyRevenue = monthPayments.reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    )

    const closedCaseRate =
      totalCasesCount > 0
        ? Math.round((closedCasesCount / totalCasesCount) * 100)
        : 0

    return ok({
      clientCount,
      activeCaseCount,
      totalCasesCount,
      closedCasesCount,
      closedCaseRate,
      todayApptCount: todayAppts.length,
      totalRevenue,
      monthlyRevenue,
      pendingAmount,
      newClientsThisMonth,
      todayAppts,
      upcomingAppointments,
    })
  })
}
