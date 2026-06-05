'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import EmptyState from '@/components/ui/EmptyState'
import TableSkeleton from '@/components/ui/TableSkeleton'
import { formatCurrency } from '@/lib/utils'
import {
  getApiMessage,
  isPlanLimitResponse,
  planLimitMessage,
} from '@/lib/plan-ui'

interface Case {
  id: string
  title: string
  caseNumber?: string
  status: string
  feeAgreed: number
  clientId: string
  client: {
    id?: string
    name: string
  }
  payments: {
    amount: number
    status: string
  }[]
  _count?: {
    appointments: number
    documents: number
  }
}

interface ClientOpt {
  id: string
  name: string
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge badge-green',
  IN_PROGRESS: 'badge badge-blue',
  CLOSED: 'badge badge-gray',
  ARCHIVED: 'badge badge-gray',
}

const STATUS_AR: Record<string, string> = {
  OPEN: 'نشطة',
  IN_PROGRESS: 'قيد المتابعة',
  CLOSED: 'مغلقة',
  ARCHIVED: 'مؤرشفة',
}

const STATUS_FILTERS: [string, string][] = [
  ['all', 'الكل'],
  ['OPEN', 'نشطة'],
  ['IN_PROGRESS', 'قيد المتابعة'],
  ['CLOSED', 'مغلقة'],
  ['ARCHIVED', 'مؤرشفة'],
]

const INIT = {
  clientId: '',
  title: '',
  caseNumber: '',
  court: '',
  feeAgreed: '',
  description: '',
}

function PlanLimitBanner({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">وصلت إلى حد الخطة الحالية</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/billing" className="btn btn-primary">
            عرض الاشتراك
          </Link>

          <button type="button" onClick={onClose} className="btn">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CasesPage() {
  const router = useRouter()

  const [cases, setCases] = useState<Case[]>([])
  const [clients, setClients] = useState<ClientOpt[]>([])
  const [filter, setFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(INIT)
  const [saving, setSaving] = useState(false)
  const [planLimit, setPlanLimit] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const [casesRes, clientsRes] = await Promise.all([
        fetch('/api/cases?page=1&limit=100'),
        fetch('/api/clients?page=1&limit=100'),
      ])

      if (!casesRes.ok || !clientsRes.ok) {
        console.error('Failed to fetch cases/clients', {
          casesStatus: casesRes.status,
          clientsStatus: clientsRes.status,
        })

        setCases([])
        setClients([])
        return
      }

      const [casesData, clientsData] = await Promise.all([
        casesRes.json().catch(() => ({ data: [] })),
        clientsRes.json().catch(() => ({ data: [] })),
      ])

      setCases(Array.isArray(casesData.data?.data) ? casesData.data.data : [])
      setClients(Array.isArray(clientsData.data?.data) ? clientsData.data.data : [])
    } catch {
      toast.error('فشل تحميل القضايا')
      setCases([])
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const activeCount = cases.filter((item) => item.status === 'OPEN').length
  const progressCount = cases.filter((item) => item.status === 'IN_PROGRESS').length
  const closedCount = cases.filter((item) => item.status === 'CLOSED').length
  const archivedCount = cases.filter((item) => item.status === 'ARCHIVED').length

  function paid(item: Case) {
    return item.payments
      .filter((payment) => payment.status === 'PAID')
      .reduce((sum, payment) => sum + payment.amount, 0)
  }

  function remaining(item: Case) {
    return Math.max(0, item.feeAgreed - paid(item))
  }

  const totalFees = cases.reduce((sum, item) => sum + (item.feeAgreed || 0), 0)
  const totalPaid = cases.reduce((sum, item) => sum + paid(item), 0)
  const totalRemaining = Math.max(0, totalFees - totalPaid)

  const filtered = cases.filter((item) => {
    const query = search.trim().toLowerCase()

    const matchesStatus = filter === 'all' || item.status === filter
    const matchesClient = clientFilter === 'all' || item.client?.name === clientFilter

    const matchesSearch =
      !query ||
      item.title?.toLowerCase().includes(query) ||
      item.caseNumber?.toLowerCase().includes(query) ||
      item.client?.name?.toLowerCase().includes(query)

    return matchesStatus && matchesClient && matchesSearch
  })

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()

    if (!form.clientId || !form.title.trim()) {
      toast.error('الموكل وعنوان القضية مطلوبان')
      return
    }

    try {
      setSaving(true)
      setPlanLimit('')

      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          feeAgreed: parseFloat(form.feeAgreed) || 0,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (data.success) {
        toast.success('تمت إضافة القضية')
        setOpen(false)
        setForm(INIT)
        load()
      } else if (isPlanLimitResponse(data)) {
        setOpen(false)
        setPlanLimit(
          planLimitMessage(
            data,
            'وصلت إلى حد القضايا المسموح في خطتك الحالية.'
          )
        )
      } else {
        toast.error(getApiMessage(data, 'تعذر إضافة القضية'))
      }
    } catch {
      toast.error('حدث خطأ أثناء إضافة القضية')
    } finally {
      setSaving(false)
    }
  }

  function f(
    key: keyof typeof INIT
  ) {
    return (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((previous) => ({
        ...previous,
        [key]: event.target.value,
      }))
    }
  }

  function clearFilters() {
    setSearch('')
    setClientFilter('all')
    setFilter('all')
  }

  return (
    <div className="space-y-5 stagger">
      {planLimit && (
        <PlanLimitBanner
          message={planLimit}
          onClose={() => setPlanLimit('')}
        />
      )}

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

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              إدارة القضايا
            </div>

            <h1 className="text-2xl font-black text-white">القضايا</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              تابع ملفات القضايا، الموكلين، الأتعاب، المدفوعات والمستحقات من
              واجهة واحدة تساعدك على إدارة العمل القانوني بوضوح.
            </p>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="btn shrink-0"
            style={{
              background: '#fff',
              color: 'var(--sidebar)',
              borderColor: 'rgba(255,255,255,0.32)',
            }}
          >
            + قضية جديدة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'نشطة',
            value: activeCount,
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: 'قيد المتابعة',
            value: progressCount,
            color: '#92400e',
            bg: 'var(--amber-soft)',
          },
          {
            label: 'مغلقة',
            value: closedCount,
            color: '#6b7280',
            bg: 'var(--card)',
          },
          {
            label: 'مؤرشفة',
            value: archivedCount,
            color: 'var(--text-2)',
            bg: 'var(--card)',
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

            <p className="mt-2 text-3xl font-black" style={{ color: item.color }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_.8fr_auto]">
          <input
            aria-label="البحث في القضايا"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث في رقم القضية، العنوان أو اسم الموكل..."
            className="input"
          />

          <select
            aria-label="فلترة حسب الموكل"
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            className="input"
          >
            <option value="all">جميع الموكلين</option>

            {clients.map((client) => (
              <option key={client.id} value={client.name}>
                {client.name}
              </option>
            ))}
          </select>

          <button onClick={clearFilters} className="btn btn-ghost whitespace-nowrap">
            تصفية
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map(([key, label]) => (
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
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            إجمالي الأتعاب
          </p>

          <p className="mt-2 text-2xl font-black" style={{ color: 'var(--text)' }}>
            {formatCurrency(totalFees)}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
            المدفوع
          </p>

          <p className="mt-2 text-2xl font-black" style={{ color: 'var(--sidebar)' }}>
            {formatCurrency(totalPaid)}
          </p>
        </div>

        <div
          className="card p-5"
          style={{
            background: totalRemaining > 0 ? 'var(--red-soft)' : 'var(--card)',
          }}
        >
          <p
            className="text-xs font-black"
            style={{ color: totalRemaining > 0 ? '#dc2626' : 'var(--text-3)' }}
          >
            المتبقي
          </p>

          <p
            className="mt-2 text-2xl font-black"
            style={{ color: totalRemaining > 0 ? '#dc2626' : 'var(--text)' }}
          >
            {formatCurrency(totalRemaining)}
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="⚖️"
            title="لا توجد قضايا"
            sub={
              cases.length === 0
                ? 'قم بإنشاء أول قضية للبدء بإدارة العمل القانوني.'
                : 'لا توجد قضايا مطابقة للفلاتر الحالية.'
            }
            action={
              cases.length === 0 ? (
                <button onClick={() => setOpen(true)} className="btn btn-primary">
                  + قضية جديدة
                </button>
              ) : (
                <button onClick={clearFilters} className="btn btn-ghost">
                  مسح الفلاتر
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>القضية</th>
                  <th>الموكل</th>
                  <th>الأتعاب</th>
                  <th>المدفوع</th>
                  <th>المتبقي</th>
                  <th>المواعيد</th>
                  <th>المستندات</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item) => {
                  const paidAmount = paid(item)
                  const remainingAmount = remaining(item)

                  return (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/dashboard/cases/${item.id}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div>
                          <p className="font-mono text-sm font-bold">
                            {item.caseNumber ?? `#${item.id.slice(-6)}`}
                          </p>

                          <p
                            className="max-w-[190px] truncate text-xs"
                            style={{ color: 'var(--text-3)' }}
                          >
                            {item.title}
                          </p>
                        </div>
                      </td>

                      <td className="font-semibold">{item.client?.name}</td>

                      <td>{formatCurrency(item.feeAgreed)}</td>

                      <td className="font-bold" style={{ color: 'var(--sidebar)' }}>
                        {formatCurrency(paidAmount)}
                      </td>

                      <td
                        className={`font-bold ${
                          remainingAmount > 0 ? 'text-red-500' : ''
                        }`}
                      >
                        {formatCurrency(remainingAmount)}
                      </td>

                      <td>{item._count?.appointments ?? 0}</td>

                      <td>{item._count?.documents ?? 0}</td>

                      <td>
                        <span className={STATUS_BADGE[item.status] ?? 'badge badge-gray'}>
                          {STATUS_AR[item.status] ?? item.status}
                        </span>
                      </td>

<td>
  <Link
    href={`/dashboard/clients/${item.clientId}`}
    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all hover:-translate-y-0.5 hover:shadow-md"
    style={{
      borderColor: 'var(--border)',
      background: 'var(--green-soft)',
      color: 'var(--sidebar)',
    }}
    title="فتح ملف الموكل"
  >
    فتح الملف
    <span>←</span>
  </Link>
</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          setForm(INIT)
        }}
        title="إضافة قضية جديدة"
      >
        <form onSubmit={handleAdd} className="space-y-3">
          <FormField label="الموكل" required>
            <select value={form.clientId} onChange={f('clientId')} className="input">
              <option value="">اختر موكلاً...</option>

              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="عنوان القضية" required>
            <input
              value={form.title}
              onChange={f('title')}
              className="input"
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="رقم القضية">
              <input
                value={form.caseNumber}
                onChange={f('caseNumber')}
                className="input"
              />
            </FormField>

            <FormField label="الأتعاب">
              <input
                type="number"
                value={form.feeAgreed}
                onChange={f('feeAgreed')}
                className="input"
                min="0"
              />
            </FormField>
          </div>

          <FormField label="المحكمة">
            <input value={form.court} onChange={f('court')} className="input" />
          </FormField>

          <FormField label="الوصف">
            <textarea
              value={form.description}
              onChange={f('description')}
              className="input"
              rows={2}
              style={{ resize: 'none' }}
            />
          </FormField>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setForm(INIT)
              }}
              className="btn btn-ghost flex-1"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? <span className="spinner spinner-sm" /> : 'حفظ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}