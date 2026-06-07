'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { translations, type Locale } from '@/lib/i18n'
import { useLocale } from '@/lib/useLocale'

interface Payment {
  amount: number
  status: string
}

interface CaseSummary {
  id: string
  caseNumber?: string
  title: string
  feeAgreed: number
  client: {
    id?: string
    name: string
    archivedAt?: string | null
  } | null
  payments: Payment[]
}

type PaymentFilter = 'all' | 'paid' | 'pending' | 'completed' | 'archived'

const FALLBACK_PAYMENTS_COPY = {
  ar: {
    hero: {
      badge: 'الإدارة المالية',
      title: 'المدفوعات',
      subtitle:
        'تابع أتعاب القضايا، المبالغ المحصلة، المستحقات ونسبة التحصيل لكل قضية من واجهة مالية واضحة تساعدك على مراقبة أداء المكتب.',
    },
    stats: {
      totalFees: 'إجمالي الأتعاب',
      collected: 'المحصّل',
      due: 'المستحق',
      collectionRate: 'نسبة التحصيل',
      completedCases: 'القضايا المكتملة ماليًا',
      pendingPayments: 'مدفوعات معلّقة',
      archivedClientCases: 'قضايا موكلين مؤرشفين',
      financialCases: 'عدد القضايا المالية',
    },
    filters: {
      searchPlaceholder: 'ابحث باسم القضية، رقم القضية أو اسم الموكل...',
      apply: 'تصفية',
      clear: 'مسح الفلاتر',
      chips: {
        all: 'الكل',
        paid: 'مدفوع جزئيًا',
        pending: 'عليه مستحقات',
        completed: 'مكتمل ماليًا',
        archived: 'موكل مؤرشف',
      },
    },
    empty: {
      title: 'لا توجد بيانات مالية',
      noCases: 'لا توجد قضايا مرتبطة بمدفوعات حتى الآن.',
      noResults: 'لا توجد نتائج مطابقة للفلاتر الحالية.',
    },
    table: {
      title: 'تفصيل الأتعاب حسب القضية',
      subtitle: 'يعرض الأتعاب، المحصل، المتبقي ونسبة التحصيل لكل قضية',
      count: (count: number) => `${count} قضية`,
      case: 'القضية',
      client: 'الموكل',
      fees: 'الأتعاب',
      collected: 'المحصّل',
      due: 'المستحق',
      collectionRate: 'نسبة التحصيل',
      financialStatus: 'الحالة المالية',
    },
    labels: {
      archivedClient: 'موكل مؤرشف',
      archivedRecord: 'سجل مؤرشف',
      completed: 'مكتمل',
      due: 'مستحق',
      noPayments: 'بدون دفعات',
      unknownClient: '-',
      currency: 'د.أ',
    },
  },
  en: {
    hero: {
      badge: 'Financial management',
      title: 'Payments',
      subtitle:
        'Track case fees, collected amounts, outstanding balances, and collection rates through a clear financial view that helps monitor office performance.',
    },
    stats: {
      totalFees: 'Total fees',
      collected: 'Collected',
      due: 'Outstanding',
      collectionRate: 'Collection rate',
      completedCases: 'Financially completed cases',
      pendingPayments: 'Pending payments',
      archivedClientCases: 'Archived-client cases',
      financialCases: 'Financial cases',
    },
    filters: {
      searchPlaceholder: 'Search by case title, case number, or client name...',
      apply: 'Filter',
      clear: 'Clear filters',
      chips: {
        all: 'All',
        paid: 'Partially paid',
        pending: 'Has outstanding balance',
        completed: 'Financially complete',
        archived: 'Archived client',
      },
    },
    empty: {
      title: 'No financial data',
      noCases: 'There are no cases linked to payments yet.',
      noResults: 'No results match the current filters.',
    },
    table: {
      title: 'Fee breakdown by case',
      subtitle: 'Shows fees, collected amount, remaining balance, and collection rate for each case',
      count: (count: number) => `${count} ${count === 1 ? 'case' : 'cases'}`,
      case: 'Case',
      client: 'Client',
      fees: 'Fees',
      collected: 'Collected',
      due: 'Outstanding',
      collectionRate: 'Collection rate',
      financialStatus: 'Financial status',
    },
    labels: {
      archivedClient: 'Archived client',
      archivedRecord: 'Archived record',
      completed: 'Complete',
      due: 'Due',
      noPayments: 'No payments',
      unknownClient: '-',
      currency: 'JOD',
    },
  },
} as const

function getPaidAmount(item: CaseSummary) {
  return item.payments
    .filter((payment) => payment.status === 'PAID')
    .reduce((sum, payment) => sum + payment.amount, 0)
}

function getPendingAmount(item: CaseSummary) {
  return item.payments
    .filter((payment) => payment.status === 'PENDING')
    .reduce((sum, payment) => sum + payment.amount, 0)
}

function getRemainingAmount(item: CaseSummary) {
  return Math.max(0, item.feeAgreed - getPaidAmount(item))
}

function getCollectionPercent(item: CaseSummary) {
  if (item.feeAgreed <= 0) return 0

  return Math.min((getPaidAmount(item) / item.feeAgreed) * 100, 100)
}

function isArchivedCase(item: CaseSummary) {
  return Boolean(item.client?.archivedAt)
}

function money(value: number | null | undefined, locale: Locale) {
  const amount = Number(value ?? 0)
  const currency = locale === 'ar' ? 'د.أ' : 'JOD'

  if (!Number.isFinite(amount) || amount === 0) {
    return locale === 'ar' ? `0 ${currency}` : `${currency} 0`
  }

  const formatted = amount.toLocaleString(locale === 'ar' ? 'ar-JO' : 'en-JO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  return locale === 'ar' ? `${formatted} ${currency}` : `${currency} ${formatted}`
}

export default function PaymentsPage() {
  const router = useRouter()
  const localeState = useLocale() as { locale?: Locale; t?: typeof translations.ar }
  const locale: Locale = localeState?.locale === 'en' ? 'en' : 'ar'
  const isRtl = locale === 'ar'
  const i18nPayments = localeState?.t?.payments ?? translations[locale]?.payments
  const copy = i18nPayments ?? FALLBACK_PAYMENTS_COPY[locale]

  const [cases, setCases] = useState<CaseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PaymentFilter>('all')

  const fieldStyle = {
    textAlign: isRtl ? 'right' : 'left',
    direction: isRtl ? 'rtl' : 'ltr',
  } as const

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/cases?limit=100&includeArchivedClients=true')
      const data = await response.json().catch(() => ({}))

      setCases(
        Array.isArray(data.data?.data)
          ? data.data.data
          : Array.isArray(data.data)
            ? data.data
            : []
      )
    } catch {
      setCases([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalFees = cases.reduce((sum, item) => sum + (item.feeAgreed || 0), 0)
  const totalPaid = cases.reduce((sum, item) => sum + getPaidAmount(item), 0)
  const totalPending = cases.reduce((sum, item) => sum + getPendingAmount(item), 0)
  const totalRemaining = cases.reduce((sum, item) => sum + getRemainingAmount(item), 0)

  const completedCases = cases.filter(
    (item) => item.feeAgreed > 0 && getPaidAmount(item) >= item.feeAgreed
  ).length

  const archivedCases = cases.filter(isArchivedCase).length

  const collectionRate =
    totalFees > 0 ? Math.min((totalPaid / totalFees) * 100, 100) : 0

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase()

    return cases.filter((item) => {
      const paid = getPaidAmount(item)
      const remaining = getRemainingAmount(item)
      const archived = isArchivedCase(item)

      const matchesSearch =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.caseNumber?.toLowerCase().includes(query) ||
        item.client?.name?.toLowerCase().includes(query)

      const matchesFilter =
        filter === 'all' ||
        (filter === 'paid' && paid > 0) ||
        (filter === 'pending' && remaining > 0) ||
        (filter === 'completed' && item.feeAgreed > 0 && paid >= item.feeAgreed) ||
        (filter === 'archived' && archived)

      return matchesSearch && matchesFilter
    })
  }, [cases, search, filter])

  function clearFilters() {
    setSearch('')
    setFilter('all')
  }

  if (loading) return <PageLoader />

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-5 stagger">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6 text-start"
        style={{
          background:
            'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)',
          borderColor: 'rgba(255,255,255,0.12)',
          boxShadow: '0 18px 50px rgba(45, 74, 62, 0.18)',
        }}
      >
        <div
          className={`absolute -top-14 h-40 w-40 rounded-full ${
            isRtl ? '-right-14' : '-left-14'
          }`}
          style={{ background: 'rgba(245, 200, 66, 0.16)' }}
        />

        <div
          className={`absolute -bottom-20 h-52 w-52 rounded-full ${
            isRtl ? 'left-16' : 'right-16'
          }`}
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />

        <div className="relative z-10">
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
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: copy.stats.totalFees,
            value: money(totalFees, locale),
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: copy.stats.collected,
            value: money(totalPaid, locale),
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: copy.stats.due,
            value: money(totalRemaining, locale),
            color: totalRemaining > 0 ? '#dc2626' : 'var(--text-3)',
            bg: totalRemaining > 0 ? 'var(--red-soft)' : 'var(--card)',
          },
          {
            label: copy.stats.collectionRate,
            value: `${Math.round(collectionRate)}%`,
            color: collectionRate >= 80 ? 'var(--sidebar)' : '#92400e',
            bg: collectionRate >= 80 ? 'var(--green-soft)' : 'var(--amber-soft)',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5 text-start"
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

      {/* Financial Snapshot */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-5 text-start">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            {copy.stats.completedCases}
          </p>

          <p className="mt-2 text-3xl font-black" style={{ color: 'var(--sidebar)' }}>
            {completedCases}
          </p>
        </div>

        <div className="card p-5 text-start">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            {copy.stats.pendingPayments}
          </p>

          <p
            className="mt-2 text-3xl font-black"
            style={{ color: totalPending > 0 ? '#92400e' : 'var(--text)' }}
          >
            {money(totalPending, locale)}
          </p>
        </div>

        <div className="card p-5 text-start">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            {copy.stats.archivedClientCases}
          </p>

          <p
            className="mt-2 text-3xl font-black"
            style={{ color: archivedCases > 0 ? '#b45309' : 'var(--text)' }}
          >
            {archivedCases}
          </p>
        </div>

        <div className="card p-5 text-start">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            {copy.stats.financialCases}
          </p>

          <p className="mt-2 text-3xl font-black" style={{ color: 'var(--text)' }}>
            {cases.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.filters.searchPlaceholder}
            className="input"
            dir={isRtl ? 'rtl' : 'ltr'}
            style={fieldStyle}
          />

          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-ghost whitespace-nowrap"
          >
            {copy.filters.apply}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['all', copy.filters.chips.all],
              ['paid', copy.filters.chips.paid],
              ['pending', copy.filters.chips.pending],
              ['completed', copy.filters.chips.completed],
              ['archived', copy.filters.chips.archived],
            ] as [PaymentFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={
                filter === key
                  ? {
                      background: key === 'archived' ? '#b45309' : 'var(--sidebar)',
                      color: '#fff',
                    }
                  : {
                      background:
                        key === 'archived'
                          ? 'rgba(180, 83, 9, 0.12)'
                          : 'var(--green-soft)',
                      color: key === 'archived' ? '#f59e0b' : 'var(--text-2)',
                      border:
                        key === 'archived'
                          ? '1px solid rgba(180, 83, 9, 0.22)'
                          : undefined,
                    }
              }
            >
              {label}
            </button>
          ))}

          {(search || filter !== 'all') && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={{
                background: 'var(--card)',
                color: 'var(--text-2)',
                border: '1px solid var(--border)',
              }}
            >
              {copy.filters.clear}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {filteredCases.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="💰"
            title={copy.empty.title}
            sub={cases.length === 0 ? copy.empty.noCases : copy.empty.noResults}
            action={
              cases.length > 0 ? (
                <button type="button" onClick={clearFilters} className="btn btn-ghost">
                  {copy.filters.clear}
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div
            className="flex items-center justify-between gap-4 border-b px-5 py-4 text-start"
            style={{ borderColor: 'var(--border)' }}
          >
            <div>
              <p className="font-black text-sm" style={{ color: 'var(--text)' }}>
                {copy.table.title}
              </p>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.table.subtitle}
              </p>
            </div>

            <span
              className="rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'var(--green-soft)',
                color: 'var(--sidebar)',
              }}
            >
              {copy.table.count(filteredCases.length)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{copy.table.case}</th>
                  <th>{copy.table.client}</th>
                  <th>{copy.table.fees}</th>
                  <th>{copy.table.collected}</th>
                  <th>{copy.table.due}</th>
                  <th>{copy.table.collectionRate}</th>
                  <th>{copy.table.financialStatus}</th>
                </tr>
              </thead>

              <tbody>
                {filteredCases.map((item) => {
                  const paidAmount = getPaidAmount(item)
                  const pendingAmount = getPendingAmount(item)
                  const remainingAmount = getRemainingAmount(item)
                  const percent = getCollectionPercent(item)
                  const completed = item.feeAgreed > 0 && paidAmount >= item.feeAgreed
                  const archived = isArchivedCase(item)

                  return (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/dashboard/cases/${item.id}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div>
                          <p className="font-mono text-xs font-bold">
                            #{item.caseNumber?.split('/').pop() ?? item.id.slice(-4)}
                          </p>

                          <p
                            className="max-w-[180px] truncate text-xs"
                            style={{ color: 'var(--text-3)' }}
                          >
                            {item.title}
                          </p>
                        </div>
                      </td>

                      <td>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold">
                            {item.client?.name ?? copy.labels.unknownClient}
                          </span>

                          {archived && (
                            <span
                              className="inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-black"
                              style={{
                                background: 'rgba(180, 83, 9, 0.12)',
                                color: '#f59e0b',
                                border: '1px solid rgba(180, 83, 9, 0.22)',
                              }}
                            >
                              {copy.labels.archivedClient}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>{money(item.feeAgreed, locale)}</td>

                      <td className="font-bold" style={{ color: 'var(--sidebar)' }}>
                        {money(paidAmount, locale)}
                      </td>

                      <td
                        className="font-bold"
                        style={{
                          color: remainingAmount > 0 ? '#dc2626' : 'var(--text)',
                        }}
                      >
                        {money(remainingAmount, locale)}
                      </td>

                      <td>
                        <div className="flex min-w-[120px] items-center gap-2">
                          <div
                            className="h-2 flex-1 overflow-hidden rounded-full"
                            style={{ background: 'var(--input-bg)' }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${percent}%`,
                                background:
                                  percent >= 100
                                    ? 'var(--sidebar)'
                                    : percent >= 60
                                      ? '#f59e0b'
                                      : '#dc2626',
                              }}
                            />
                          </div>

                          <span
                            className="w-9 text-xs font-bold"
                            style={{ color: 'var(--text-2)' }}
                          >
                            {Math.round(percent)}%
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className="rounded-full px-3 py-1 text-xs font-black"
                            style={
                              completed
                                ? {
                                    background: 'var(--green-soft)',
                                    color: 'var(--sidebar)',
                                  }
                                : pendingAmount > 0 || remainingAmount > 0
                                  ? {
                                      background: 'var(--red-soft)',
                                      color: '#dc2626',
                                    }
                                  : {
                                      background: 'var(--card)',
                                      color: 'var(--text-3)',
                                      border: '1px solid var(--border)',
                                    }
                            }
                          >
                            {completed
                              ? copy.labels.completed
                              : pendingAmount > 0 || remainingAmount > 0
                                ? copy.labels.due
                                : copy.labels.noPayments}
                          </span>

                          {archived && (
                            <span
                              className="rounded-full px-3 py-1 text-xs font-black"
                              style={{
                                background: 'rgba(180, 83, 9, 0.12)',
                                color: '#f59e0b',
                                border: '1px solid rgba(180, 83, 9, 0.22)',
                              }}
                            >
                              {copy.labels.archivedRecord}
                            </span>
                          )}
                        </div>
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
