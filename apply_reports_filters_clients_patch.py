from pathlib import Path

ROUTE = Path("src/app/api/reports/summary/route.ts")
PAGE = Path("src/app/dashboard/reports/page.tsx")

if not ROUTE.exists():
    raise SystemExit("❌ الملف غير موجود: src/app/api/reports/summary/route.ts")
if not PAGE.exists():
    raise SystemExit("❌ الملف غير موجود: src/app/dashboard/reports/page.tsx")

route_code = r"""import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'

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
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const params = parseReportParams(req)
    if ('error' in params) return err(params.error || 'بيانات التقرير غير صالحة', 400)

    const tenantId = auth.user.tenantId
    const now = new Date()

    const clients = await prisma.client.findMany({
      where: { tenantId },
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
      where: {
        tenantId,
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...(params.caseStatus ? { status: params.caseStatus as CaseStatus } : {}),
      },
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
      tenantId,
      ...(emptyScope ? { id: { in: [] as string[] } } : caseScopeWhere),
    }

    const invoiceBaseWhere = {
      tenantId,
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.caseStatus
        ? { caseId: { in: caseIds } }
        : {}),
      ...(emptyScope ? { id: { in: [] as string[] } } : {}),
    }

    const [periodPayments, allPaidPayments, pendingPayments, periodInvoices, allInvoices, upcomingAppointments, overdueTasks] = await Promise.all([
      prisma.payment.findMany({
        where: {
          ...paymentBaseWhere,
          paidAt: { gte: params.start, lt: params.end },
          ...(params.paymentStatus ? { status: params.paymentStatus as PaymentStatus } : {}),
        },
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
        where: {
          ...paymentBaseWhere,
          status: 'PAID',
        },
        select: { amount: true },
      }),

      prisma.payment.findMany({
        where: {
          ...paymentBaseWhere,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        select: { amount: true, status: true },
      }),

      prisma.invoice.findMany({
        where: {
          ...invoiceBaseWhere,
          issueDate: { gte: params.start, lt: params.end },
          ...(params.invoiceStatus ? { status: params.invoiceStatus as InvoiceStatus } : {}),
        },
        include: {
          client: { select: { id: true, name: true } },
          case: { select: { id: true, title: true } },
        },
        orderBy: { issueDate: 'desc' },
        take: 100,
      }),

      prisma.invoice.findMany({
        where: invoiceBaseWhere,
        select: {
          total: true,
          status: true,
          dueDate: true,
        },
      }),

      prisma.appointment.findMany({
        where: {
          tenantId,
          startTime: { gte: now },
          status: { not: 'CANCELLED' },
          ...(emptyScope ? { id: { in: [] as string[] } } : caseScopeWhere),
        },
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
        where: {
          tenantId,
          completed: false,
          dueDate: { lt: now },
          ...(emptyScope ? { id: { in: [] as string[] } } : caseScopeWhere),
        },
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
          where: {
            ...paymentBaseWhere,
            status: 'PAID',
            paidAt: { gte: start, lt: end },
          },
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
"""

page_code = r"""'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PageLoader from '@/components/ui/PageLoader'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

type ReportType = 'monthly' | 'yearly'

interface ReportClient {
  id: string
  name: string
}

interface ReportPayment {
  id: string
  amount: number
  status: string
  method?: string | null
  paidAt?: string | null
  notes?: string | null
  case?: {
    id: string
    title: string
    client?: {
      id: string
      name: string
    } | null
  } | null
}

interface ReportInvoice {
  id: string
  invoiceNumber: string
  total: number
  status: string
  issueDate: string
  dueDate?: string | null
  client?: {
    id: string
    name: string
  } | null
  case?: {
    id: string
    title: string
  } | null
}

interface ReportAppointment {
  id: string
  title: string
  startTime: string
  location?: string | null
  case?: {
    id: string
    title: string
  } | null
}

interface ReportTask {
  id: string
  title: string
  dueDate?: string | null
  priority?: string | null
  case?: {
    id: string
    title: string
  } | null
}

interface TopClient {
  id: string
  name: string
  casesCount: number
  paymentsTotal: number
  invoicesTotal: number
  activityScore: number
}

interface ReportData {
  clients: ReportClient[]
  summary: {
    periodRevenue: number
    totalPaidAll: number
    pendingPaymentsAmount: number
    totalInvoicesAmount: number
    paidInvoicesAmount: number
    unpaidInvoicesAmount: number
    overdueInvoicesAmount: number
    collectionRate: number
    totalCases: number
    openCases: number
    closedCases: number
    upcomingAppointmentsCount: number
    overdueTasksCount: number
  }
  caseStatus: Record<string, number>
  topClients: TopClient[]
  monthlyRevenue: { month: number; revenue: number }[]
  periodPayments: ReportPayment[]
  periodInvoices: ReportInvoice[]
  upcomingAppointments: ReportAppointment[]
  overdueTasks: ReportTask[]
}

function unwrapPayload(payload: any): ReportData | null {
  return payload?.data?.summary ? payload.data : payload?.summary ? payload : null
}

function getMessage(payload: any) {
  return payload?.message || payload?.error || payload?.data?.message || 'تعذر تحميل التقرير'
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('ar-JO')
}

function paymentStatus(status: string) {
  const map: Record<string, string> = {
    PAID: 'مدفوع',
    PENDING: 'معلق',
    OVERDUE: 'متأخر',
    CANCELLED: 'ملغي',
  }
  return map[status] || status || '-'
}

function invoiceStatus(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'مسودة',
    UNPAID: 'غير مدفوعة',
    PAID: 'مدفوعة',
    OVERDUE: 'متأخرة',
    CANCELLED: 'ملغاة',
  }
  return map[status] || status || '-'
}

function caseStatusLabel(status: string) {
  const map: Record<string, string> = {
    OPEN: 'مفتوحة',
    IN_PROGRESS: 'قيد التنفيذ',
    CLOSED: 'مغلقة',
    ARCHIVED: 'مؤرشفة',
  }
  return map[status] || status || '-'
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('yearly')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [caseStatus, setCaseStatus] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('')
  const [clientId, setClientId] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const years = useMemo(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, i) => current - 3 + i)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({
      type: reportType,
      year: String(year),
      month: String(month),
    })

    if (caseStatus) params.set('caseStatus', caseStatus)
    if (paymentStatusFilter) params.set('paymentStatus', paymentStatusFilter)
    if (invoiceStatusFilter) params.set('invoiceStatus', invoiceStatusFilter)
    if (clientId) params.set('clientId', clientId)

    const res = await fetch(`/api/reports/summary?${params.toString()}`, {
      cache: 'no-store',
    })

    const payload = await res.json().catch(() => ({}))
    const nextData = unwrapPayload(payload)

    if (!res.ok || !nextData) {
      setError(getMessage(payload))
      setData(null)
    } else {
      setData(nextData)
    }

    setLoading(false)
  }, [reportType, year, month, caseStatus, paymentStatusFilter, invoiceStatusFilter, clientId])

  useEffect(() => {
    load()
  }, [load])

  const maxRevenue = Math.max(...(data?.monthlyRevenue || []).map((m) => m.revenue), 1)

  function resetFilters() {
    setCaseStatus('')
    setPaymentStatusFilter('')
    setInvoiceStatusFilter('')
    setClientId('')
  }

  function reportTitle() {
    return reportType === 'monthly'
      ? `تقرير ${MONTHS[month]} ${year}`
      : `التقرير السنوي ${year}`
  }

  function reportFilename() {
    return reportType === 'monthly'
      ? `viresto-report-${year}-${String(month + 1).padStart(2, '0')}`
      : `viresto-report-${year}`
  }

  function summaryRows() {
    if (!data) return []
    const summary = data.summary

    return [
      ['إيرادات الفترة', formatCurrency(summary.periodRevenue)],
      ['إجمالي التحصيل', formatCurrency(summary.totalPaidAll)],
      ['دفعات معلقة/متأخرة', formatCurrency(summary.pendingPaymentsAmount)],
      ['إجمالي الفواتير', formatCurrency(summary.totalInvoicesAmount)],
      ['فواتير مدفوعة', formatCurrency(summary.paidInvoicesAmount)],
      ['فواتير غير مدفوعة', formatCurrency(summary.unpaidInvoicesAmount)],
      ['فواتير متأخرة', formatCurrency(summary.overdueInvoicesAmount)],
      ['نسبة التحصيل', `${summary.collectionRate}%`],
      ['عدد القضايا', summary.totalCases],
      ['القضايا النشطة', summary.openCases],
      ['القضايا المغلقة/المؤرشفة', summary.closedCases],
      ['المواعيد القادمة', summary.upcomingAppointmentsCount],
      ['المهام المتأخرة', summary.overdueTasksCount],
    ]
  }

  function paymentRowsForExport() {
    if (!data) return []

    return data.periodPayments.map((p) => ({
      القضية: p.case?.title || '-',
      الموكل: p.case?.client?.name || '-',
      المبلغ: Number(p.amount || 0),
      الحالة: paymentStatus(p.status),
      طريقة_الدفع: p.method || '-',
      التاريخ: formatDate(p.paidAt),
      ملاحظات: p.notes || '-',
    }))
  }

  function invoiceRowsForExport() {
    if (!data) return []

    return data.periodInvoices.map((inv) => ({
      رقم_الفاتورة: inv.invoiceNumber || '-',
      الموكل: inv.client?.name || '-',
      القضية: inv.case?.title || '-',
      المبلغ: Number(inv.total || 0),
      الحالة: invoiceStatus(inv.status),
      تاريخ_الإصدار: formatDate(inv.issueDate),
      تاريخ_الاستحقاق: formatDate(inv.dueDate),
    }))
  }

  function appointmentRowsForExport() {
    if (!data) return []

    return data.upcomingAppointments.map((a) => ({
      الموعد: a.title || '-',
      القضية: a.case?.title || '-',
      التاريخ: formatDate(a.startTime),
      المكان: a.location || '-',
    }))
  }

  function taskRowsForExport() {
    if (!data) return []

    return data.overdueTasks.map((t) => ({
      المهمة: t.title || '-',
      القضية: t.case?.title || '-',
      الأولوية: t.priority || '-',
      الاستحقاق: formatDate(t.dueDate),
    }))
  }

  function topClientRowsForExport() {
    if (!data) return []

    return data.topClients.map((client) => ({
      الموكل: client.name,
      عدد_القضايا: client.casesCount,
      إجمالي_الدفعات: client.paymentsTotal,
      إجمالي_الفواتير: client.invoicesTotal,
      مؤشر_النشاط: client.activityScore,
    }))
  }

  async function exportFullExcel() {
    if (!data) return

    const { exportSheetsExcel } = await import('@/lib/export')

    exportSheetsExcel(reportFilename(), [
      {
        name: 'الملخص',
        rows: summaryRows().map(([البند, القيمة]) => ({ البند, القيمة })),
      },
      { name: 'الدفعات', rows: paymentRowsForExport() },
      { name: 'الفواتير', rows: invoiceRowsForExport() },
      { name: 'المواعيد القادمة', rows: appointmentRowsForExport() },
      { name: 'المهام المتأخرة', rows: taskRowsForExport() },
      { name: 'الموكلون الأكثر نشاطًا', rows: topClientRowsForExport() },
      {
        name: 'حالة القضايا',
        rows: caseRows.map(([status, count]) => ({
          الحالة: caseStatusLabel(String(status)),
          العدد: count,
        })),
      },
    ])
  }

  async function exportFullPdf() {
    if (!data) return

    const { exportReportPDF } = await import('@/lib/export')

    exportReportPDF(reportFilename(), reportTitle(), summaryRows(), [
      {
        title: 'دفعات الفترة',
        columns: ['ملاحظات', 'التاريخ', 'طريقة الدفع', 'الحالة', 'المبلغ', 'الموكل', 'القضية'],
        rows: paymentRowsForExport().map((p) => [
          p.ملاحظات,
          p.التاريخ,
          p.طريقة_الدفع,
          p.الحالة,
          formatCurrency(p.المبلغ),
          p.الموكل,
          p.القضية,
        ]),
      },
      {
        title: 'فواتير الفترة',
        columns: ['الاستحقاق', 'الإصدار', 'الحالة', 'المبلغ', 'القضية', 'الموكل', 'رقم الفاتورة'],
        rows: invoiceRowsForExport().map((inv) => [
          inv.تاريخ_الاستحقاق,
          inv.تاريخ_الإصدار,
          inv.الحالة,
          formatCurrency(inv.المبلغ),
          inv.القضية,
          inv.الموكل,
          inv.رقم_الفاتورة,
        ]),
      },
      {
        title: 'الموكلون الأكثر نشاطًا',
        columns: ['مؤشر النشاط', 'إجمالي الفواتير', 'إجمالي الدفعات', 'عدد القضايا', 'الموكل'],
        rows: topClientRowsForExport().map((c) => [
          c.مؤشر_النشاط,
          formatCurrency(c.إجمالي_الفواتير),
          formatCurrency(c.إجمالي_الدفعات),
          c.عدد_القضايا,
          c.الموكل,
        ]),
      },
      {
        title: 'المواعيد القادمة',
        columns: ['المكان', 'التاريخ', 'القضية', 'الموعد'],
        rows: appointmentRowsForExport().map((a) => [a.المكان, a.التاريخ, a.القضية, a.الموعد]),
      },
      {
        title: 'المهام المتأخرة',
        columns: ['الاستحقاق', 'الأولوية', 'القضية', 'المهمة'],
        rows: taskRowsForExport().map((t) => [t.الاستحقاق, t.الأولوية, t.القضية, t.المهمة]),
      },
    ])
  }

  function exportPayments() {
    if (!data) return

    const rows = [
      ['القضية', 'الموكل', 'المبلغ', 'الحالة', 'طريقة الدفع', 'التاريخ'],
      ...data.periodPayments.map((p) => [
        p.case?.title || '-',
        p.case?.client?.name || '-',
        Number(p.amount || 0),
        paymentStatus(p.status),
        p.method || '-',
        formatDate(p.paidAt),
      ]),
    ]

    downloadCsv(`payments-report-${year}.csv`, rows)
  }

  function exportInvoices() {
    if (!data) return

    const rows = [
      ['رقم الفاتورة', 'الموكل', 'القضية', 'المبلغ', 'الحالة', 'تاريخ الإصدار', 'تاريخ الاستحقاق'],
      ...data.periodInvoices.map((inv) => [
        inv.invoiceNumber || '-',
        inv.client?.name || '-',
        inv.case?.title || '-',
        Number(inv.total || 0),
        invoiceStatus(inv.status),
        formatDate(inv.issueDate),
        formatDate(inv.dueDate),
      ]),
    ]

    downloadCsv(`invoices-report-${year}.csv`, rows)
  }

  if (loading) return <PageLoader />

  if (error) {
    return (
      <div className="card p-6">
        <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--text)' }}>التقارير</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>{error}</p>
        <button onClick={load} className="btn btn-primary">إعادة المحاولة</button>
      </div>
    )
  }

  if (!data) return null

  const summary = data.summary
  const caseRows = [
    ['OPEN', data.caseStatus.OPEN || 0],
    ['IN_PROGRESS', data.caseStatus.IN_PROGRESS || 0],
    ['CLOSED', data.caseStatus.CLOSED || 0],
    ['ARCHIVED', data.caseStatus.ARCHIVED || 0],
  ]

  return (
    <>
      <style jsx global>{`
        @media print {
          aside, header, nav, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .card { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--text)' }}>
            {reportTitle()}
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
            ملخص مالي وإداري شامل مع فلاتر دقيقة حسب الموكل والحالة والفترة
          </p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={() => window.print()} className="btn btn-primary">طباعة</button>
          <button onClick={exportFullPdf} className="btn btn-primary">تصدير PDF شامل</button>
          <button onClick={exportFullExcel} className="btn btn-secondary">تصدير Excel شامل</button>
          <button onClick={exportPayments} className="btn btn-secondary">دفعات CSV</button>
          <button onClick={exportInvoices} className="btn btn-secondary">فواتير CSV</button>
        </div>
      </div>

      <div className="space-y-5 stagger">
        <div className="card p-4 flex flex-col gap-3 print:hidden">
          <div className="flex flex-wrap gap-3">
            <select
              aria-label="نوع التقرير"
              title="نوع التقرير"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="input w-40"
            >
              <option value="yearly">تقرير سنوي</option>
              <option value="monthly">تقرير شهري</option>
            </select>

            {reportType === 'monthly' && (
              <select
                aria-label="الشهر"
                title="الشهر"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="input w-40"
              >
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            )}

            <select
              aria-label="السنة"
              title="السنة"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="input w-32"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>

            <select
              aria-label="الموكل"
              title="الموكل"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input w-52"
            >
              <option value="">كل الموكلين</option>
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>

            <select
              aria-label="حالة القضية"
              title="حالة القضية"
              value={caseStatus}
              onChange={(e) => setCaseStatus(e.target.value)}
              className="input w-44"
            >
              <option value="">كل حالات القضايا</option>
              <option value="OPEN">مفتوحة</option>
              <option value="IN_PROGRESS">قيد التنفيذ</option>
              <option value="CLOSED">مغلقة</option>
              <option value="ARCHIVED">مؤرشفة</option>
            </select>

            <select
              aria-label="حالة الدفعة"
              title="حالة الدفعة"
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="input w-44"
            >
              <option value="">كل الدفعات</option>
              <option value="PAID">مدفوعة</option>
              <option value="PENDING">معلقة</option>
              <option value="OVERDUE">متأخرة</option>
              <option value="CANCELLED">ملغاة</option>
            </select>

            <select
              aria-label="حالة الفاتورة"
              title="حالة الفاتورة"
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              className="input w-44"
            >
              <option value="">كل الفواتير</option>
              <option value="DRAFT">مسودة</option>
              <option value="UNPAID">غير مدفوعة</option>
              <option value="PAID">مدفوعة</option>
              <option value="OVERDUE">متأخرة</option>
              <option value="CANCELLED">ملغاة</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={load} className="btn btn-secondary">تحديث البيانات</button>
            <button onClick={resetFilters} className="btn btn-secondary">تصفير الفلاتر</button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: reportType === 'monthly' ? `إيرادات ${MONTHS[month]}` : 'إيرادات الفترة', value: formatCurrency(summary.periodRevenue) },
            { label: 'دفعات معلقة/متأخرة', value: formatCurrency(summary.pendingPaymentsAmount) },
            { label: 'فواتير غير مدفوعة', value: formatCurrency(summary.unpaidInvoicesAmount) },
            { label: 'نسبة التحصيل', value: `${summary.collectionRate}%` },
            { label: 'عدد القضايا', value: summary.totalCases },
            { label: 'القضايا النشطة', value: summary.openCases },
            { label: 'المواعيد القادمة', value: summary.upcomingAppointmentsCount },
            { label: 'مهام متأخرة', value: summary.overdueTasksCount },
          ].map((k) => (
            <div key={k.label} className="card p-5 text-center">
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>{k.label}</p>
              <p className="text-2xl font-black" style={{ color: 'var(--text)' }}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-5">
            <h2 className="font-black mb-4" style={{ color: 'var(--text)' }}>حالة القضايا</h2>
            <div className="space-y-3">
              {caseRows.map(([status, count]) => {
                const pct = summary.totalCases > 0 ? Math.round((Number(count) / summary.totalCases) * 100) : 0

                return (
                  <div key={String(status)}>
                    <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--text-2)' }}>
                      <span>{caseStatusLabel(String(status))}</span>
                      <span>{count} / {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-2)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--sidebar)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-black mb-4" style={{ color: 'var(--text)' }}>الإيرادات الشهرية</h2>
            <div className="flex items-end gap-2 h-44">
              {data.monthlyRevenue.map((item) => {
                const height = Math.max(4, Math.round((item.revenue / maxRevenue) * 100))

                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center justify-end gap-2">
                    <div
                      title={`${MONTHS[item.month]}: ${formatCurrency(item.revenue)}`}
                      className="w-full rounded-t-xl"
                      style={{
                        height: `${height}%`,
                        background: 'var(--sidebar)',
                        opacity: item.month === month ? 1 : 0.55,
                      }}
                    />
                    <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{MONTHS[item.month].slice(0, 3)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-black mb-4" style={{ color: 'var(--text)' }}>الموكلون الأكثر نشاطًا</h2>
            <div className="space-y-3">
              {data.topClients.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>لا توجد بيانات كافية.</p>
              ) : data.topClients.map((client, index) => (
                <div key={client.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold" style={{ color: 'var(--text)' }}>
                      {index + 1}. {client.name}
                    </p>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {client.casesCount} قضايا
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                    <span>دفعات: {formatCurrency(client.paymentsTotal)}</span>
                    <span>فواتير: {formatCurrency(client.invoicesTotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="card p-0 overflow-hidden">
            <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-black" style={{ color: 'var(--text)' }}>دفعات الفترة</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>القضية</th>
                    <th>الموكل</th>
                    <th>المبلغ</th>
                    <th>الحالة</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.periodPayments.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6">لا توجد دفعات ضمن الفلاتر الحالية</td></tr>
                  ) : data.periodPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.case?.title || '-'}</td>
                      <td>{payment.case?.client?.name || '-'}</td>
                      <td>{formatCurrency(payment.amount)}</td>
                      <td>{paymentStatus(payment.status)}</td>
                      <td>{formatDate(payment.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-black" style={{ color: 'var(--text)' }}>فواتير الفترة</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>الموكل</th>
                    <th>المبلغ</th>
                    <th>الحالة</th>
                    <th>الاستحقاق</th>
                  </tr>
                </thead>
                <tbody>
                  {data.periodInvoices.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6">لا توجد فواتير ضمن الفلاتر الحالية</td></tr>
                  ) : data.periodInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.invoiceNumber}</td>
                      <td>{invoice.client?.name || '-'}</td>
                      <td>{formatCurrency(invoice.total)}</td>
                      <td>{invoiceStatus(invoice.status)}</td>
                      <td>{formatDate(invoice.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="card p-5">
            <h2 className="font-black mb-4" style={{ color: 'var(--text)' }}>المواعيد القادمة</h2>
            <div className="space-y-3">
              {data.upcomingAppointments.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>لا توجد مواعيد قادمة.</p>
              ) : data.upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)' }}>
                  <p className="font-bold" style={{ color: 'var(--text)' }}>{appointment.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                    {formatDate(appointment.startTime)} — {appointment.case?.title || '-'} — {appointment.location || '-'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-black mb-4" style={{ color: 'var(--text)' }}>المهام المتأخرة</h2>
            <div className="space-y-3">
              {data.overdueTasks.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>لا توجد مهام متأخرة.</p>
              ) : data.overdueTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)' }}>
                  <p className="font-bold" style={{ color: 'var(--text)' }}>{task.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                    {formatDate(task.dueDate)} — {task.case?.title || '-'} — {task.priority || '-'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
"""

ROUTE.write_text(route_code, encoding="utf-8")
PAGE.write_text(page_code, encoding="utf-8")

print("✅ تم تركيب Patch المرحلة الثالثة للتقارير")
print("الآن شغّل:")
print("npm run build")
