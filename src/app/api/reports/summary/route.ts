import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientAccessWhere,
  buildInvoiceAccessWhere,
  buildPaymentAccessWhere,
  buildTaskAccessWhere,
} from '@/lib/access-control'

type ReportType = 'monthly' | 'yearly'
type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'ARCHIVED'
type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED'
type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'

const caseStatuses = ['OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'] as const
const paymentStatuses = ['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'] as const
const invoiceStatuses = ['DRAFT', 'UNPAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function sumBy<T>(items: T[], pick: (item: T) => number) {
  return roundMoney(items.reduce((sum, item) => sum + Number(pick(item) || 0), 0))
}

function parseReportParams(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const now = new Date()

  const type = (sp.get('type') || 'yearly') as ReportType
  const year = Number(sp.get('year') || now.getFullYear())
  const month = Number(sp.get('month') || now.getMonth())

  const caseStatus = sp.get('caseStatus') || ''
  const paymentStatus = sp.get('paymentStatus') || ''
  const invoiceStatus = sp.get('invoiceStatus') || ''
  const clientId = sp.get('clientId') || ''

  if (!['monthly', 'yearly'].includes(type)) {
    return { error: 'نوع التقرير غير صالح' }
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: 'السنة غير صالحة' }
  }

  if (type === 'monthly' && (!Number.isInteger(month) || month < 0 || month > 11)) {
    return { error: 'الشهر غير صالح' }
  }

  if (caseStatus && !caseStatuses.includes(caseStatus as CaseStatus)) {
    return { error: 'حالة القضية غير صالحة' }
  }

  if (paymentStatus && !paymentStatuses.includes(paymentStatus as PaymentStatus)) {
    return { error: 'حالة الدفعة غير صالحة' }
  }

  if (invoiceStatus && !invoiceStatuses.includes(invoiceStatus as InvoiceStatus)) {
    return { error: 'حالة الفاتورة غير صالحة' }
  }

  const start = type === 'monthly'
    ? new Date(year, month, 1, 0, 0, 0, 0)
    : new Date(year, 0, 1, 0, 0, 0, 0)

  const end = type === 'monthly'
    ? new Date(year, month + 1, 1, 0, 0, 0, 0)
    : new Date(year + 1, 0, 1, 0, 0, 0, 0)

  return {
    type,
    year,
    month,
    start,
    end,
    caseStatus,
    paymentStatus,
    invoiceStatus,
    clientId,
  }
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const params = parseReportParams(req)
    if ('error' in params) return err(params.error || 'بيانات التقرير غير صالحة', 400)

    const now = new Date()

    const clients = await prisma.client.findMany({
      where: buildClientAccessWhere(auth.user),
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    if (params.clientId) {
      const clientExists = clients.some((client) => client.id === params.clientId)
      if (!clientExists) {
        return err('الموكل غير موجود داخل هذا المكتب', 404)
      }
    }

    const cases = await prisma.case.findMany({
      where: buildCaseAccessWhere(auth.user, {
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...(params.caseStatus ? { status: params.caseStatus as CaseStatus } : {}),
      }),
      select: {
        id: true,
        title: true,
        status: true,
        feeAgreed: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const caseIds = cases.map((c) => c.id)
    const scopedByCases = Boolean(params.clientId || params.caseStatus)
    const emptyScope = scopedByCases && caseIds.length === 0

    const caseScopeWhere = scopedByCases
      ? { caseId: { in: caseIds } }
      : {}

    const paymentBaseWhere = {
      ...(emptyScope ? { id: { in: [] as string[] } } : caseScopeWhere),
    }

    const invoiceBaseWhere = {
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.caseStatus
        ? { caseId: { in: caseIds } }
        : {}),
      ...(emptyScope ? { id: { in: [] as string[] } } : {}),
    }

    const [periodPayments, allPaidPayments, pendingPayments, periodInvoices, allInvoices, upcomingAppointments, overdueTasks] = await Promise.all([
      prisma.payment.findMany({
        where: buildPaymentAccessWhere(auth.user, {
          ...paymentBaseWhere,
          paidAt: { gte: params.start, lt: params.end },
          ...(params.paymentStatus ? { status: params.paymentStatus as PaymentStatus } : {}),
        }),
        include: {
          case: {
            select: {
              id: true,
              title: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
        take: 100,
      }),

      prisma.payment.findMany({
        where: buildPaymentAccessWhere(auth.user, {
          ...paymentBaseWhere,
          status: 'PAID',
        }),
        select: { amount: true },
      }),

      prisma.payment.findMany({
        where: buildPaymentAccessWhere(auth.user, {
          ...paymentBaseWhere,
          status: { in: ['PENDING', 'OVERDUE'] },
        }),
        select: { amount: true, status: true },
      }),

      prisma.invoice.findMany({
        where: buildInvoiceAccessWhere(auth.user, {
          ...invoiceBaseWhere,
          issueDate: { gte: params.start, lt: params.end },
          ...(params.invoiceStatus ? { status: params.invoiceStatus as InvoiceStatus } : {}),
        }),
        include: {
          client: { select: { id: true, name: true } },
          case: { select: { id: true, title: true } },
        },
        orderBy: { issueDate: 'desc' },
        take: 100,
      }),

      prisma.invoice.findMany({
        where: buildInvoiceAccessWhere(auth.user, invoiceBaseWhere),
        select: {
          total: true,
          status: true,
          dueDate: true,
        },
      }),

      prisma.appointment.findMany({
        where: buildAppointmentAccessWhere(auth.user, {
          startTime: { gte: now },
          status: { not: 'CANCELLED' },
          ...(emptyScope ? { id: { in: [] as string[] } } : caseScopeWhere),
        }),
        select: {
          id: true,
          title: true,
          startTime: true,
          location: true,
          case: { select: { id: true, title: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 10,
      }),

      prisma.task.findMany({
        where: buildTaskAccessWhere(auth.user, {
          completed: false,
          dueDate: { lt: now },
          ...(emptyScope ? { id: { in: [] as string[] } } : caseScopeWhere),
        }),
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          case: { select: { id: true, title: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
    ])

    const monthlyRevenue = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const start = new Date(params.year, i, 1, 0, 0, 0, 0)
        const end = new Date(params.year, i + 1, 1, 0, 0, 0, 0)

        const payments = await prisma.payment.findMany({
          where: buildPaymentAccessWhere(auth.user, {
            ...paymentBaseWhere,
            status: 'PAID',
            paidAt: { gte: start, lt: end },
          }),
          select: { amount: true },
        })

        return {
          month: i,
          revenue: sumBy(payments, (p) => p.amount),
        }
      })
    )

    const caseStatus = {
      OPEN: 0,
      IN_PROGRESS: 0,
      CLOSED: 0,
      ARCHIVED: 0,
    }

    cases.forEach((c) => {
      const status = c.status as keyof typeof caseStatus
      if (status in caseStatus) caseStatus[status] += 1
    })

    const totalCases = cases.length
    const openCases = caseStatus.OPEN + caseStatus.IN_PROGRESS
    const closedCases = caseStatus.CLOSED + caseStatus.ARCHIVED

    const periodPaidPayments = periodPayments.filter((p) => p.status === 'PAID')
    const periodRevenue = sumBy(periodPaidPayments, (p) => p.amount)
    const totalPaidAll = sumBy(allPaidPayments, (p) => p.amount)
    const pendingPaymentsAmount = sumBy(pendingPayments, (p) => p.amount)

    const totalInvoicesAmount = sumBy(allInvoices.filter((inv) => inv.status !== 'CANCELLED'), (inv) => inv.total)
    const paidInvoicesAmount = sumBy(allInvoices.filter((inv) => inv.status === 'PAID'), (inv) => inv.total)
    const unpaidInvoicesAmount = sumBy(
      allInvoices.filter((inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED'),
      (inv) => inv.total
    )
    const overdueInvoicesAmount = sumBy(
      allInvoices.filter((inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.dueDate && inv.dueDate < now),
      (inv) => inv.total
    )

    const collectionRate = totalInvoicesAmount > 0
      ? Math.round((paidInvoicesAmount / totalInvoicesAmount) * 100)
      : 0

    const topClientMap = new Map<string, {
      id: string
      name: string
      casesCount: number
      paymentsTotal: number
      invoicesTotal: number
      activityScore: number
    }>()

    cases.forEach((c) => {
      if (!topClientMap.has(c.client.id)) {
        topClientMap.set(c.client.id, {
          id: c.client.id,
          name: c.client.name,
          casesCount: 0,
          paymentsTotal: 0,
          invoicesTotal: 0,
          activityScore: 0,
        })
      }

      const item = topClientMap.get(c.client.id)!
      item.casesCount += 1
      item.activityScore += 3
    })

    periodPayments.forEach((payment) => {
      const client = payment.case?.client
      if (!client) return

      if (!topClientMap.has(client.id)) {
        topClientMap.set(client.id, {
          id: client.id,
          name: client.name,
          casesCount: 0,
          paymentsTotal: 0,
          invoicesTotal: 0,
          activityScore: 0,
        })
      }

      const item = topClientMap.get(client.id)!
      item.paymentsTotal += Number(payment.amount || 0)
      item.activityScore += 2
    })

    periodInvoices.forEach((invoice) => {
      if (!invoice.client) return

      if (!topClientMap.has(invoice.client.id)) {
        topClientMap.set(invoice.client.id, {
          id: invoice.client.id,
          name: invoice.client.name,
          casesCount: 0,
          paymentsTotal: 0,
          invoicesTotal: 0,
          activityScore: 0,
        })
      }

      const item = topClientMap.get(invoice.client.id)!
      item.invoicesTotal += Number(invoice.total || 0)
      item.activityScore += 1
    })

    const topClients = Array.from(topClientMap.values())
      .map((client) => ({
        ...client,
        paymentsTotal: roundMoney(client.paymentsTotal),
        invoicesTotal: roundMoney(client.invoicesTotal),
        activityScore: roundMoney(client.activityScore + client.paymentsTotal / 1000 + client.invoicesTotal / 2000),
      }))
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 5)

    return ok({
      filters: {
        type: params.type,
        year: params.year,
        month: params.month,
        caseStatus: params.caseStatus,
        paymentStatus: params.paymentStatus,
        invoiceStatus: params.invoiceStatus,
        clientId: params.clientId,
      },
      clients,
      summary: {
        periodRevenue,
        totalPaidAll,
        pendingPaymentsAmount,
        totalInvoicesAmount,
        paidInvoicesAmount,
        unpaidInvoicesAmount,
        overdueInvoicesAmount,
        collectionRate,
        totalCases,
        openCases,
        closedCases,
        upcomingAppointmentsCount: upcomingAppointments.length,
        overdueTasksCount: overdueTasks.length,
      },
      caseStatus,
      topClients,
      monthlyRevenue,
      periodPayments,
      periodInvoices,
      upcomingAppointments,
      overdueTasks,
    })
  })
}
