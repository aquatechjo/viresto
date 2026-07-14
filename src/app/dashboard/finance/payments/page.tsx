'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import SubscriptionReadOnlyBanner from '@/components/billing/SubscriptionReadOnlyBanner'
import EmptyState from '@/components/ui/EmptyState'
import AppLoader from '@/components/ui/AppLoader'
import { useTenantWriteAccess } from '@/hooks/useTenantWriteAccess'
import type { Locale } from '@/lib/i18n'
import { formatInvoiceNumber } from '@/lib/invoice-print'
import { useLocale } from '@/lib/useLocale'

type PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'

interface Payment {
  id: string
  amount: number | string
  status: PaymentStatus
  method?: string | null
  paidAt?: string | null
  createdAt?: string | null
  reference?: string | null
  notes?: string | null
  client?: {
    id: string
    name: string
    archivedAt?: string | null
  } | null
  case?: {
    id: string
    title: string
    caseNumber?: string | null
  } | null
  invoice?: {
    id: string
    invoiceNumber: string
    status: string
    total: number | string
    dueDate?: string | null
  } | null
}

const COPY = {
  ar: {
    hero: {
      badge: 'الإدارة المالية',
      title: 'سجل الدفعات',
      subtitle:
        'تابع جميع الدفعات المسجلة على الفواتير والقضايا، وحالات التحصيل والروابط المالية من سجل واحد واضح.',
    },
    actions: {
      refresh: 'تحديث البيانات',
      clear: 'مسح الفلاتر',
      viewInvoice: 'عرض الفاتورة',
      viewCase: 'عرض القضية',
      retry: 'إعادة المحاولة',
      updating: 'جارٍ حفظ الحالة...',
      statusUpdated: 'تم تحديث حالة الدفعة والفاتورة المرتبطة',
      statusUpdateError: 'تعذر تحديث حالة الدفعة',
      saveStatus: 'حفظ',
      cancelStatus: 'تراجع',
      confirmStatusChange:
        'سيؤدي تغيير حالة هذه الدفعة إلى إعادة احتساب حالة الفاتورة المرتبطة. هل تريد المتابعة؟',
    },
    stats: {
      collected: 'إجمالي المحصل',
      pending: 'دفعات معلقة',
      overdue: 'دفعات متأخرة',
      direct: 'دفعات على القضايا مباشرة',
    },
    filters: {
      search: 'ابحث بالموكل، القضية، الفاتورة أو رقم المرجع...',
      status: 'حالة الدفعة',
      all: 'جميع الحالات',
    },
    table: {
      title: 'جميع الدفعات',
      subtitle: 'السجل الفعلي للدفعات المرتبطة بالفواتير والقضايا',
      count: (count: number) => `${count} دفعة`,
      reference: 'المرجع',
      client: 'الموكل',
      link: 'الارتباط المالي',
      amount: 'المبلغ',
      method: 'طريقة الدفع',
      status: 'الحالة',
      date: 'التاريخ',
      action: 'الإجراء',
    },
    statuses: {
      PENDING: 'معلقة',
      PAID: 'مدفوعة',
      OVERDUE: 'متأخرة',
      CANCELLED: 'ملغاة',
    } as Record<PaymentStatus, string>,
    labels: {
      invoice: 'فاتورة',
      directCase: 'على القضية مباشرة',
      noReference: 'بدون مرجع',
      noCase: 'بدون قضية',
      archived: 'موكل مؤرشف',
      empty: 'لا توجد دفعات',
      emptySubtitle: 'لم يتم تسجيل أي دفعات مطابقة للفلاتر الحالية.',
      loadError: 'تعذر تحميل سجل الدفعات في الوقت الحالي.',
    },
  },
  en: {
    hero: {
      badge: 'Financial management',
      title: 'Payment ledger',
      subtitle:
        'Track payments recorded against invoices and cases, collection statuses, and financial links from one clear ledger.',
    },
    actions: {
      refresh: 'Refresh data',
      clear: 'Clear filters',
      viewInvoice: 'View invoice',
      viewCase: 'View case',
      retry: 'Retry',
      updating: 'Saving status...',
      statusUpdated: 'Payment and linked invoice statuses were updated',
      statusUpdateError: 'Unable to update the payment status',
      saveStatus: 'Save',
      cancelStatus: 'Cancel',
      confirmStatusChange:
        'Changing this payment status will recalculate the linked invoice status. Continue?',
    },
    stats: {
      collected: 'Total collected',
      pending: 'Pending payments',
      overdue: 'Overdue payments',
      direct: 'Direct case payments',
    },
    filters: {
      search: 'Search by client, case, invoice, or reference...',
      status: 'Payment status',
      all: 'All statuses',
    },
    table: {
      title: 'All payments',
      subtitle: 'The actual ledger of payments linked to invoices and cases',
      count: (count: number) => `${count} payment${count === 1 ? '' : 's'}`,
      reference: 'Reference',
      client: 'Client',
      link: 'Financial link',
      amount: 'Amount',
      method: 'Method',
      status: 'Status',
      date: 'Date',
      action: 'Action',
    },
    statuses: {
      PENDING: 'Pending',
      PAID: 'Paid',
      OVERDUE: 'Overdue',
      CANCELLED: 'Cancelled',
    } as Record<PaymentStatus, string>,
    labels: {
      invoice: 'Invoice',
      directCase: 'Directly on case',
      noReference: 'No reference',
      noCase: 'No case',
      archived: 'Archived client',
      empty: 'No payments',
      emptySubtitle: 'No payments match the current filters.',
      loadError: 'Unable to load the payment ledger right now.',
    },
  },
} as const

function unwrapPayments(payload: unknown): Payment[] {
  const data = payload as {
    data?: unknown
    payments?: unknown
  }

  const nested = data?.data as {
    data?: unknown
    payments?: unknown
  } | null

  const candidates = [
    payload,
    data?.data,
    data?.payments,
    nested?.data,
    nested?.payments,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Payment[]
  }

  return []
}

function unwrapPayment(payload: unknown): Payment | null {
  const root = payload as {
    id?: unknown
    data?: unknown
    payment?: unknown
  }
  const nested = root?.data as {
    id?: unknown
    payment?: unknown
  } | null

  const candidates = [nested?.payment, root?.payment, root?.data, payload]

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof (candidate as { id?: unknown }).id === 'string'
    ) {
      return candidate as Payment
    }
  }

  return null
}

function amountOf(payment: Payment) {
  const amount = Number(payment.amount || 0)
  return Number.isFinite(amount) ? amount : 0
}

function money(value: number, locale: Locale) {
  const formatted = Number(value || 0).toLocaleString(
    locale === 'ar' ? 'ar-JO' : 'en-JO',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  )

  return locale === 'ar' ? `${formatted} د.أ` : `JOD ${formatted}`
}

function formatPaymentDate(value: string | null | undefined, locale: Locale) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-JO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function methodLabel(method: string | null | undefined, locale: Locale) {
  if (!method) return '-'

  const labels: Record<string, { ar: string; en: string }> = {
    CASH: { ar: 'نقدي', en: 'Cash' },
    BANK_TRANSFER: { ar: 'تحويل بنكي', en: 'Bank transfer' },
    CARD: { ar: 'بطاقة', en: 'Card' },
    CHEQUE: { ar: 'شيك', en: 'Cheque' },
    CHECK: { ar: 'شيك', en: 'Cheque' },
    OTHER: { ar: 'أخرى', en: 'Other' },
  }

  return labels[method]?.[locale] || method
}

function statusStyle(status: PaymentStatus) {
  if (status === 'PAID') {
    return {
      background: 'var(--green-soft)',
      color: 'var(--sidebar)',
      border: '1px solid rgba(53, 138, 136, 0.24)',
    }
  }

  if (status === 'PENDING') {
    return {
      background: 'var(--amber-soft)',
      color: '#92400e',
      border: '1px solid rgba(245, 158, 11, 0.24)',
    }
  }

  if (status === 'OVERDUE') {
    return {
      background: 'var(--red-soft)',
      color: '#dc2626',
      border: '1px solid rgba(220, 38, 38, 0.24)',
    }
  }

  return {
    background: 'var(--card)',
    color: 'var(--text-3)',
    border: '1px solid var(--border)',
  }
}

export default function PaymentsPage() {
  const router = useRouter()
  const localeState = useLocale() as { locale?: Locale }
  const locale: Locale = localeState.locale === 'en' ? 'en' : 'ar'
  const isRtl = locale === 'ar'
  const copy = COPY[locale]
  const writeAccess = useTenantWriteAccess(locale)

  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | PaymentStatus>('')
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null)
  const [draftStatuses, setDraftStatuses] = useState<
    Record<string, PaymentStatus>
  >({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({ limit: '100' })
      if (status) params.set('status', status)

      const response = await fetch(`/api/payments?${params.toString()}`, {
        cache: 'no-store',
      })

      if (response.status === 401) {
        window.location.href = '/login'
        return
      }

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setPayments([])
        setError(
          (payload as { message?: string; error?: string })?.message ||
            (payload as { message?: string; error?: string })?.error ||
            copy.labels.loadError,
        )
        return
      }

      setPayments(unwrapPayments(payload))
    } catch {
      setPayments([])
      setError(copy.labels.loadError)
    } finally {
      setLoading(false)
    }
  }, [status, copy.labels.loadError])

  useEffect(() => {
    load()
  }, [load])

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return payments

    return payments.filter((payment) => {
      const values = [
        payment.reference,
        payment.client?.name,
        payment.case?.title,
        payment.case?.caseNumber,
        payment.invoice?.invoiceNumber,
        payment.method,
      ]

      return values.some((value) => value?.toLowerCase().includes(query))
    })
  }, [payments, search])

  const stats = useMemo(() => {
    return payments.reduce(
      (result, payment) => {
        const amount = amountOf(payment)

        if (payment.status === 'PAID') result.collected += amount
        if (payment.status === 'PENDING') result.pending += amount
        if (payment.status === 'OVERDUE') result.overdue += amount
        if (!payment.invoice) result.direct += 1

        return result
      },
      { collected: 0, pending: 0, overdue: 0, direct: 0 },
    )
  }, [payments])

  function clearFilters() {
    setSearch('')
    setStatus('')
  }

  function openRelated(payment: Payment) {
    if (payment.invoice?.id) {
      router.push(`/dashboard/finance/invoices/${payment.invoice.id}`)
      return
    }

    if (payment.case?.id) {
      router.push(`/dashboard/cases/${payment.case.id}`)
    }
  }

  async function updatePaymentStatus(
    payment: Payment,
    nextStatus: PaymentStatus,
  ) {
    if (nextStatus === payment.status || updatingPaymentId) return

    if (payment.invoice && !window.confirm(copy.actions.confirmStatusChange)) {
      return
    }

    setUpdatingPaymentId(payment.id)

    try {
      const response = await fetch(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (response.status === 401) {
        window.location.href = '/login'
        return
      }

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(
          (payload as { message?: string; error?: string })?.message ||
            (payload as { message?: string; error?: string })?.error ||
            copy.actions.statusUpdateError,
        )
        return
      }

      const updated = unwrapPayment(payload)

      setPayments((current) => {
        if (status && nextStatus !== status) {
          return current.filter((item) => item.id !== payment.id)
        }

        return current.map((item) =>
          item.id === payment.id
            ? updated || {
                ...item,
                status: nextStatus,
                paidAt:
                  nextStatus === 'PAID'
                    ? item.paidAt || new Date().toISOString()
                    : null,
              }
            : item,
        )
      })

      setDraftStatuses((current) => {
        const next = { ...current }
        delete next[payment.id]
        return next
      })

      toast.success(copy.actions.statusUpdated)
    } catch {
      toast.error(copy.actions.statusUpdateError)
    } finally {
      setUpdatingPaymentId(null)
    }
  }

  if (loading) return <AppLoader fullScreen={false} />

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-5 stagger">
      <SubscriptionReadOnlyBanner
        visible={!writeAccess.canWrite}
        message={writeAccess.message}
        isRtl={isRtl}
      />

      <div
        className="relative overflow-hidden rounded-[28px] border p-6 text-start"
        style={{
          background:
            'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)',
          borderColor: 'rgba(255,255,255,0.12)',
          boxShadow: '0 18px 50px rgba(15, 61, 62, 0.18)',
        }}
      >
        <div
          className={`absolute -top-14 h-40 w-40 rounded-full ${
            isRtl ? '-right-14' : '-left-14'
          }`}
          style={{ background: 'rgba(184, 115, 51, 0.16)' }}
        />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
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

            <h1 className="text-2xl font-black text-white">{copy.hero.title}</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {copy.hero.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className="btn min-h-[46px] shrink-0 px-6"
            style={{
              background: '#fff',
              color: 'var(--sidebar)',
              borderColor: 'rgba(255,255,255,0.35)',
            }}
          >
            {copy.actions.refresh}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: copy.stats.collected,
            value: money(stats.collected, locale),
            color: 'var(--sidebar)',
            background: 'var(--green-soft)',
          },
          {
            label: copy.stats.pending,
            value: money(stats.pending, locale),
            color: '#92400e',
            background: 'var(--amber-soft)',
          },
          {
            label: copy.stats.overdue,
            value: money(stats.overdue, locale),
            color: '#dc2626',
            background: 'var(--red-soft)',
          },
          {
            label: copy.stats.direct,
            value: stats.direct,
            color: 'var(--text)',
            background: 'var(--card)',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5 text-start"
            style={{ background: item.background }}
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

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,300px)_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.filters.search}
            className="input min-h-[48px] w-full text-start"
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
              direction: isRtl ? 'rtl' : 'ltr',
              textAlign: isRtl ? 'right' : 'left',
            }}
          />

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as '' | PaymentStatus)
            }
            className="input min-h-[48px] w-full text-start"
            aria-label={copy.filters.status}
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
              direction: isRtl ? 'rtl' : 'ltr',
              textAlign: isRtl ? 'right' : 'left',
              backgroundPosition: isRtl
                ? 'left 16px center'
                : 'right 16px center',
              paddingInlineStart: '16px',
              paddingInlineEnd: '44px',
            }}
          >
            <option value="">{copy.filters.all}</option>
            <option value="PAID">{copy.statuses.PAID}</option>
            <option value="PENDING">{copy.statuses.PENDING}</option>
            <option value="OVERDUE">{copy.statuses.OVERDUE}</option>
            <option value="CANCELLED">{copy.statuses.CANCELLED}</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-ghost min-h-[48px] whitespace-nowrap px-5"
            style={{ color: 'var(--text)' }}
          >
            {copy.actions.clear}
          </button>
        </div>
      </div>

      {error ? (
        <div className="card p-6 text-start">
          <p className="font-bold" style={{ color: '#dc2626' }}>
            {error}
          </p>
          <button type="button" onClick={load} className="btn btn-primary mt-4">
            {copy.actions.retry}
          </button>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="💳"
            title={copy.labels.empty}
            sub={copy.labels.emptySubtitle}
            action={
              search || status ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn btn-ghost"
                  style={{ color: 'var(--text)' }}
                >
                  {copy.actions.clear}
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div
            className="flex flex-col gap-2 border-b px-5 py-4 text-start md:flex-row md:items-center md:justify-between"
            style={{ borderColor: 'var(--border)' }}
          >
            <div>
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                {copy.table.title}
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.table.subtitle}
              </p>
            </div>

            <span
              className="rounded-full px-3 py-1 text-xs font-black"
              style={{ background: 'var(--green-soft)', color: 'var(--sidebar)' }}
            >
              {copy.table.count(filteredPayments.length)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table min-w-[1120px] table-fixed text-start">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[25%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-start">{copy.table.reference}</th>
                  <th className="text-start">{copy.table.client}</th>
                  <th className="text-start">{copy.table.link}</th>
                  <th className="text-start">{copy.table.amount}</th>
                  <th className="text-start">{copy.table.date}</th>
                  <th className="text-start">{copy.table.status}</th>
                  <th className="text-start">{copy.table.action}</th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map((payment) => {
                  const canOpen = Boolean(payment.invoice?.id || payment.case?.id)
                  const isUpdating = updatingPaymentId === payment.id
                  const draftStatus = draftStatuses[payment.id] ?? payment.status
                  const statusChanged = draftStatus !== payment.status

                  return (
                    <tr
                      key={payment.id}
                      onClick={() => canOpen && openRelated(payment)}
                      className={`h-[88px] ${canOpen ? 'cursor-pointer' : ''}`}
                    >
                      <td className="align-middle text-start">
                        {payment.reference ? (
                          <bdi dir="ltr" className="font-mono text-xs font-black">
                            {payment.reference}
                          </bdi>
                        ) : (
                          <span className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                            {copy.labels.noReference}
                          </span>
                        )}
                      </td>

                      <td className="align-middle text-start">
                        <p className="font-bold" style={{ color: 'var(--text)' }}>
                          {payment.client?.name || '-'}
                        </p>
                        {payment.client?.archivedAt ? (
                          <span
                            className="mt-1 inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-black"
                            style={{
                              background: '#fff7ed',
                              color: '#b45309',
                              border: '1px solid rgba(180, 83, 9, 0.18)',
                            }}
                          >
                            {copy.labels.archived}
                          </span>
                        ) : null}
                      </td>

                      <td className="align-middle text-start">
                        {payment.invoice ? (
                          <div className="min-w-0 text-start">
                            <p className="truncate font-black" style={{ color: 'var(--text)' }}>
                              <span>{copy.labels.invoice}</span>{' '}
                              <bdi dir="ltr">
                                {formatInvoiceNumber(payment.invoice.invoiceNumber)}
                              </bdi>
                            </p>
                            <p
                              dir="auto"
                              className="mt-1 truncate text-start text-xs"
                              style={{ color: 'var(--text-3)' }}
                            >
                              {payment.case?.title || copy.labels.noCase}
                            </p>
                          </div>
                        ) : (
                          <div className="min-w-0 text-start">
                            <p className="truncate font-black" style={{ color: '#92400e' }}>
                              {copy.labels.directCase}
                            </p>
                            <p
                              dir="auto"
                              className="mt-1 truncate text-start text-xs"
                              style={{ color: 'var(--text-3)' }}
                            >
                              {payment.case?.title || copy.labels.noCase}
                            </p>
                          </div>
                        )}
                      </td>

                      <td className="align-middle text-start">
                        <p className="whitespace-nowrap text-base font-black" style={{ color: 'var(--sidebar)' }}>
                          {money(amountOf(payment), locale)}
                        </p>
                        <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                          {methodLabel(payment.method, locale)}
                        </p>
                      </td>

                      <td className="whitespace-nowrap align-middle text-start">
                        {formatPaymentDate(
                          payment.paidAt || payment.createdAt,
                          locale,
                        )}
                      </td>

                      <td
                        className="align-middle text-start"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <select
                          aria-label={`${copy.table.status}: ${payment.client?.name || ''}`}
                          value={draftStatus}
                          onChange={(event) => {
                            const nextStatus = event.target.value as PaymentStatus

                            setDraftStatuses((current) => ({
                              ...current,
                              [payment.id]: nextStatus,
                            }))
                          }}
                          disabled={!writeAccess.canWrite || isUpdating}
                          dir={isRtl ? 'rtl' : 'ltr'}
                          className="h-10 w-full max-w-[150px] rounded-xl text-start text-xs font-black outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                          style={{
                            ...statusStyle(draftStatus),
                            direction: isRtl ? 'rtl' : 'ltr',
                            textAlign: isRtl ? 'right' : 'left',
                            backgroundPosition: isRtl
                              ? 'left 12px center'
                              : 'right 12px center',
                            paddingInlineStart: '12px',
                            paddingInlineEnd: '34px',
                          }}
                        >
                          <option value="PENDING">{copy.statuses.PENDING}</option>
                          <option value="PAID">{copy.statuses.PAID}</option>
                          <option value="OVERDUE">{copy.statuses.OVERDUE}</option>
                          <option value="CANCELLED">{copy.statuses.CANCELLED}</option>
                        </select>
                        {isUpdating ? (
                          <p className="mt-1 text-[10px]" style={{ color: 'var(--text-3)' }}>
                            {copy.actions.updating}
                          </p>
                        ) : statusChanged ? (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updatePaymentStatus(payment, draftStatus)}
                              className="h-7 rounded-lg bg-[#b87333] px-2.5 text-[10px] font-black text-[#041819] transition hover:bg-[#cc8e55]"
                            >
                              {copy.actions.saveStatus}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftStatuses((current) => {
                                  const next = { ...current }
                                  delete next[payment.id]
                                  return next
                                })
                              }
                              className="h-7 rounded-lg border px-2.5 text-[10px] font-black"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
                            >
                              {copy.actions.cancelStatus}
                            </button>
                          </div>
                        ) : null}
                      </td>

                      <td
                        className="align-middle text-start"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {canOpen ? (
                          <button
                            type="button"
                            onClick={() => openRelated(payment)}
                            className="btn btn-ghost h-10 w-full whitespace-nowrap px-3 text-xs"
                            style={{ color: 'var(--text)' }}
                          >
                            {payment.invoice
                              ? copy.actions.viewInvoice
                              : copy.actions.viewCase}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}