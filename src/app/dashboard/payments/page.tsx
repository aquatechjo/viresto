'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
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
    name: string
  }
  payments: Payment[]
}

type PaymentFilter = 'all' | 'paid' | 'pending' | 'completed'

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

export default function PaymentsPage() {
  const router = useRouter()

  const [cases, setCases] = useState<CaseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PaymentFilter>('all')

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/cases?limit=100')
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

  const totalPaid = cases.reduce(
    (sum, item) => sum + getPaidAmount(item),
    0
  )

  const totalPending = cases.reduce(
    (sum, item) => sum + getPendingAmount(item),
    0
  )

  const totalRemaining = cases.reduce(
    (sum, item) => sum + getRemainingAmount(item),
    0
  )

  const completedCases = cases.filter(
    (item) => item.feeAgreed > 0 && getPaidAmount(item) >= item.feeAgreed
  ).length

  const collectionRate =
    totalFees > 0 ? Math.min((totalPaid / totalFees) * 100, 100) : 0

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase()

    return cases.filter((item) => {
      const paid = getPaidAmount(item)
      const remaining = getRemainingAmount(item)

      const matchesSearch =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.caseNumber?.toLowerCase().includes(query) ||
        item.client?.name?.toLowerCase().includes(query)

      const matchesFilter =
        filter === 'all' ||
        (filter === 'paid' && paid > 0) ||
        (filter === 'pending' && remaining > 0) ||
        (filter === 'completed' && item.feeAgreed > 0 && paid >= item.feeAgreed)

      return matchesSearch && matchesFilter
    })
  }, [cases, search, filter])

  function clearFilters() {
    setSearch('')
    setFilter('all')
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 stagger">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6"
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

        <div className="relative z-10">
          <div
            className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
            style={{
              background: 'rgba(255,255,255,0.14)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            الإدارة المالية
          </div>

          <h1 className="text-2xl font-black text-white">المدفوعات</h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
            تابع أتعاب القضايا، المبالغ المحصلة، المستحقات ونسبة التحصيل لكل قضية
            من واجهة مالية واضحة تساعدك على مراقبة أداء المكتب.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'إجمالي الأتعاب',
            value: formatCurrency(totalFees),
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: 'المحصّل',
            value: formatCurrency(totalPaid),
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: 'المستحق',
            value: formatCurrency(totalRemaining),
            color: totalRemaining > 0 ? '#dc2626' : 'var(--text-3)',
            bg: totalRemaining > 0 ? 'var(--red-soft)' : 'var(--card)',
          },
          {
            label: 'نسبة التحصيل',
            value: `${Math.round(collectionRate)}%`,
            color: collectionRate >= 80 ? 'var(--sidebar)' : '#92400e',
            bg: collectionRate >= 80 ? 'var(--green-soft)' : 'var(--amber-soft)',
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

      {/* Financial Snapshot */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            القضايا المكتملة ماليًا
          </p>

          <p className="mt-2 text-3xl font-black" style={{ color: 'var(--sidebar)' }}>
            {completedCases}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            مدفوعات معلّقة
          </p>

          <p
            className="mt-2 text-3xl font-black"
            style={{ color: totalPending > 0 ? '#92400e' : 'var(--text)' }}
          >
            {formatCurrency(totalPending)}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            عدد القضايا المالية
          </p>

          <p className="mt-2 text-3xl font-black" style={{ color: 'var(--text)' }}>
            {cases.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم القضية، رقم القضية أو اسم الموكل..."
            className="input"
          />

          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-ghost whitespace-nowrap"
          >
            تصفية
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['all', 'الكل'],
              ['paid', 'مدفوع جزئيًا'],
              ['pending', 'عليه مستحقات'],
              ['completed', 'مكتمل ماليًا'],
            ] as [PaymentFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={
                filter === key
                  ? {
                      background: 'var(--sidebar)',
                      color: '#fff',
                    }
                  : {
                      background: 'var(--green-soft)',
                      color: 'var(--text-2)',
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
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {filteredCases.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="💰"
            title="لا توجد بيانات مالية"
            sub={
              cases.length === 0
                ? 'لا توجد قضايا مرتبطة بمدفوعات حتى الآن.'
                : 'لا توجد نتائج مطابقة للفلاتر الحالية.'
            }
            action={
              cases.length > 0 ? (
                <button type="button" onClick={clearFilters} className="btn btn-ghost">
                  مسح الفلاتر
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div
            className="flex items-center justify-between gap-4 border-b px-5 py-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <div>
              <p className="font-black text-sm" style={{ color: 'var(--text)' }}>
                تفصيل الأتعاب حسب القضية
              </p>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                يعرض الأتعاب، المحصل، المتبقي ونسبة التحصيل لكل قضية
              </p>
            </div>

            <span
              className="rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'var(--green-soft)',
                color: 'var(--sidebar)',
              }}
            >
              {filteredCases.length} قضية
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>القضية</th>
                  <th>الموكل</th>
                  <th>الأتعاب</th>
                  <th>المحصّل</th>
                  <th>المستحق</th>
                  <th>نسبة التحصيل</th>
                  <th>الحالة المالية</th>
                </tr>
              </thead>

              <tbody>
                {filteredCases.map((item) => {
                  const paidAmount = getPaidAmount(item)
                  const pendingAmount = getPendingAmount(item)
                  const remainingAmount = getRemainingAmount(item)
                  const percent = getCollectionPercent(item)
                  const completed = item.feeAgreed > 0 && paidAmount >= item.feeAgreed

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

                      <td className="font-semibold">{item.client?.name ?? '-'}</td>

                      <td>{formatCurrency(item.feeAgreed)}</td>

                      <td className="font-bold" style={{ color: 'var(--sidebar)' }}>
                        {formatCurrency(paidAmount)}
                      </td>

                      <td
                        className="font-bold"
                        style={{
                          color: remainingAmount > 0 ? '#dc2626' : 'var(--text)',
                        }}
                      >
                        {formatCurrency(remainingAmount)}
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
                            ? 'مكتمل'
                            : pendingAmount > 0 || remainingAmount > 0
                              ? 'مستحق'
                              : 'بدون دفعات'}
                        </span>
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