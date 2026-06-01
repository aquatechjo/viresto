from pathlib import Path

ROOT = Path.cwd()
api_dir = ROOT / 'src' / 'app' / 'api' / 'reports' / 'summary'
api_dir.mkdir(parents=True, exist_ok=True)
api_path = api_dir / 'route.ts'
page_path = ROOT / 'src' / 'app' / 'dashboard' / 'reports' / 'page.tsx'

if not page_path.exists():
    raise SystemExit('لم أجد ملف صفحة التقارير: src/app/dashboard/reports/page.tsx')

api_code = r'''import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'

function getDateRange(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const now = new Date()
  const year = Number(sp.get('year') || now.getFullYear())
  const type = sp.get('type') === 'monthly' ? 'monthly' : 'yearly'
  const month = Math.min(11, Math.max(0, Number(sp.get('month') ?? now.getMonth())))

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: 'السنة غير صالحة' }
  }

  const from = type === 'monthly'
    ? new Date(year, month, 1, 0, 0, 0, 0)
    : new Date(year, 0, 1, 0, 0, 0, 0)

  const to = type === 'monthly'
    ? new Date(year, month + 1, 1, 0, 0, 0, 0)
    : new Date(year + 1, 0, 1, 0, 0, 0, 0)

  return { year, type, month, from, to }
}

function sum(items: { amount?: number | null; total?: number | null }[], key: 'amount' | 'total') {
  return items.reduce((acc, item) => acc + Number(item[key] || 0), 0)
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const range = getDateRange(req)
    if ('error' in range) return err(range.error, 400)

    const tenantId = auth.user.tenantId
    const now = new Date()

    const [
      cases,
      periodPayments,
      yearlyPaidPayments,
      periodInvoices,
      upcomingAppointments,
      overdueTasks,
      recentPayments,
      recentInvoices,
    ] = await Promise.all([
      prisma.case.findMany({
        where: { tenantId },
        select: {
          id: true,
          title: true,
          caseNumber: true,
          status: true,
          feeAgreed: true,
          client: { select: { id: true, name: true } },
        },
      }),

      prisma.payment.findMany({
        where: {
          tenantId,
          paidAt: { gte: range.from, lt: range.to },
        },
        orderBy: { paidAt: 'desc' },
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          paidAt: true,
          invoiceId: true,
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      }),

      prisma.payment.findMany({
        where: {
          tenantId,
          status: 'PAID',
          paidAt: {
            gte: new Date(range.year, 0, 1, 0, 0, 0, 0),
            lt: new Date(range.year + 1, 0, 1, 0, 0, 0, 0),
          },
        },
        select: { amount: true, paidAt: true },
      }),

      prisma.invoice.findMany({
        where: {
          tenantId,
          issueDate: { gte: range.from, lt: range.to },
        },
        orderBy: { issueDate: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          issueDate: true,
          dueDate: true,
          payment: { select: { id: true } },
          client: { select: { id: true, name: true } },
          case: { select: { id: true, title: true, caseNumber: true } },
        },
      }),

      prisma.appointment.findMany({
        where: {
          tenantId,
          status: 'SCHEDULED',
          startTime: { gte: now },
        },
        orderBy: { startTime: 'asc' },
        take: 8,
        select: {
          id: true,
          title: true,
          startTime: true,
          location: true,
          type: true,
          status: true,
          client: { select: { id: true, name: true } },
          case: { select: { id: true, title: true, caseNumber: true } },
        },
      }),

      prisma.task.findMany({
        where: {
          tenantId,
          completed: false,
          dueDate: { lt: now },
        },
        orderBy: { dueDate: 'asc' },
        take: 8,
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          client: { select: { id: true, name: true } },
          case: { select: { id: true, title: true, caseNumber: true } },
        },
      }),

      prisma.payment.findMany({
        where: { tenantId },
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          status: true,
          paidAt: true,
          method: true,
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      }),

      prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { issueDate: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          issueDate: true,
          dueDate: true,
          client: { select: { id: true, name: true } },
          case: { select: { id: true, title: true, caseNumber: true } },
        },
      }),
    ])

    const paidPayments = periodPayments.filter((p) => p.status === 'PAID')
    const pendingPayments = periodPayments.filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE')
    const cancelledPayments = periodPayments.filter((p) => p.status === 'CANCELLED')

    const paidInvoices = periodInvoices.filter((i) => i.status === 'PAID')
    const unpaidInvoices = periodInvoices.filter((i) => i.status === 'UNPAID' || i.status === 'OVERDUE')
    const overdueInvoices = periodInvoices.filter((i) => {
      if (i.status === 'OVERDUE') return true
      if (!i.dueDate) return false
      return i.dueDate < now && i.status !== 'PAID' && i.status !== 'CANCELLED'
    })

    const caseStatus = {
      OPEN: cases.filter((c) => c.status === 'OPEN').length,
      IN_PROGRESS: cases.filter((c) => c.status === 'IN_PROGRESS').length,
      CLOSED: cases.filter((c) => c.status === 'CLOSED').length,
      ARCHIVED: cases.filter((c) => c.status === 'ARCHIVED').length,
    }

    const monthlyRevenue = Array.from({ length: 12 }, (_, month) => ({
      month,
      revenue: 0,
    }))

    for (const payment of yearlyPaidPayments) {
      const month = payment.paidAt.getMonth()
      monthlyRevenue[month].revenue += Number(payment.amount || 0)
    }

    const totalFees = cases.reduce((acc, c) => acc + Number(c.feeAgreed || 0), 0)
    const totalPaidAllTime = await prisma.payment.aggregate({
      where: { tenantId, status: 'PAID' },
      _sum: { amount: true },
    })

    const totalPaidAll = Number(totalPaidAllTime._sum.amount || 0)

    return ok({
      filters: {
        type: range.type,
        year: range.year,
        month: range.month,
        from: range.from,
        to: range.to,
      },
      summary: {
        totalCases: cases.length,
        openCases: caseStatus.OPEN + caseStatus.IN_PROGRESS,
        closedCases: caseStatus.CLOSED + caseStatus.ARCHIVED,
        totalFees,
        totalPaidAll,
        collectionRate: totalFees > 0 ? Math.round((totalPaidAll / totalFees) * 100) : 0,
        periodRevenue: sum(paidPayments, 'amount'),
        pendingPaymentsAmount: sum(pendingPayments, 'amount'),
        cancelledPaymentsAmount: sum(cancelledPayments, 'amount'),
        paidPaymentsCount: paidPayments.length,
        pendingPaymentsCount: pendingPayments.length,
        totalInvoicesAmount: sum(periodInvoices, 'total'),
        paidInvoicesAmount: sum(paidInvoices, 'total'),
        unpaidInvoicesAmount: sum(unpaidInvoices, 'total'),
        overdueInvoicesAmount: sum(overdueInvoices, 'total'),
        invoicesCount: periodInvoices.length,
        paidInvoicesCount: paidInvoices.length,
        unpaidInvoicesCount: unpaidInvoices.length,
        overdueInvoicesCount: overdueInvoices.length,
        upcomingAppointmentsCount: upcomingAppointments.length,
        overdueTasksCount: overdueTasks.length,
      },
      caseStatus,
      monthlyRevenue,
      periodPayments,
      periodInvoices,
      upcomingAppointments,
      overdueTasks,
      recentPayments,
      recentInvoices,
    })
  })
}
'''

page_code = r''''use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PageLoader from '@/components/ui/PageLoader'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

type ReportType = 'monthly' | 'yearly'

type ReportData = {
  summary: {
    totalCases: number
    openCases: number
    closedCases: number
    totalFees: number
    totalPaidAll: number
    collectionRate: number
    periodRevenue: number
    pendingPaymentsAmount: number
    paidPaymentsCount: number
    pendingPaymentsCount: number
    totalInvoicesAmount: number
    paidInvoicesAmount: number
    unpaidInvoicesAmount: number
    overdueInvoicesAmount: number
    invoicesCount: number
    paidInvoicesCount: number
    unpaidInvoicesCount: number
    overdueInvoicesCount: number
    upcomingAppointmentsCount: number
    overdueTasksCount: number
  }
  caseStatus: Record<string, number>
  monthlyRevenue: { month: number; revenue: number }[]
  periodPayments: any[]
  periodInvoices: any[]
  upcomingAppointments: any[]
  overdueTasks: any[]
  recentPayments: any[]
  recentInvoices: any[]
}

function unwrapPayload(payload: any): ReportData | null {
  return payload?.data?.summary ? payload.data : payload?.summary ? payload : null
}

function getMessage(payload: any, fallback = 'حدث خطأ أثناء تحميل التقرير') {
  return payload?.message || payload?.error || payload?.data?.message || fallback
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
  }, [reportType, year, month])

  useEffect(() => {
    load()
  }, [load])

  const maxRevenue = Math.max(...(data?.monthlyRevenue || []).map((m) => m.revenue), 1)

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
          aside, header, nav, .print\:hidden { display: none !important; }
          body { background: white !important; }
          .card { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--text)' }}>
            {reportType === 'monthly' ? `تقرير ${MONTHS[month]} ${year}` : `التقرير السنوي ${year}`}
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
            ملخص مالي وإداري شامل للقضايا والدفعات والفواتير والمواعيد
          </p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button onClick={() => window.print()} className="btn btn-primary">طباعة</button>
          <button onClick={exportPayments} className="btn btn-secondary">تصدير الدفعات CSV</button>
          <button onClick={exportInvoices} className="btn btn-secondary">تصدير الفواتير CSV</button>
        </div>
      </div>

      <div className="space-y-5 stagger">
        <div className="card p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
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
          </div>

          <button onClick={load} className="btn btn-secondary">تحديث البيانات</button>
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
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-2)' }}>{caseStatusLabel(String(status))}</span>
                      <span className="font-bold" style={{ color: 'var(--text)' }}>{count} / {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--sidebar)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-5 lg:col-span-2">
            <h2 className="font-black mb-5" style={{ color: 'var(--text)' }}>الإيرادات الشهرية ({year})</h2>
            <div className="flex items-end justify-between gap-1 h-44">
              {MONTHS.map((name, i) => {
                const value = data.monthlyRevenue.find((m) => m.month === i)?.revenue || 0
                return (
                  <div key={name} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-t-lg transition-all duration-700"
                      title={`${name}: ${formatCurrency(value)}`}
                      style={{
                        height: `${(value / maxRevenue) * 100}%`,
                        minHeight: value > 0 ? 6 : 2,
                        background: value > 0 ? 'var(--sidebar)' : 'var(--border)',
                        opacity: value > 0 ? 1 : 0.35,
                      }}
                    />
                    <span style={{ color: 'var(--text-3)', fontSize: 9 }}>{name.slice(0, 3)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-5">
            <h2 className="font-black mb-3" style={{ color: 'var(--text)' }}>الفواتير</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>إجمالي الفواتير</span><b>{formatCurrency(summary.totalInvoicesAmount)}</b></div>
              <div className="flex justify-between"><span>مدفوعة</span><b>{formatCurrency(summary.paidInvoicesAmount)}</b></div>
              <div className="flex justify-between"><span>غير مدفوعة</span><b>{formatCurrency(summary.unpaidInvoicesAmount)}</b></div>
              <div className="flex justify-between"><span>متأخرة</span><b>{formatCurrency(summary.overdueInvoicesAmount)}</b></div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-black mb-3" style={{ color: 'var(--text)' }}>الدفعات</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>عدد الدفعات المدفوعة</span><b>{summary.paidPaymentsCount}</b></div>
              <div className="flex justify-between"><span>عدد الدفعات المعلقة</span><b>{summary.pendingPaymentsCount}</b></div>
              <div className="flex justify-between"><span>إيرادات الفترة</span><b>{formatCurrency(summary.periodRevenue)}</b></div>
              <div className="flex justify-between"><span>إجمالي التحصيل</span><b>{formatCurrency(summary.totalPaidAll)}</b></div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-black mb-3" style={{ color: 'var(--text)' }}>تنبيهات إدارية</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>مواعيد قادمة</span><b>{summary.upcomingAppointmentsCount}</b></div>
              <div className="flex justify-between"><span>مهام متأخرة</span><b>{summary.overdueTasksCount}</b></div>
              <div className="flex justify-between"><span>فواتير متأخرة</span><b>{summary.overdueInvoicesCount}</b></div>
              <div className="flex justify-between"><span>قضايا مغلقة/مؤرشفة</span><b>{summary.closedCases}</b></div>
            </div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="text-xl font-black">دفعات الفترة</h2>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{data.periodPayments.length} حركة</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>القضية</th>
                  <th>الموكل</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>طريقة الدفع</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {data.periodPayments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8">لا توجد دفعات ضمن الفترة المحددة</td></tr>
                ) : data.periodPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.case?.id ? <Link href={`/dashboard/cases/${p.case.id}`}>{p.case.title}</Link> : '-'}</td>
                    <td>{p.case?.client?.name || '-'}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td>{paymentStatus(p.status)}</td>
                    <td>{p.method || '-'}</td>
                    <td>{formatDate(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="text-xl font-black">فواتير الفترة</h2>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{data.periodInvoices.length} فاتورة</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>الموكل</th>
                  <th>القضية</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>الإصدار</th>
                  <th>الاستحقاق</th>
                </tr>
              </thead>
              <tbody>
                {data.periodInvoices.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8">لا توجد فواتير ضمن الفترة المحددة</td></tr>
                ) : data.periodInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td><Link href={`/dashboard/invoices/${inv.id}`}>{inv.invoiceNumber}</Link></td>
                    <td>{inv.client?.name || '-'}</td>
                    <td>{inv.case?.id ? <Link href={`/dashboard/cases/${inv.case.id}`}>{inv.case.title}</Link> : '-'}</td>
                    <td>{formatCurrency(inv.total)}</td>
                    <td>{invoiceStatus(inv.status)}</td>
                    <td>{formatDate(inv.issueDate)}</td>
                    <td>{formatDate(inv.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-0 overflow-hidden">
            <div className="p-5 border-b"><h2 className="text-lg font-black">المواعيد القادمة</h2></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>الموعد</th><th>القضية</th><th>الوقت</th><th>المكان</th></tr></thead>
                <tbody>
                  {data.upcomingAppointments.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8">لا توجد مواعيد قادمة</td></tr>
                  ) : data.upcomingAppointments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>{a.case?.id ? <Link href={`/dashboard/cases/${a.case.id}`}>{a.case.title}</Link> : '-'}</td>
                      <td>{formatDate(a.startTime)}</td>
                      <td>{a.location || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="p-5 border-b"><h2 className="text-lg font-black">المهام المتأخرة</h2></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>المهمة</th><th>القضية</th><th>الأولوية</th><th>الاستحقاق</th></tr></thead>
                <tbody>
                  {data.overdueTasks.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8">لا توجد مهام متأخرة</td></tr>
                  ) : data.overdueTasks.map((t) => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>{t.case?.id ? <Link href={`/dashboard/cases/${t.case.id}`}>{t.case.title}</Link> : '-'}</td>
                      <td>{t.priority || '-'}</td>
                      <td>{formatDate(t.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
'''

backup = page_path.with_suffix('.tsx.bak_reports_summary')
if not backup.exists():
    backup.write_text(page_path.read_text(encoding='utf-8'), encoding='utf-8')

api_path.write_text(api_code, encoding='utf-8')
page_path.write_text(page_code, encoding='utf-8')

print('✅ تم تركيب Patch التقارير بنجاح')
print('تم إنشاء: src/app/api/reports/summary/route.ts')
print('تم تحديث: src/app/dashboard/reports/page.tsx')
print('الآن شغّل: npm run build')
