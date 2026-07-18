'use client'
import AppLoader from "@/components/ui/AppLoader"
import SubscriptionReadOnlyBanner from '@/components/billing/SubscriptionReadOnlyBanner'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { toast } from 'sonner'
import { useLocale } from '@/lib/useLocale'
import { useTenantWriteAccess } from '@/hooks/useTenantWriteAccess'
import type { Locale } from '@/lib/i18n'

const REPORT_COPY = {
  ar: {
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    hero: {
      badge: 'مركز التقارير والتحليلات',
      yearlyTitle: (year: number) => `التقرير السنوي ${year}`,
      monthlyTitle: (monthName: string, year: number) => `تقرير ${monthName} ${year}`,
      subtitle: 'تقارير مالية وإدارية شاملة تعرض الإيرادات، الفواتير، الدفعات، القضايا، المواعيد والمهام لمساعدة المكتب على اتخاذ قرارات أوضح.',
      printSummary: 'ملخص مالي وإداري شامل',
    },
    actions: {
      print: 'طباعة',
      fullPdf: 'PDF شامل',
      fullExcel: 'Excel شامل',
      refresh: 'تحديث البيانات',
      clearFilters: 'مسح الفلاتر',
      paymentsCsv: 'دفعات CSV',
      invoicesCsv: 'فواتير CSV',
      retry: 'إعادة المحاولة',
      exporting: 'جاري تجهيز الملف الكامل...',
      exportLocked: 'التصدير متاح بعد تجديد الاشتراك.',
    },
    error: {
      title: 'التقارير',
      subtitle: 'تعذر تحميل بيانات التقارير في الوقت الحالي.',
      load: 'تعذر تحميل التقرير',
      export: 'تعذر تحميل جميع بيانات التقرير للتصدير',
    },
    filters: {
      reportType: 'نوع التقرير',
      month: 'الشهر',
      year: 'السنة',
      client: 'الموكل',
      caseStatus: 'حالة القضية',
      paymentStatus: 'حالة الدفعة',
      invoiceStatus: 'حالة الفاتورة',
      yearly: 'تقرير سنوي',
      monthly: 'تقرير شهري',
      allClients: 'جميع الموكلين',
      allCaseStatuses: 'جميع حالات القضايا',
      allPayments: 'جميع الدفعات',
      allInvoices: 'جميع الفواتير',
    },
    stats: {
      periodRevenue: 'إيرادات الفترة',
      monthlyRevenue: (monthName: string) => `إيرادات ${monthName}`,
      pendingPayments: 'دفعات معلقة/متأخرة',
      unpaidInvoices: 'فواتير غير مدفوعة',
      collectionRate: 'نسبة التحصيل',
      totalCases: 'عدد القضايا',
      openCases: 'القضايا النشطة',
      upcomingAppointments: 'المواعيد القادمة',
      overdueTasks: 'مهام متأخرة',
      totalPaidAll: 'إجمالي التحصيل',
      totalInvoices: 'إجمالي الفواتير',
      paidInvoices: 'المحصّل من الفواتير',
      overdueInvoices: 'فواتير متأخرة',
      closedCases: 'القضايا المغلقة/المؤرشفة',
    },
    sections: {
      caseStatus: { title: 'حالة القضايا', subtitle: 'توزيع القضايا حسب الحالة' },
      monthlyRevenue: { title: 'الإيرادات الشهرية', subtitle: 'مقارنة الإيرادات على مدار السنة' },
      topClients: { title: 'الموكلون الأكثر نشاطًا', subtitle: 'حسب القضايا والدفعات والفواتير', empty: 'لا توجد بيانات كافية.' },
      periodPayments: { title: 'دفعات الفترة', subtitle: 'الدفعات المطابقة للفلاتر الحالية', empty: 'لا توجد دفعات ضمن الفلاتر الحالية' },
      periodInvoices: { title: 'فواتير الفترة', subtitle: 'الفواتير المطابقة للفلاتر الحالية', empty: 'لا توجد فواتير ضمن الفلاتر الحالية' },
      appointments: { title: 'المواعيد القادمة', subtitle: 'أقرب المواعيد ضمن نطاق التقرير', empty: 'لا توجد مواعيد قادمة.' },
      tasks: { title: 'المهام المتأخرة', subtitle: 'المهام التي تحتاج متابعة فورية', empty: 'لا توجد مهام متأخرة.' },
    },
    table: { case: 'القضية', client: 'الموكل', amount: 'المبلغ', collected: 'المحصل', remaining: 'المتبقي', status: 'الحالة', date: 'التاريخ', invoiceNumber: 'رقم الفاتورة', dueDate: 'الاستحقاق', paymentMethod: 'طريقة الدفع', notes: 'ملاحظات', issueDate: 'تاريخ الإصدار', dueDateFull: 'تاريخ الاستحقاق', appointment: 'الموعد', location: 'المكان', task: 'المهمة', priority: 'الأولوية', activityScore: 'مؤشر النشاط', invoicesTotal: 'إجمالي الفواتير', paymentsTotal: 'إجمالي الدفعات', casesCount: 'عدد القضايا', item: 'البند', value: 'القيمة' },
    statuses: {
      payments: { PAID: 'مدفوع', PENDING: 'معلق', OVERDUE: 'متأخر', CANCELLED: 'ملغي' },
      invoices: { DRAFT: 'مسودة', UNPAID: 'غير مدفوعة', PARTIALLY_PAID: 'مدفوعة جزئيًا', PAID: 'مدفوعة', OVERDUE: 'متأخرة', CANCELLED: 'ملغاة' },
      cases: { OPEN: 'نشطة', IN_PROGRESS: 'قيد المتابعة', CLOSED: 'مغلقة', ARCHIVED: 'مؤرشفة' },
      priorities: { URGENT: 'عاجلة', HIGH: 'عالية', MEDIUM: 'متوسطة', LOW: 'منخفضة' },
    },
    misc: { cases: 'قضايا', payments: 'دفعات', invoices: 'فواتير' },
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    hero: {
      badge: 'Reports and analytics center',
      yearlyTitle: (year: number) => `Annual report ${year}`,
      monthlyTitle: (monthName: string, year: number) => `${monthName} ${year} report`,
      subtitle: 'Comprehensive financial and operational reports covering revenue, invoices, payments, cases, appointments, and tasks to support clearer office decisions.',
      printSummary: 'Comprehensive financial and operational summary',
    },
    actions: {
      print: 'Print',
      fullPdf: 'Full PDF',
      fullExcel: 'Full Excel',
      refresh: 'Refresh data',
      clearFilters: 'Clear filters',
      paymentsCsv: 'Payments CSV',
      invoicesCsv: 'Invoices CSV',
      retry: 'Retry',
      exporting: 'Preparing the complete file...',
      exportLocked: 'Export is available after renewing the subscription.',
    },
    error: {
      title: 'Reports',
      subtitle: 'Unable to load report data right now.',
      load: 'Failed to load report',
      export: 'Could not load all report data for export',
    },
    filters: {
      reportType: 'Report type',
      month: 'Month',
      year: 'Year',
      client: 'Client',
      caseStatus: 'Case status',
      paymentStatus: 'Payment status',
      invoiceStatus: 'Invoice status',
      yearly: 'Annual report',
      monthly: 'Monthly report',
      allClients: 'All clients',
      allCaseStatuses: 'All case statuses',
      allPayments: 'All payments',
      allInvoices: 'All invoices',
    },
    stats: {
      periodRevenue: 'Period revenue',
      monthlyRevenue: (monthName: string) => `${monthName} revenue`,
      pendingPayments: 'Pending/overdue payments',
      unpaidInvoices: 'Unpaid invoices',
      collectionRate: 'Collection rate',
      totalCases: 'Total cases',
      openCases: 'Active cases',
      upcomingAppointments: 'Upcoming appointments',
      overdueTasks: 'Overdue tasks',
      totalPaidAll: 'Total collected',
      totalInvoices: 'Total invoices',
      paidInvoices: 'Collected on invoices',
      overdueInvoices: 'Overdue invoices',
      closedCases: 'Closed/archived cases',
    },
    sections: {
      caseStatus: { title: 'Case status', subtitle: 'Cases distributed by status' },
      monthlyRevenue: { title: 'Monthly revenue', subtitle: 'Revenue comparison across the year' },
      topClients: { title: 'Most active clients', subtitle: 'Based on cases, payments, and invoices', empty: 'Not enough data.' },
      periodPayments: { title: 'Period payments', subtitle: 'Payments matching the current filters', empty: 'No payments match the current filters' },
      periodInvoices: { title: 'Period invoices', subtitle: 'Invoices matching the current filters', empty: 'No invoices match the current filters' },
      appointments: { title: 'Upcoming appointments', subtitle: 'Nearest appointments within the report range', empty: 'No upcoming appointments.' },
      tasks: { title: 'Overdue tasks', subtitle: 'Tasks that need immediate follow-up', empty: 'No overdue tasks.' },
    },
    table: { case: 'Case', client: 'Client', amount: 'Amount', collected: 'Collected', remaining: 'Remaining', status: 'Status', date: 'Date', invoiceNumber: 'Invoice number', dueDate: 'Due date', paymentMethod: 'Payment method', notes: 'Notes', issueDate: 'Issue date', dueDateFull: 'Due date', appointment: 'Appointment', location: 'Location', task: 'Task', priority: 'Priority', activityScore: 'Activity score', invoicesTotal: 'Invoices total', paymentsTotal: 'Payments total', casesCount: 'Cases count', item: 'Item', value: 'Value' },
    statuses: {
      payments: { PAID: 'Paid', PENDING: 'Pending', OVERDUE: 'Overdue', CANCELLED: 'Cancelled' },
      invoices: { DRAFT: 'Draft', UNPAID: 'Unpaid', PARTIALLY_PAID: 'Partially paid', PAID: 'Paid', OVERDUE: 'Overdue', CANCELLED: 'Cancelled' },
      cases: { OPEN: 'Active', IN_PROGRESS: 'In progress', CLOSED: 'Closed', ARCHIVED: 'Archived' },
      priorities: { URGENT: 'Urgent', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' },
    },
    misc: { cases: 'cases', payments: 'Payments', invoices: 'Invoices' },
  },
} as const

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
  createdAt: string
  reportDate: string
  notes?: string | null
  client: {
    id: string
    name: string
  }
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
  paidAmount: number
  remainingAmount: number
  isOverdue: boolean
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
  detailMode: 'preview' | 'all'
  detailCounts: {
    payments: number
    invoices: number
  }
}

function unwrapPayload(payload: any): ReportData | null {
  return payload?.data?.summary ? payload.data : payload?.summary ? payload : null
}

function getMessage(payload: any, fallback: string) {
  return payload?.message || payload?.error || payload?.data?.message || fallback
}

function formatDate(value: string | Date | null | undefined, locale: Locale) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString(locale === 'ar' ? 'ar-JO' : 'en-US')
}

function formatMoney(value: number, locale: Locale) {
  const amount = Number(value || 0)

  const formatted = amount.toLocaleString(locale === 'ar' ? 'ar-JO' : 'en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })

  return locale === 'ar' ? `${formatted} د.أ` : `JOD ${formatted}`
}

function paymentStatusLabel(status: string, copy: typeof REPORT_COPY.ar | typeof REPORT_COPY.en) {
  return copy.statuses.payments[status as keyof typeof copy.statuses.payments] || status || '-'
}

function invoiceStatusLabel(status: string, copy: typeof REPORT_COPY.ar | typeof REPORT_COPY.en) {
  return copy.statuses.invoices[status as keyof typeof copy.statuses.invoices] || status || '-'
}

function invoiceDisplayStatus(
  invoice: ReportInvoice,
  copy: typeof REPORT_COPY.ar | typeof REPORT_COPY.en
) {
  if (invoice.isOverdue && invoice.status === 'PARTIALLY_PAID') {
    return `${copy.statuses.invoices.OVERDUE} • ${copy.statuses.invoices.PARTIALLY_PAID}`
  }

  if (invoice.isOverdue) return copy.statuses.invoices.OVERDUE
  return invoiceStatusLabel(invoice.status, copy)
}

function caseStatusLabel(status: string, copy: typeof REPORT_COPY.ar | typeof REPORT_COPY.en) {
  return copy.statuses.cases[status as keyof typeof copy.statuses.cases] || status || '-'
}

function taskPriorityLabel(priority: string | null | undefined, copy: typeof REPORT_COPY.ar | typeof REPORT_COPY.en) {
  return priority ? copy.statuses.priorities[priority as keyof typeof copy.statuses.priorities] || priority : '-'
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
  const localeState = useLocale() as { locale?: Locale }
  const locale: Locale = localeState?.locale === 'en' ? 'en' : 'ar'
  const isRtl = locale === 'ar'
  const copy = REPORT_COPY[locale]
  const months = copy.months
  const fieldStyle = { textAlign: isRtl ? 'right' : 'left', direction: isRtl ? 'rtl' : 'ltr' } as CSSProperties
  const controlClass = 'input min-h-[48px] min-w-0 w-full text-start'
  const actionButtonClass = 'btn btn-ghost min-h-[44px] w-full justify-center whitespace-nowrap px-5'
  const primaryActionButtonClass = 'btn btn-primary min-h-[44px] w-full justify-center whitespace-nowrap px-6'
  const actionButtonStyle = { color: 'var(--text)' } as CSSProperties
  const reportAccess = useTenantWriteAccess(locale)
  const exportDisabled =
    !reportAccess.canWrite || reportAccess.entitlements?.fullExport !== true
  const exportDisabledTitle =
    reportAccess.message ||
    (locale === 'ar'
      ? 'التصدير الكامل غير متاح في خطتك الحالية.'
      : 'Full export is not available in your current plan.')

  const [reportType, setReportType] = useState<ReportType>('yearly')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [caseStatus, setCaseStatus] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('')
  const [clientId, setClientId] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const years = useMemo(() => {
    const current = new Date().getFullYear()

    return Array.from({ length: 6 }, (_, index) => current - 3 + index)
  }, [])

  const buildReportParams = useCallback((details: 'preview' | 'all') => {
    const params = new URLSearchParams({
      type: reportType,
      year: String(year),
      month: String(month),
      details,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Amman',
    })

    if (caseStatus) params.set('caseStatus', caseStatus)
    if (paymentStatusFilter) params.set('paymentStatus', paymentStatusFilter)
    if (invoiceStatusFilter) params.set('invoiceStatus', invoiceStatusFilter)
    if (clientId) params.set('clientId', clientId)

    return params
  }, [
    reportType,
    year,
    month,
    caseStatus,
    paymentStatusFilter,
    invoiceStatusFilter,
    clientId,
  ])

  const fetchReportData = useCallback(async (details: 'preview' | 'all') => {
    const params = buildReportParams(details)

    const response = await fetch(`/api/reports/summary?${params.toString()}`, {
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({}))
    const nextData = unwrapPayload(payload)

    if (!response.ok || !nextData) {
      throw new Error(getMessage(payload, copy.error.load))
    }

    return nextData
  }, [buildReportParams, copy.error.load])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setData(await fetchReportData('preview'))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.error.load)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [fetchReportData, copy.error.load])

  const withCompleteReport = useCallback(async (
    action: (completeData: ReportData) => Promise<void> | void
  ) => {
    if (exportDisabled || exporting) return

    setExporting(true)

    try {
      const completeData = await fetchReportData('all')
      await action(completeData)
    } catch (exportError) {
      toast.error(
        exportError instanceof Error ? exportError.message : copy.error.export
      )
    } finally {
      setExporting(false)
    }
  }, [exportDisabled, exporting, fetchReportData, copy.error.export])

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
      ? copy.hero.monthlyTitle(months[month], year)
      : copy.hero.yearlyTitle(year)
  }

  function reportFilename() {
    return reportType === 'monthly'
      ? `viresto-report-${year}-${String(month + 1).padStart(2, '0')}`
      : `viresto-report-${year}`
  }

  function summaryRows(source: ReportData | null = data) {
    if (!source) return []

    const summary = source.summary

    return [
      [copy.stats.periodRevenue, formatMoney(summary.periodRevenue, locale)],
      [copy.stats.totalPaidAll, formatMoney(summary.totalPaidAll, locale)],
      [copy.stats.pendingPayments, formatMoney(summary.pendingPaymentsAmount, locale)],
      [copy.stats.totalInvoices, formatMoney(summary.totalInvoicesAmount, locale)],
      [copy.stats.paidInvoices, formatMoney(summary.paidInvoicesAmount, locale)],
      [copy.stats.unpaidInvoices, formatMoney(summary.unpaidInvoicesAmount, locale)],
      [copy.stats.overdueInvoices, formatMoney(summary.overdueInvoicesAmount, locale)],
      [copy.stats.collectionRate, `${summary.collectionRate}%`],
      [copy.stats.totalCases, summary.totalCases],
      [copy.stats.openCases, summary.openCases],
      [copy.stats.closedCases, summary.closedCases],
      [copy.stats.upcomingAppointments, summary.upcomingAppointmentsCount],
      [copy.stats.overdueTasks, summary.overdueTasksCount],
    ]
  }

  function paymentRowsForExport(source: ReportData | null = data) {
    if (!source) return []

    return source.periodPayments.map((payment) => ({
      القضية: payment.case?.title || '-',
      الموكل: payment.client?.name || '-',
      المبلغ: Number(payment.amount || 0),
      الحالة: paymentStatusLabel(payment.status, copy),
      طريقة_الدفع: payment.method || '-',
      التاريخ: formatDate(payment.reportDate, locale),
      ملاحظات: payment.notes || '-',
    }))
  }

  function invoiceRowsForExport(source: ReportData | null = data) {
    if (!source) return []

    return source.periodInvoices.map((invoice) => ({
      رقم_الفاتورة: invoice.invoiceNumber || '-',
      الموكل: invoice.client?.name || '-',
      القضية: invoice.case?.title || '-',
      المبلغ: Number(invoice.total || 0),
      المحصل: Number(invoice.paidAmount || 0),
      المتبقي: Number(invoice.remainingAmount || 0),
      الحالة: invoiceDisplayStatus(invoice, copy),
      تاريخ_الإصدار: formatDate(invoice.issueDate, locale),
      تاريخ_الاستحقاق: formatDate(invoice.dueDate, locale),
    }))
  }

  function appointmentRowsForExport(source: ReportData | null = data) {
    if (!source) return []

    return source.upcomingAppointments.map((appointment) => ({
      الموعد: appointment.title || '-',
      القضية: appointment.case?.title || '-',
      التاريخ: formatDate(appointment.startTime, locale),
      المكان: appointment.location || '-',
    }))
  }

  function taskRowsForExport(source: ReportData | null = data) {
    if (!source) return []

    return source.overdueTasks.map((task) => ({
      المهمة: task.title || '-',
      القضية: task.case?.title || '-',
      الأولوية: taskPriorityLabel(task.priority, copy),
      الاستحقاق: formatDate(task.dueDate, locale),
    }))
  }

  function topClientRowsForExport(source: ReportData | null = data) {
    if (!source) return []

    return source.topClients.map((client) => ({
      الموكل: client.name,
      عدد_القضايا: client.casesCount,
      إجمالي_الدفعات: client.paymentsTotal,
      إجمالي_الفواتير: client.invoicesTotal,
      مؤشر_النشاط: client.activityScore,
    }))
  }

  const summary = data?.summary

  function caseRowsForExport(source: ReportData | null = data) {
    return source
      ? [
        ['OPEN', source.caseStatus.OPEN || 0],
        ['IN_PROGRESS', source.caseStatus.IN_PROGRESS || 0],
        ['CLOSED', source.caseStatus.CLOSED || 0],
        ['ARCHIVED', source.caseStatus.ARCHIVED || 0],
      ]
      : []
  }

  const caseRows = caseRowsForExport()

  async function exportFullExcel() {
    await withCompleteReport(async (completeData) => {
      const { exportSheetsExcel } = await import('@/lib/export')

      exportSheetsExcel(reportFilename(), [
        {
          name: 'الملخص',
          rows: summaryRows(completeData).map(([البند, القيمة]) => ({ البند, القيمة })),
        },
        {
          name: 'الدفعات',
          rows: paymentRowsForExport(completeData),
        },
        {
          name: 'الفواتير',
          rows: invoiceRowsForExport(completeData),
        },
        {
          name: copy.sections.appointments.title,
          rows: appointmentRowsForExport(completeData),
        },
        {
          name: copy.sections.tasks.title,
          rows: taskRowsForExport(completeData),
        },
        {
          name: copy.sections.topClients.title,
          rows: topClientRowsForExport(completeData),
        },
        {
          name: copy.sections.caseStatus.title,
          rows: caseRowsForExport(completeData).map(([status, count]) => ({
            الحالة: caseStatusLabel(String(status), copy),
            العدد: count,
          })),
        },
      ])
    })
  }

  async function exportFullPdf() {
    await withCompleteReport(async (completeData) => {
      const { exportReportPDF } = await import('@/lib/export')

      exportReportPDF(reportFilename(), reportTitle(), summaryRows(completeData), [
      {
        title: copy.sections.periodPayments.title,
        columns: [
          'ملاحظات',
          'التاريخ',
          'طريقة الدفع',
          'الحالة',
          'المبلغ',
          'الموكل',
          'القضية',
        ],
        rows: paymentRowsForExport(completeData).map((payment) => [
          payment.ملاحظات,
          payment.التاريخ,
          payment.طريقة_الدفع,
          payment.الحالة,
          formatMoney(payment.المبلغ, locale),
          payment.الموكل,
          payment.القضية,
        ]),
      },
      {
        title: copy.sections.periodInvoices.title,
        columns: [
          'الاستحقاق',
          'الإصدار',
          'الحالة',
          'المتبقي',
          'المحصل',
          'المبلغ',
          'القضية',
          'الموكل',
          'رقم الفاتورة',
        ],
        rows: invoiceRowsForExport(completeData).map((invoice) => [
          invoice.تاريخ_الاستحقاق,
          invoice.تاريخ_الإصدار,
          invoice.الحالة,
          formatMoney(invoice.المتبقي, locale),
          formatMoney(invoice.المحصل, locale),
          formatMoney(invoice.المبلغ, locale),
          invoice.القضية,
          invoice.الموكل,
          invoice.رقم_الفاتورة,
        ]),
      },
      {
        title: copy.sections.topClients.title,
        columns: [
          'مؤشر النشاط',
          'إجمالي الفواتير',
          'إجمالي الدفعات',
          'عدد القضايا',
          'الموكل',
        ],
        rows: topClientRowsForExport(completeData).map((client) => [
          client.مؤشر_النشاط,
          formatMoney(client.إجمالي_الفواتير, locale),
          formatMoney(client.إجمالي_الدفعات, locale),
          client.عدد_القضايا,
          client.الموكل,
        ]),
      },
      {
        title: copy.sections.appointments.title,
        columns: ['المكان', 'التاريخ', 'القضية', 'الموعد'],
        rows: appointmentRowsForExport(completeData).map((appointment) => [
          appointment.المكان,
          appointment.التاريخ,
          appointment.القضية,
          appointment.الموعد,
        ]),
      },
      {
        title: copy.sections.tasks.title,
        columns: ['الاستحقاق', 'الأولوية', 'القضية', 'المهمة'],
        rows: taskRowsForExport(completeData).map((task) => [
          task.الاستحقاق,
          task.الأولوية,
          task.القضية,
          task.المهمة,
        ]),
      },
      ])
    })
  }

  async function exportPayments() {
    await withCompleteReport((completeData) => {
      const rows = [
        ['القضية', 'الموكل', 'المبلغ', 'الحالة', 'طريقة الدفع', 'التاريخ'],
        ...completeData.periodPayments.map((payment) => [
          payment.case?.title || '-',
          payment.client?.name || '-',
          Number(payment.amount || 0),
          paymentStatusLabel(payment.status, copy),
          payment.method || '-',
          formatDate(payment.reportDate, locale),
        ]),
      ]

      downloadCsv(`payments-report-${year}.csv`, rows)
    })
  }

  async function exportInvoices() {
    await withCompleteReport((completeData) => {
      const rows = [
        [
          'رقم الفاتورة',
          'الموكل',
          'القضية',
          'المبلغ',
          'المحصل',
          'المتبقي',
          'الحالة',
          'تاريخ الإصدار',
          'تاريخ الاستحقاق',
        ],
        ...completeData.periodInvoices.map((invoice) => [
          invoice.invoiceNumber || '-',
          invoice.client?.name || '-',
          invoice.case?.title || '-',
          Number(invoice.total || 0),
          Number(invoice.paidAmount || 0),
          Number(invoice.remainingAmount || 0),
          invoiceDisplayStatus(invoice, copy),
          formatDate(invoice.issueDate, locale),
          formatDate(invoice.dueDate, locale),
        ]),
      ]

      downloadCsv(`invoices-report-${year}.csv`, rows)
    })
  }

if (loading) {
  return <AppLoader fullScreen={false} />
}

  if (error) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-5 stagger text-start">
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 18px 50px rgba(15, 61, 62, 0.18)',
          }}
        >
          <h1 className="text-2xl font-black text-white">{copy.error.title}</h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
            {copy.error.subtitle}
          </p>
        </div>

        <div className="card p-6">
          <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
            {error}
          </p>

          <button onClick={load} className="btn btn-primary">
            {copy.actions.retry}
          </button>
        </div>
      </div>
    )
  }

  if (!data || !summary) return null

  return (
    <>
      <style>{`
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

      <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-5 stagger text-start">
        <SubscriptionReadOnlyBanner
          visible={exportDisabled}
          message={exportDisabledTitle}
          isRtl={isRtl}
        />

        {/* Hero */}
        <div
          className="relative overflow-hidden rounded-[28px] border p-6 print:hidden"
          style={{
            background:
              'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 18px 50px rgba(15, 61, 62, 0.18)',
          }}
        >
          <div
            className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
            style={{ background: 'rgba(184, 115, 51, 0.16)' }}
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
                {copy.hero.badge}
              </div>

              <h1 className="text-2xl font-black text-white">
                {reportTitle()}
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
                {copy.hero.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  if (!exportDisabled) window.print()
                }}
                disabled={exportDisabled}
                title={exportDisabled ? exportDisabledTitle : copy.actions.print}
                className="btn disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: '#fff',
                  color: 'var(--sidebar)',
                  borderColor: 'rgba(255,255,255,0.32)',
                }}
              >
                {copy.actions.print}
              </button>

              <button
                onClick={exportFullPdf}
                disabled={exportDisabled || exporting}
                title={exportDisabled ? exportDisabledTitle : copy.actions.fullPdf}
                className="btn disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.22)',
                }}
              >
                {exporting ? copy.actions.exporting : copy.actions.fullPdf}
              </button>

              <button
                onClick={exportFullExcel}
                disabled={exportDisabled || exporting}
                title={exportDisabled ? exportDisabledTitle : copy.actions.fullExcel}
                className="btn disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'rgba(184, 115, 51,0.18)',
                  color: '#fff',
                  borderColor: 'rgba(184, 115, 51,0.35)',
                }}
              >
                {exporting ? copy.actions.exporting : copy.actions.fullExcel}
              </button>
            </div>
          </div>
        </div>

        <div className="hidden print:block">
          <h1 className="text-3xl font-black" style={{ color: 'var(--text)' }}>
            {reportTitle()}
          </h1>

          <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
            {copy.hero.printSummary}
          </p>
        </div>

        {/* Filters */}
        <div className="card p-4 sm:p-5 print:hidden">
          <div
            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
              reportType === 'monthly' ? 'xl:grid-cols-7' : 'xl:grid-cols-6'
            }`}
          >
            <select
              aria-label={copy.filters.reportType}
              title={copy.filters.reportType}
              value={reportType}
              onChange={(event) => setReportType(event.target.value as ReportType)}
              className={controlClass}
              dir={isRtl ? 'rtl' : 'ltr'}
              style={fieldStyle}
            >
              <option value="yearly">{copy.filters.yearly}</option>
              <option value="monthly">{copy.filters.monthly}</option>
            </select>

            {reportType === 'monthly' ? (
              <select
                aria-label={copy.filters.month}
                title={copy.filters.month}
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className={controlClass}
                dir={isRtl ? 'rtl' : 'ltr'}
                style={fieldStyle}
              >
                {months.map((monthName, index) => (
                  <option key={monthName} value={index}>
                    {monthName}
                  </option>
                ))}
              </select>
            ) : null}

            <select
              aria-label={copy.filters.year}
              title={copy.filters.year}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className={controlClass}
              dir={isRtl ? 'rtl' : 'ltr'}
              style={fieldStyle}
            >
              {years.map((yearItem) => (
                <option key={yearItem} value={yearItem}>
                  {yearItem}
                </option>
              ))}
            </select>

            <select
              aria-label={copy.filters.client}
              title={copy.filters.client}
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className={controlClass}
              dir={isRtl ? 'rtl' : 'ltr'}
              style={fieldStyle}
            >
              <option value="">{copy.filters.allClients}</option>

              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            <select
              aria-label={copy.filters.caseStatus}
              title={copy.filters.caseStatus}
              value={caseStatus}
              onChange={(event) => setCaseStatus(event.target.value)}
              className={controlClass}
              dir={isRtl ? 'rtl' : 'ltr'}
              style={fieldStyle}
            >
              <option value="">{copy.filters.allCaseStatuses}</option>
              <option value="OPEN">{copy.statuses.cases.OPEN}</option>
              <option value="IN_PROGRESS">{copy.statuses.cases.IN_PROGRESS}</option>
              <option value="CLOSED">{copy.statuses.cases.CLOSED}</option>
              <option value="ARCHIVED">{copy.statuses.cases.ARCHIVED}</option>
            </select>

            <select
              aria-label={copy.filters.paymentStatus}
              title={copy.filters.paymentStatus}
              value={paymentStatusFilter}
              onChange={(event) => setPaymentStatusFilter(event.target.value)}
              className={controlClass}
              dir={isRtl ? 'rtl' : 'ltr'}
              style={fieldStyle}
            >
              <option value="">{copy.filters.allPayments}</option>
              <option value="PAID">{copy.statuses.payments.PAID}</option>
              <option value="PENDING">{copy.statuses.payments.PENDING}</option>
              <option value="OVERDUE">{copy.statuses.payments.OVERDUE}</option>
              <option value="CANCELLED">{copy.statuses.payments.CANCELLED}</option>
            </select>

            <select
              aria-label={copy.filters.invoiceStatus}
              title={copy.filters.invoiceStatus}
              value={invoiceStatusFilter}
              onChange={(event) => setInvoiceStatusFilter(event.target.value)}
              className={controlClass}
              dir={isRtl ? 'rtl' : 'ltr'}
              style={fieldStyle}
            >
              <option value="">{copy.filters.allInvoices}</option>
              <option value="DRAFT">{copy.statuses.invoices.DRAFT}</option>
              <option value="UNPAID">{copy.statuses.invoices.UNPAID}</option>
              <option value="PARTIALLY_PAID">{copy.statuses.invoices.PARTIALLY_PAID}</option>
              <option value="PAID">{copy.statuses.payments.PAID}</option>
              <option value="OVERDUE">{copy.statuses.payments.OVERDUE}</option>
              <option value="CANCELLED">{copy.statuses.invoices.CANCELLED}</option>
            </select>
          </div>

          <div
            className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <button onClick={load} className={primaryActionButtonClass}>
              {copy.actions.refresh}
            </button>

            <button
              onClick={resetFilters}
              className={actionButtonClass}
              style={actionButtonStyle}
            >
              {copy.actions.clearFilters}
            </button>

            <button
              onClick={exportPayments}
              disabled={exportDisabled || exporting}
              title={exportDisabled ? exportDisabledTitle : copy.actions.paymentsCsv}
              className={`${actionButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
              style={actionButtonStyle}
            >
              {exporting ? copy.actions.exporting : copy.actions.paymentsCsv}
            </button>

            <button
              onClick={exportInvoices}
              disabled={exportDisabled || exporting}
              title={exportDisabled ? exportDisabledTitle : copy.actions.invoicesCsv}
              className={`${actionButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
              style={actionButtonStyle}
            >
              {exporting ? copy.actions.exporting : copy.actions.invoicesCsv}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label:
                reportType === 'monthly'
                  ? copy.stats.monthlyRevenue(months[month])
                  : copy.stats.periodRevenue,
              value: formatMoney(summary.periodRevenue, locale),
              color: 'var(--sidebar)',
              bg: 'var(--green-soft)',
            },
            {
              label: copy.stats.pendingPayments,
              value: formatMoney(summary.pendingPaymentsAmount, locale),
              color:
                summary.pendingPaymentsAmount > 0 ? '#dc2626' : 'var(--text-3)',
              bg:
                summary.pendingPaymentsAmount > 0
                  ? 'var(--red-soft)'
                  : 'var(--card)',
            },
            {
              label: copy.stats.unpaidInvoices,
              value: formatMoney(summary.unpaidInvoicesAmount, locale),
              color:
                summary.unpaidInvoicesAmount > 0 ? '#92400e' : 'var(--text-3)',
              bg:
                summary.unpaidInvoicesAmount > 0
                  ? 'var(--amber-soft)'
                  : 'var(--card)',
            },
            {
              label: copy.stats.collectionRate,
              value: `${summary.collectionRate}%`,
              color:
                summary.collectionRate >= 80 ? 'var(--sidebar)' : '#92400e',
              bg:
                summary.collectionRate >= 80
                  ? 'var(--green-soft)'
                  : 'var(--amber-soft)',
            },
            {
              label: copy.stats.totalCases,
              value: summary.totalCases,
              color: 'var(--text)',
              bg: 'var(--card)',
            },
            {
              label: copy.stats.openCases,
              value: summary.openCases,
              color: 'var(--sidebar)',
              bg: 'var(--green-soft)',
            },
            {
              label: copy.stats.upcomingAppointments,
              value: summary.upcomingAppointmentsCount,
              color: '#2563eb',
              bg: 'var(--card)',
            },
            {
              label: copy.stats.overdueTasks,
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
                {copy.sections.caseStatus.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.sections.caseStatus.subtitle}
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
                      <span>{caseStatusLabel(String(status), copy)}</span>
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
                {copy.sections.monthlyRevenue.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.sections.monthlyRevenue.subtitle}
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
                      title={`${months[item.month]}: ${formatMoney(item.revenue, locale)}`}
                      className="w-full rounded-t-xl"
                      style={{
                        height: `${height}%`,
                        background: 'var(--sidebar)',
                        opacity: item.month === month ? 1 : 0.55,
                      }}
                    />

                    <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                      {months[item.month].slice(0, 3)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                {copy.sections.topClients.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.sections.topClients.subtitle}
              </p>
            </div>

            <div className="space-y-3">
              {data.topClients.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  {copy.sections.topClients.empty}
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
                        {client.casesCount} {copy.misc.cases}
                      </span>
                    </div>

                    <div
                      className="mt-2 grid grid-cols-2 gap-2 text-xs"
                      style={{ color: 'var(--text-2)' }}
                    >
                      <span>{copy.misc.payments}: {formatMoney(client.paymentsTotal, locale)}</span>
                      <span>{copy.misc.invoices}: {formatMoney(client.invoicesTotal, locale)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Financial Tables */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="card overflow-hidden p-0 text-start">
            <div
              className="border-b p-5"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                {copy.sections.periodPayments.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.sections.periodPayments.subtitle} ({data.periodPayments.length}/{data.detailCounts.payments})
              </p>
            </div>

            <div className="overflow-x-auto">
              <table dir={isRtl ? 'rtl' : 'ltr'} className="data-table [&_td]:align-middle [&_td]:text-start [&_th]:text-start">
                <thead>
                  <tr>
                    <th>{copy.table.case}</th>
                    <th>{copy.table.client}</th>
                    <th>{copy.table.amount}</th>
                    <th>{copy.table.status}</th>
                    <th>{copy.table.date}</th>
                  </tr>
                </thead>

                <tbody>
                  {data.periodPayments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center">
                        {copy.sections.periodPayments.empty}
                      </td>
                    </tr>
                  ) : (
                    data.periodPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.case?.title || '-'}</td>
                        <td>{payment.client?.name || '-'}</td>
                        <td>{formatMoney(payment.amount, locale)}</td>
                        <td>{paymentStatusLabel(payment.status, copy)}</td>
                        <td>{formatDate(payment.reportDate, locale)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden p-0 text-start">
            <div
              className="border-b p-5"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                {copy.sections.periodInvoices.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.sections.periodInvoices.subtitle} ({data.periodInvoices.length}/{data.detailCounts.invoices})
              </p>
            </div>

            <div className="overflow-x-auto">
              <table dir={isRtl ? 'rtl' : 'ltr'} className="data-table [&_td]:align-middle [&_td]:text-start [&_th]:text-start">
                <thead>
                  <tr>
                    <th>{copy.table.invoiceNumber}</th>
                    <th>{copy.table.client}</th>
                    <th>{copy.table.amount}</th>
                    <th>{copy.table.collected}</th>
                    <th>{copy.table.remaining}</th>
                    <th>{copy.table.status}</th>
                    <th>{copy.table.dueDate}</th>
                  </tr>
                </thead>

                <tbody>
                  {data.periodInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center">
                        {copy.sections.periodInvoices.empty}
                      </td>
                    </tr>
                  ) : (
                    data.periodInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.invoiceNumber}</td>
                        <td>{invoice.client?.name || '-'}</td>
                        <td>{formatMoney(invoice.total, locale)}</td>
                        <td>{formatMoney(invoice.paidAmount, locale)}</td>
                        <td>{formatMoney(invoice.remainingAmount, locale)}</td>
                        <td>{invoiceDisplayStatus(invoice, copy)}</td>
                        <td>{formatDate(invoice.dueDate, locale)}</td>
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
                {copy.sections.appointments.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.sections.appointments.subtitle}
              </p>
            </div>

            <div className="space-y-3">
              {data.upcomingAppointments.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  {copy.sections.appointments.empty}
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
                      {formatDate(appointment.startTime, locale)} —{' '}
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
                {copy.sections.tasks.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.sections.tasks.subtitle}
              </p>
            </div>

            <div className="space-y-3">
              {data.overdueTasks.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  {copy.sections.tasks.empty}
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
                      {formatDate(task.dueDate, locale)} — {task.case?.title || '-'} —{' '}
                      {taskPriorityLabel(task.priority, copy)}
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
