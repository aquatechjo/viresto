'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import PageLoader from '@/components/ui/PageLoader'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency, formatDate, initials } from '@/lib/utils'

interface ClientCase {
  id: string
  title: string
  caseNumber?: string | null
  status: string
  feeAgreed: number
  payments: {
    amount: number
    status: string
  }[]
}

interface Client {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  nationalId?: string | null
  address?: string | null
  notes?: string | null
  createdAt: string
  cases: ClientCase[]
}

const STATUS_AR: Record<string, string> = {
  OPEN: 'نشطة',
  IN_PROGRESS: 'قيد المتابعة',
  CLOSED: 'مغلقة',
  ARCHIVED: 'مؤرشفة',
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge badge-green',
  IN_PROGRESS: 'badge badge-blue',
  CLOSED: 'badge badge-gray',
  ARCHIVED: 'badge badge-gray',
}

const STATUS_FILTERS = [
  ['all', 'الكل'],
  ['OPEN', 'نشطة'],
  ['IN_PROGRESS', 'قيد المتابعة'],
  ['CLOSED', 'مغلقة'],
  ['ARCHIVED', 'مؤرشفة'],
] as const

const INIT_FORM = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

function getPaidAmount(item: ClientCase) {
  return item.payments
    .filter((payment) => payment.status === 'PAID')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
}

function getPendingAmount(item: ClientCase) {
  return item.payments
    .filter((payment) => payment.status !== 'PAID')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
}

function getRemainingAmount(item: ClientCase) {
  return Math.max(0, Number(item.feeAgreed || 0) - getPaidAmount(item))
}

function getCollectionPercent(item: ClientCase) {
  if (!item.feeAgreed || item.feeAgreed <= 0) return 0

  return Math.min((getPaidAmount(item) / item.feeAgreed) * 100, 100)
}

function safeMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [form, setForm] = useState(INIT_FORM)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    if (!id || id === 'undefined') {
      setLoading(false)
      toast.error('رقم الموكل غير موجود')
      return
    }

    try {
      setLoading(true)

      const response = await fetch(`/api/clients/${id}`)
      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        setClient(data.data)
        setForm({
          name: data.data.name ?? '',
          phone: data.data.phone ?? '',
          email: data.data.email ?? '',
          address: data.data.address ?? '',
          notes: data.data.notes ?? '',
        })
      } else {
        toast.error(safeMessage(data, 'الموكل غير موجود'))
      }
    } catch {
      toast.error('تعذر تحميل بيانات الموكل')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const totalFees =
      client?.cases.reduce(
        (sum, item) => sum + Number(item.feeAgreed || 0),
        0
      ) ?? 0

    const totalPaid =
      client?.cases.reduce((sum, item) => sum + getPaidAmount(item), 0) ?? 0

    const totalPending =
      client?.cases.reduce((sum, item) => sum + getPendingAmount(item), 0) ?? 0

    const totalRemaining =
      client?.cases.reduce((sum, item) => sum + getRemainingAmount(item), 0) ?? 0

    const collectionRate =
      totalFees > 0 ? Math.min((totalPaid / totalFees) * 100, 100) : 0

    return {
      totalFees,
      totalPaid,
      totalPending,
      totalRemaining,
      collectionRate,
    }
  }, [client])

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase()

    return (client?.cases ?? []).filter((item) => {
      const matchesSearch =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.caseNumber?.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'all' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [client, search, statusFilter])

  const openCases = client?.cases.filter((item) =>
    ['OPEN', 'IN_PROGRESS'].includes(item.status)
  ).length ?? 0

  const closedCases = client?.cases.filter((item) =>
    ['CLOSED', 'ARCHIVED'].includes(item.status)
  ).length ?? 0

  async function save(event: FormEvent) {
    event.preventDefault()

    if (!form.name.trim()) {
      toast.error('اسم الموكل مطلوب')
      return
    }

    try {
      setSaving(true)

      const response = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        toast.success('تم حفظ بيانات الموكل')
        setEditing(false)
        load()
      } else {
        toast.error(safeMessage(data, 'تعذر حفظ بيانات الموكل'))
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ البيانات')
    } finally {
      setSaving(false)
    }
  }

  async function exportClientPDF() {
    if (!client || exporting) return

    try {
      setExporting(true)

      const { exportClientFullPDF } = await import('@/lib/export')
      exportClientFullPDF(client)
    } catch {
      toast.error('تعذر تصدير ملف الموكل')
    } finally {
      setExporting(false)
    }
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
  }

  if (loading) return <PageLoader />

  if (!client) {
    return (
      <div className="space-y-5 stagger">
        <div className="card p-10 text-center">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            الموكل غير موجود
          </h1>

          <p className="mt-2 text-sm" style={{ color: 'var(--text-3)' }}>
            تعذر العثور على بيانات هذا الموكل.
          </p>

          <button onClick={() => router.back()} className="btn btn-primary mt-5">
            رجوع
          </button>
        </div>
      </div>
    )
  }

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

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-2xl font-black"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
              }}
            >
              {initials(client.name)}
            </div>

            <div className="min-w-0">
              <div
                className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                ملف الموكل
              </div>

              <h1 className="truncate text-2xl font-black text-white">
                {client.name}
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
                موكل منذ {formatDate(client.createdAt)} · لديه {client.cases.length}{' '}
                قضية مرتبطة داخل النظام.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {client.phone && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.14)',
                      color: '#fff',
                    }}
                  >
                    📞 {client.phone}
                  </span>
                )}

                {client.email && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.14)',
                      color: '#fff',
                    }}
                  >
                    ✉️ {client.email}
                  </span>
                )}

                {client.nationalId && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.14)',
                      color: '#fff',
                    }}
                  >
                    🪪 {client.nationalId}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
                borderColor: 'rgba(255,255,255,0.32)',
              }}
            >
              رجوع
            </button>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            >
              تعديل
            </button>

            <button
              type="button"
              onClick={exportClientPDF}
              disabled={exporting}
              className="btn"
              style={{
                background: 'rgba(245,200,66,0.18)',
                color: '#fff',
                borderColor: 'rgba(245,200,66,0.35)',
              }}
            >
              {exporting ? 'جاري التصدير...' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'إجمالي الأتعاب',
            value: formatCurrency(totals.totalFees),
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: 'المحصّل',
            value: formatCurrency(totals.totalPaid),
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: 'المتبقي',
            value: formatCurrency(totals.totalRemaining),
            color: totals.totalRemaining > 0 ? '#dc2626' : 'var(--text-3)',
            bg: totals.totalRemaining > 0 ? 'var(--red-soft)' : 'var(--card)',
          },
          {
            label: 'نسبة التحصيل',
            value: `${Math.round(totals.collectionRate)}%`,
            color: totals.collectionRate >= 80 ? 'var(--sidebar)' : '#92400e',
            bg:
              totals.collectionRate >= 80
                ? 'var(--green-soft)'
                : 'var(--amber-soft)',
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Client Info */}
        <div className="space-y-5 xl:col-span-4">
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                بيانات الموكل
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                معلومات الاتصال الأساسية
              </p>
            </div>

            <div className="space-y-3">
              <InfoRow icon="👤" label="الاسم" value={client.name} />
              <InfoRow icon="📞" label="الهاتف" value={client.phone} />
              <InfoRow icon="✉️" label="البريد" value={client.email} />
              <InfoRow icon="🪪" label="الرقم الوطني" value={client.nationalId} />
              <InfoRow icon="📍" label="العنوان" value={client.address} />
            </div>

            {client.notes && (
              <div
                className="mt-4 rounded-2xl border p-4 text-sm leading-7"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--green-soft)',
                  color: 'var(--text-2)',
                }}
              >
                <p className="mb-1 text-xs font-black" style={{ color: 'var(--sidebar)' }}>
                  ملاحظات
                </p>
                {client.notes}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-black" style={{ color: 'var(--text)' }}>
              ملخص القضايا
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="كل القضايا" value={String(client.cases.length)} />
              <MiniMetric label="نشطة" value={String(openCases)} />
              <MiniMetric label="مغلقة/مؤرشفة" value={String(closedCases)} />
              <MiniMetric
                label="دفعات معلقة"
                value={formatCurrency(totals.totalPending)}
                danger={totals.totalPending > 0}
              />
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex justify-between text-xs font-black">
              <span style={{ color: 'var(--sidebar)' }}>
                {Math.round(totals.collectionRate)}% محصّل
              </span>

              <span style={{ color: 'var(--text-3)' }}>نسبة التحصيل</span>
            </div>

            <div
              className="h-2.5 overflow-hidden rounded-full"
              style={{ background: 'var(--input-bg)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${totals.collectionRate}%`,
                  background:
                    totals.collectionRate >= 100
                      ? 'var(--sidebar)'
                      : totals.collectionRate >= 60
                        ? '#f59e0b'
                        : '#dc2626',
                }}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-5 xl:col-span-8">
          {/* Filters */}
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_.8fr_auto]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث باسم القضية أو رقمها..."
                className="input"
              />

              <select
                aria-label="فلترة حسب حالة القضية"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="input"
              >
                {STATUS_FILTERS.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="btn btn-ghost whitespace-nowrap"
              >
                تصفية
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {STATUS_FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
                  style={
                    statusFilter === key
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

              {(search || statusFilter !== 'all') && (
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

          {/* Cases */}
          <div className="card overflow-hidden p-0">
            <div
              className="flex items-center justify-between gap-4 border-b px-5 py-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <h2 className="font-black" style={{ color: 'var(--text)' }}>
                  القضايا المرتبطة
                </h2>

                <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                  {filteredCases.length} قضية ضمن النتائج الحالية
                </p>
              </div>

              <Link href="/dashboard/cases" className="btn btn-ghost">
                كل القضايا
              </Link>
            </div>

            {filteredCases.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon="⚖️"
                  title="لا توجد قضايا"
                  sub={
                    client.cases.length === 0
                      ? 'لا توجد قضايا مرتبطة بهذا الموكل حتى الآن.'
                      : 'لا توجد قضايا مطابقة للفلاتر الحالية.'
                  }
                  action={
                    client.cases.length > 0 ? (
                      <button type="button" onClick={clearFilters} className="btn btn-ghost">
                        مسح الفلاتر
                      </button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>القضية</th>
                      <th>الأتعاب</th>
                      <th>المحصّل</th>
                      <th>المتبقي</th>
                      <th>نسبة التحصيل</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCases.map((item) => {
                      const paid = getPaidAmount(item)
                      const remaining = getRemainingAmount(item)
                      const percent = getCollectionPercent(item)

                      return (
                        <tr
                          key={item.id}
                          onClick={() => router.push(`/dashboard/cases/${item.id}`)}
                          className="cursor-pointer"
                        >
                          <td>
                            <div>
                              <p className="font-black" style={{ color: 'var(--text)' }}>
                                {item.title}
                              </p>

                              <p
                                className="mt-1 font-mono text-xs"
                                style={{ color: 'var(--text-3)' }}
                              >
                                {item.caseNumber ?? `#${item.id.slice(-4)}`}
                              </p>
                            </div>
                          </td>

                          <td>{formatCurrency(item.feeAgreed)}</td>

                          <td className="font-bold" style={{ color: 'var(--sidebar)' }}>
                            {formatCurrency(paid)}
                          </td>

                          <td
                            className="font-bold"
                            style={{
                              color: remaining > 0 ? '#dc2626' : 'var(--text)',
                            }}
                          >
                            {formatCurrency(remaining)}
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
                            <span className={STATUS_BADGE[item.status] ?? 'badge badge-gray'}>
                              {STATUS_AR[item.status] ?? item.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editing}
        onClose={() => {
          setEditing(false)
          setForm({
            name: client.name ?? '',
            phone: client.phone ?? '',
            email: client.email ?? '',
            address: client.address ?? '',
            notes: client.notes ?? '',
          })
        }}
        title="تعديل بيانات الموكل"
      >
        <form onSubmit={save} className="space-y-3">
          <FormField label="الاسم الكامل" required>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              className="input"
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="الهاتف">
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
                }
                className="input"
              />
            </FormField>

            <FormField label="البريد الإلكتروني">
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    email: event.target.value,
                  }))
                }
                className="input"
              />
            </FormField>
          </div>

          <FormField label="العنوان">
            <input
              value={form.address}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  address: event.target.value,
                }))
              }
              className="input"
            />
          </FormField>

          <FormField label="ملاحظات">
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
              className="input"
              rows={3}
              style={{ resize: 'none' }}
            />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn btn-ghost flex-1"
            >
              إلغاء
            </button>

            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value?: string | null
}) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{icon}</span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            {label}
          </p>

          <p
            className="mt-1 break-words text-sm font-bold"
            style={{ color: value ? 'var(--text)' : 'var(--text-3)' }}
          >
            {value || 'غير محدد'}
          </p>
        </div>
      </div>
    </div>
  )
}

function MiniMetric({
  label,
  value,
  danger,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>

      <p
        className="mt-1 text-lg font-black"
        style={{ color: danger ? '#dc2626' : 'var(--text)' }}
      >
        {value}
      </p>
    </div>
  )
}