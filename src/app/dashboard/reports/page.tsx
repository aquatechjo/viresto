'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PageLoader from '@/components/ui/PageLoader'
import { formatCurrency } from '@/lib/utils'

const MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

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

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('ar-JO')
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
    OPEN: 'نشطة',
    IN_PROGRESS: 'قيد المتابعة',
    CLOSED: 'مغلقة',
    ARCHIVED: 'مؤرشفة',
  }

  return map[status] || status || '-'
}

function taskPriorityLabel(priority?: string | null) {
  const map: Record<string, string> = {
    URGENT: 'عاجلة',
    HIGH: 'عالية',
    MEDIUM: 'متوسطة',
    LOW: 'منخفضة',
  }

  return priority ? map[priority] || priority : '-'
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
        .join(',')
    )
    .join('\n')

  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()

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

    return Array.from({ length: 6 }, (_, index) => current - 3 + index)
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

    const response = await fetch(`/api/reports/summary?${params.toString()}`, {
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({}))
    const nextData = unwrapPayload(payload)

    if (!response.ok || !nextData) {
      setError(getMessage(payload))
      setData(null)
    } else {
      setData(nextData)
    }

    setLoading(false)
  }, [
    reportType,
    year,
    month,
    caseStatus,
    paymentStatusFilter,
    invoiceStatusFilter,
    clientId,
  ])

  useEffect(() => {
    load()
  }, [load])

  const maxRevenue = Math.max(
    ...(data?.monthlyRevenue || []).map((item) => item.revenue),
    1
  )

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

    return data.periodPayments.map((payment) => ({
      القضية: payment.case?.title || '-',
      الموكل: payment.case?.client?.name || '-',
      المبلغ: Number(payment.amount || 0),
      الحالة: paymentStatus(payment.status),
      طريقة_الدفع: payment.method || '-',
      التاريخ: formatDate(payment.paidAt),
      ملاحظات: payment.notes || '-',
    }))
  }

  function invoiceRowsForExport() {
    if (!data) return []

    return data.periodInvoices.map((invoice) => ({
      رقم_الفاتورة: invoice.invoiceNumber || '-',
      الموكل: invoice.client?.name || '-',
      القضية: invoice.case?.title || '-',
      المبلغ: Number(invoice.total || 0),
      الحالة: invoiceStatus(invoice.status),
      تاريخ_الإصدار: formatDate(invoice.issueDate),
      تاريخ_الاستحقاق: formatDate(invoice.dueDate),
    }))
  }

  function appointmentRowsForExport() {
    if (!data) return []

    return data.upcomingAppointments.map((appointment) => ({
      الموعد: appointment.title || '-',
      القضية: appointment.case?.title || '-',
      التاريخ: formatDate(appointment.startTime),
      المكان: appointment.location || '-',
    }))
  }

  function taskRowsForExport() {
    if (!data) return []

    return data.overdueTasks.map((task) => ({
      المهمة: task.title || '-',
      القضية: task.case?.title || '-',
      الأولوية: taskPriorityLabel(task.priority),
      الاستحقاق: formatDate(task.dueDate),
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

  const summary = data?.summary

  const caseRows = data
    ? [
        ['OPEN', data.caseStatus.OPEN || 0],
        ['IN_PROGRESS', data.caseStatus.IN_PROGRESS || 0],
        ['CLOSED', data.caseStatus.CLOSED || 0],
        ['ARCHIVED', data.caseStatus.ARCHIVED || 0],
      ]
    : []

  async function exportFullExcel() {
    if (!data) return

    const { exportSheetsExcel } = await import('@/lib/export')

    exportSheetsExcel(reportFilename(), [
      {
        name: 'الملخص',
        rows: summaryRows().map(([البند, القيمة]) => ({ البند, القيمة })),
      },
      {
        name: 'الدفعات',
        rows: paymentRowsForExport(),
      },
      {
        name: 'الفواتير',
        rows: invoiceRowsForExport(),
      },
      {
        name: 'المواعيد القادمة',
        rows: appointmentRowsForExport(),
      },
      {
        name: 'المهام المتأخرة',
        rows: taskRowsForExport(),
      },
      {
        name: 'الموكلون الأكثر نشاطًا',
        rows: topClientRowsForExport(),
      },
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
        columns: [
          'ملاحظات',
          'التاريخ',
          'طريقة الدفع',
          'الحالة',
          'المبلغ',
          'الموكل',
          'القضية',
        ],
        rows: paymentRowsForExport().map((payment) => [
          payment.ملاحظات,
          payment.التاريخ,
          payment.طريقة_الدفع,
          payment.الحالة,
          formatCurrency(payment.المبلغ),
          payment.الموكل,
          payment.القضية,
        ]),
      },
      {
        title: 'فواتير الفترة',
        columns: [
          'الاستحقاق',
          'الإصدار',
          'الحالة',
          'المبلغ',
          'القضية',
          'الموكل',
          'رقم الفاتورة',
        ],
        rows: invoiceRowsForExport().map((invoice) => [
          invoice.تاريخ_الاستحقاق,
          invoice.تاريخ_الإصدار,
          invoice.الحالة,
          formatCurrency(invoice.المبلغ),
          invoice.القضية,
          invoice.الموكل,
          invoice.رقم_الفاتورة,
        ]),
      },
      {
        title: 'الموكلون الأكثر نشاطًا',
        columns: [
          'مؤشر النشاط',
          'إجمالي الفواتير',
          'إجمالي الدفعات',
          'عدد القضايا',
          'الموكل',
        ],
        rows: topClientRowsForExport().map((client) => [
          client.مؤشر_النشاط,
          formatCurrency(client.إجمالي_الفواتير),
          formatCurrency(client.إجمالي_الدفعات),
          client.عدد_القضايا,
          client.الموكل,
        ]),
      },
      {
        title: 'المواعيد القادمة',
        columns: ['المكان', 'التاريخ', 'القضية', 'الموعد'],
        rows: appointmentRowsForExport().map((appointment) => [
          appointment.المكان,
          appointment.التاريخ,
          appointment.القضية,
          appointment.الموعد,
        ]),
      },
      {
        title: 'المهام المتأخرة',
        columns: ['الاستحقاق', 'الأولوية', 'القضية', 'المهمة'],
        rows: taskRowsForExport().map((task) => [
          task.الاستحقاق,
          task.الأولوية,
          task.القضية,
          task.المهمة,
        ]),
      },
    ])
  }

  function exportPayments() {
    if (!data) return

    const rows = [
      ['القضية', 'الموكل', 'المبلغ', 'الحالة', 'طريقة الدفع', 'التاريخ'],
      ...data.periodPayments.map((payment) => [
        payment.case?.title || '-',
        payment.case?.client?.name || '-',
        Number(payment.amount || 0),
        paymentStatus(payment.status),
        payment.method || '-',
        formatDate(payment.paidAt),
      ]),
    ]

    downloadCsv(`payments-report-${year}.csv`, rows)
  }

  function exportInvoices() {
    if (!data) return

    const rows = [
      [
        'رقم الفاتورة',
        'الموكل',
        'القضية',
        'المبلغ',
        'الحالة',
        'تاريخ الإصدار',
        'تاريخ الاستحقاق',
      ],
      ...data.periodInvoices.map((invoice) => [
        invoice.invoiceNumber || '-',
        invoice.client?.name || '-',
        invoice.case?.title || '-',
        Number(invoice.total || 0),
        invoiceStatus(invoice.status),
        formatDate(invoice.issueDate),
        formatDate(invoice.dueDate),
      ]),
    ]

    downloadCsv(`invoices-report-${year}.csv`, rows)
  }

  if (loading) return <PageLoader />

  if (error) {
    return (
      <div className="space-y-5 stagger">
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 18px 50px rgba(45, 74, 62, 0.18)',
          }}
        >
          <h1 className="text-2xl font-black text-white">التقارير</h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
            تعذر تحميل بيانات التقارير في الوقت الحالي.
          </p>
        </div>

        <div className="card p-6">
          <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
            {error}
          </p>

          <button onClick={load} className="btn btn-primary">
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  if (!data || !summary) return null

  return (
    <>
      <style jsx global>{`
        @media print {
          aside,
          header,
          nav,
          .print\\:hidden {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .card {
            break-inside: avoid;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="space-y-5 stagger">
        {/* Hero */}
        <div
          className="relative overflow-hidden rounded-[28px] border p-6 print:hidden"
          style={{
            background:
              'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 18px 50px rgba(45, 74, 62, 0.18)',
          }}
        >
          <div
            className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
            style={{ background: 'rgba(245, 200, 66, 0.16)' }}
          />

          <div
            className="absolute -bottom-20 right-16 h-52 w-52 rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          />

          <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div
                className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                مركز التقارير والتحليلات
              </div>

              <h1 className="text-2xl font-black text-white">
                {reportTitle()}
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
                تقارير مالية وإدارية شاملة تعرض الإيرادات، الفواتير، الدفعات،
                القضايا، المواعيد والمهام لمساعدة المكتب على اتخاذ قرارات أوضح.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.print()}
                className="btn"
                style={{
                  background: '#fff',
                  color: 'var(--sidebar)',
                  borderColor: 'rgba(255,255,255,0.32)',
                }}
              >
                طباعة
              </button>

              <button
                onClick={exportFullPdf}
                className="btn"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.22)',
                }}
              >
                PDF شامل
              </button>

              <button
                onClick={exportFullExcel}
                className="btn"
                style={{
                  background: 'rgba(245,200,66,0.18)',
                  color: '#fff',
                  borderColor: 'rgba(245,200,66,0.35)',
                }}
              >
                Excel شامل
              </button>
            </div>
          </div>
        </div>

        <div className="hidden print:block">
          <h1 className="text-3xl font-black" style={{ color: 'var(--text)' }}>
            {reportTitle()}
          </h1>

          <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
            ملخص مالي وإداري شامل
          </p>
        </div>

        {/* Filters */}
        <div className="card p-4 print:hidden">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[.8fr_.8fr_.8fr_1fr_1fr_1fr]">
            <select
              aria-label="نوع التقرير"
              title="نوع التقرير"
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType)}
              className="input"
            >
              <option value="yearly">تقرير سنوي</option>
              <option value="monthly">تقرير شهري</option>
            </select>

            {reportType === 'monthly' ? (
              <select
                aria-label="الشهر"
                title="الشهر"
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className="input"
              >
                {MONTHS.map((monthName, index) => (
                  <option key={monthName} value={index}>
                    {monthName}
                  </option>
                ))}
              </select>
            ) : (
              <div className="hidden xl:block" />
            )}

            <select
              aria-label="السنة"
              title="السنة"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="input"
            >
              {years.map((yearItem) => (
                <option key={yearItem} value={yearItem}>
                  {yearItem}
                </option>
              ))}
            </select>

            <select
              aria-label="الموكل"
              title="الموكل"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="input"
            >
              <option value="">جميع الموكلين</option>

              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            <select
              aria-label="حالة القضية"
              title="حالة القضية"
              value={caseStatus}
              onChange={(event) => setCaseStatus(event.target.value)}
              className="input"
            >
              <option value="">جميع حالات القضايا</option>
              <option value="OPEN">نشطة</option>
              <option value="IN_PROGRESS">قيد المتابعة</option>
              <option value="CLOSED">مغلقة</option>
              <option value="ARCHIVED">مؤرشفة</option>
            </select>

            <select
              aria-label="حالة الدفعة"
              title="حالة الدفعة"
              value={paymentStatusFilter}
              onChange={(event) => setPaymentStatusFilter(event.target.value)}
              className="input"
            >
              <option value="">جميع الدفعات</option>
              <option value="PAID">مدفوعة</option>
              <option value="PENDING">معلقة</option>
              <option value="OVERDUE">متأخرة</option>
              <option value="CANCELLED">ملغاة</option>
            </select>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto_auto_auto]">
            <select
              aria-label="حالة الفاتورة"
              title="حالة الفاتورة"
              value={invoiceStatusFilter}
              onChange={(event) => setInvoiceStatusFilter(event.target.value)}
              className="input"
            >
              <option value="">جميع الفواتير</option>
              <option value="DRAFT">مسودة</option>
              <option value="UNPAID">غير مدفوعة</option>
              <option value="PAID">مدفوعة</option>
              <option value="OVERDUE">متأخرة</option>
              <option value="CANCELLED">ملغاة</option>
            </select>

            <button onClick={load} className="btn btn-ghost whitespace-nowrap">
              تحديث البيانات
            </button>

            <button
              onClick={resetFilters}
              className="btn btn-ghost whitespace-nowrap"
            >
              مسح الفلاتر
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportPayments}
                className="btn btn-ghost whitespace-nowrap"
              >
                دفعات CSV
              </button>

              <button
                onClick={exportInvoices}
                className="btn btn-ghost whitespace-nowrap"
              >
                فواتير CSV
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label:
                reportType === 'monthly'
                  ? `إيرادات ${MONTHS[month]}`
                  : 'إيرادات الفترة',
              value: formatCurrency(summary.periodRevenue),
              color: 'var(--sidebar)',
              bg: 'var(--green-soft)',
            },
            {
              label: 'دفعات معلقة/متأخرة',
              value: formatCurrency(summary.pendingPaymentsAmount),
              color:
                summary.pendingPaymentsAmount > 0 ? '#dc2626' : 'var(--text-3)',
              bg:
                summary.pendingPaymentsAmount > 0
                  ? 'var(--red-soft)'
                  : 'var(--card)',
            },
            {
              label: 'فواتير غير مدفوعة',
              value: formatCurrency(summary.unpaidInvoicesAmount),
              color:
                summary.unpaidInvoicesAmount > 0 ? '#92400e' : 'var(--text-3)',
              bg:
                summary.unpaidInvoicesAmount > 0
                  ? 'var(--amber-soft)'
                  : 'var(--card)',
            },
            {
              label: 'نسبة التحصيل',
              value: `${summary.collectionRate}%`,
              color:
                summary.collectionRate >= 80 ? 'var(--sidebar)' : '#92400e',
              bg:
                summary.collectionRate >= 80
                  ? 'var(--green-soft)'
                  : 'var(--amber-soft)',
            },
            {
              label: 'عدد القضايا',
              value: summary.totalCases,
              color: 'var(--text)',
              bg: 'var(--card)',
            },
            {
              label: 'القضايا النشطة',
              value: summary.openCases,
              color: 'var(--sidebar)',
              bg: 'var(--green-soft)',
            },
            {
              label: 'المواعيد القادمة',
              value: summary.upcomingAppointmentsCount,
              color: '#2563eb',
              bg: 'var(--card)',
            },
            {
              label: 'مهام متأخرة',
              value: summary.overdueTasksCount,
              color: summary.overdueTasksCount > 0 ? '#dc2626' : 'var(--text-3)',
              bg:
                summary.overdueTasksCount > 0
                  ? 'var(--red-soft)'
                  : 'var(--card)',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="card p-5"
              style={{
                background: item.bg,
                borderColor: 'var(--border)',
              }}
            >
              <p className="text-xs font-black" style={{ color: item.color }}>
                {item.label}
              </p>

              <p className="mt-2 text-2xl font-black" style={{ color: item.color }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Overview */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                حالة القضايا
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                توزيع القضايا حسب الحالة
              </p>
            </div>

            <div className="space-y-3">
              {caseRows.map(([status, count]) => {
                const percent =
                  summary.totalCases > 0
                    ? Math.round((Number(count) / summary.totalCases) * 100)
                    : 0

                return (
                  <div key={String(status)}>
                    <div
                      className="mb-1 flex justify-between text-sm"
                      style={{ color: 'var(--text-2)' }}
                    >
                      <span>{caseStatusLabel(String(status))}</span>
                      <span>
                        {count} / {percent}%
                      </span>
                    </div>

                    <div
                      className="h-2 overflow-hidden rounded-full"
                      style={{ background: 'var(--bg-2)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percent}%`,
                          background: 'var(--sidebar)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                الإيرادات الشهرية
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                مقارنة الإيرادات على مدار السنة
              </p>
            </div>

            <div className="flex h-44 items-end gap-2">
              {data.monthlyRevenue.map((item) => {
                const height = Math.max(
                  4,
                  Math.round((item.revenue / maxRevenue) * 100)
                )

                return (
                  <div
                    key={item.month}
                    className="flex flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div
                      title={`${MONTHS[item.month]}: ${formatCurrency(item.revenue)}`}
                      className="w-full rounded-t-xl"
                      style={{
                        height: `${height}%`,
                        background: 'var(--sidebar)',
                        opacity: item.month === month ? 1 : 0.55,
                      }}
                    />

                    <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                      {MONTHS[item.month].slice(0, 3)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                الموكلون الأكثر نشاطًا
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                حسب القضايا والدفعات والفواتير
              </p>
            </div>

            <div className="space-y-3">
              {data.topClients.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  لا توجد بيانات كافية.
                </p>
              ) : (
                data.topClients.map((client, index) => (
                  <div
                    key={client.id}
                    className="rounded-2xl border p-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold" style={{ color: 'var(--text)' }}>
                        {index + 1}. {client.name}
                      </p>

                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {client.casesCount} قضايا
                      </span>
                    </div>

                    <div
                      className="mt-2 grid grid-cols-2 gap-2 text-xs"
                      style={{ color: 'var(--text-2)' }}
                    >
                      <span>دفعات: {formatCurrency(client.paymentsTotal)}</span>
                      <span>فواتير: {formatCurrency(client.invoicesTotal)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Financial Tables */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="card overflow-hidden p-0">
            <div
              className="border-b p-5"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                دفعات الفترة
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                الدفعات المطابقة للفلاتر الحالية
              </p>
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
                    <tr>
                      <td colSpan={5} className="text-center py-6">
                        لا توجد دفعات ضمن الفلاتر الحالية
                      </td>
                    </tr>
                  ) : (
                    data.periodPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.case?.title || '-'}</td>
                        <td>{payment.case?.client?.name || '-'}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{paymentStatus(payment.status)}</td>
                        <td>{formatDate(payment.paidAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden p-0">
            <div
              className="border-b p-5"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                فواتير الفترة
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                الفواتير المطابقة للفلاتر الحالية
              </p>
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
                    <tr>
                      <td colSpan={5} className="text-center py-6">
                        لا توجد فواتير ضمن الفلاتر الحالية
                      </td>
                    </tr>
                  ) : (
                    data.periodInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.invoiceNumber}</td>
                        <td>{invoice.client?.name || '-'}</td>
                        <td>{formatCurrency(invoice.total)}</td>
                        <td>{invoiceStatus(invoice.status)}</td>
                        <td>{formatDate(invoice.dueDate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Operations */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                المواعيد القادمة
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                أقرب المواعيد ضمن نطاق التقرير
              </p>
            </div>

            <div className="space-y-3">
              {data.upcomingAppointments.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  لا توجد مواعيد قادمة.
                </p>
              ) : (
                data.upcomingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border p-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <p className="font-bold" style={{ color: 'var(--text)' }}>
                      {appointment.title}
                    </p>

                    <p
                      className="text-xs mt-1"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {formatDate(appointment.startTime)} —{' '}
                      {appointment.case?.title || '-'} —{' '}
                      {appointment.location || '-'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                المهام المتأخرة
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                المهام التي تحتاج متابعة فورية
              </p>
            </div>

            <div className="space-y-3">
              {data.overdueTasks.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  لا توجد مهام متأخرة.
                </p>
              ) : (
                data.overdueTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border p-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <p className="font-bold" style={{ color: 'var(--text)' }}>
                      {task.title}
                    </p>

                    <p
                      className="text-xs mt-1"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {formatDate(task.dueDate)} — {task.case?.title || '-'} —{' '}
                      {taskPriorityLabel(task.priority)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}