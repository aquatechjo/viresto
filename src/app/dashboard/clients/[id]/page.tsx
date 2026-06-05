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
import { initials } from '@/lib/utils'
import { useLocale } from '@/lib/useLocale'

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

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge badge-green',
  IN_PROGRESS: 'badge badge-blue',
  CLOSED: 'badge badge-gray',
  ARCHIVED: 'badge badge-gray',
}

const STATUS_KEYS = ['all', 'OPEN', 'IN_PROGRESS', 'CLOSED', 'ARCHIVED'] as const
type StatusFilter = (typeof STATUS_KEYS)[number]

const COPY = {
  ar: {
    notFoundTitle: 'الموكل غير موجود',
    notFoundSub: 'تعذر العثور على بيانات هذا الموكل.',
    missingClientId: 'رقم الموكل غير موجود',
    clientNotFound: 'الموكل غير موجود',
    loadError: 'تعذر تحميل بيانات الموكل',
    nameRequired: 'اسم الموكل مطلوب',
    saved: 'تم حفظ بيانات الموكل',
    saveError: 'تعذر حفظ بيانات الموكل',
    saveUnexpected: 'حدث خطأ أثناء حفظ البيانات',
    exportError: 'تعذر تصدير ملف الموكل',
    exporting: 'جاري التصدير...',
    pdf: 'PDF',
    back: 'رجوع',
    edit: 'تعديل',
    clientFile: 'ملف الموكل',
    clientSince: 'موكل منذ',
    linkedCaseSentence: 'قضية مرتبطة داخل النظام.',
    stats: {
      totalFees: 'إجمالي الأتعاب',
      paid: 'المحصّل',
      remaining: 'المتبقي',
      collectionRate: 'نسبة التحصيل',
    },
    info: {
      title: 'بيانات الموكل',
      sub: 'معلومات الاتصال الأساسية',
      name: 'الاسم',
      phone: 'الهاتف',
      email: 'البريد',
      nationalId: 'الرقم الوطني',
      address: 'العنوان',
      notes: 'ملاحظات',
      empty: 'غير محدد',
    },
    summary: {
      title: 'ملخص القضايا',
      allCases: 'كل القضايا',
      active: 'نشطة',
      closedArchived: 'مغلقة/مؤرشفة',
      pendingPayments: 'دفعات معلقة',
      collected: 'محصّل',
      collectionRate: 'نسبة التحصيل',
    },
    filters: {
      placeholder: 'ابحث باسم القضية أو رقمها...',
      ariaStatus: 'فلترة حسب حالة القضية',
      filter: 'تصفية',
      clear: 'مسح الفلاتر',
      statuses: {
        all: 'الكل',
        OPEN: 'نشطة',
        IN_PROGRESS: 'قيد المتابعة',
        CLOSED: 'مغلقة',
        ARCHIVED: 'مؤرشفة',
      },
    },
    cases: {
      title: 'القضايا المرتبطة',
      countSuffix: 'قضية ضمن النتائج الحالية',
      allCases: 'كل القضايا',
      emptyTitle: 'لا توجد قضايا',
      noCases: 'لا توجد قضايا مرتبطة بهذا الموكل حتى الآن.',
      noResults: 'لا توجد قضايا مطابقة للفلاتر الحالية.',
      columns: {
        case: 'القضية',
        fees: 'الأتعاب',
        paid: 'المحصّل',
        remaining: 'المتبقي',
        collectionRate: 'نسبة التحصيل',
        status: 'الحالة',
      },
    },
    modal: {
      title: 'تعديل بيانات الموكل',
      fullName: 'الاسم الكامل',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      address: 'العنوان',
      notes: 'ملاحظات',
      cancel: 'إلغاء',
      save: 'حفظ',
      saving: 'جاري الحفظ...',
    },
  },
  en: {
    notFoundTitle: 'Client not found',
    notFoundSub: 'Could not find this client record.',
    missingClientId: 'Client ID is missing',
    clientNotFound: 'Client not found',
    loadError: 'Could not load client data',
    nameRequired: 'Client name is required',
    saved: 'Client details saved',
    saveError: 'Could not save client details',
    saveUnexpected: 'Something went wrong while saving',
    exportError: 'Could not export client file',
    exporting: 'Exporting...',
    pdf: 'PDF',
    back: 'Back',
    edit: 'Edit',
    clientFile: 'Client file',
    clientSince: 'Client since',
    linkedCaseSentence: 'linked cases in the system.',
    stats: {
      totalFees: 'Total fees',
      paid: 'Collected',
      remaining: 'Remaining',
      collectionRate: 'Collection rate',
    },
    info: {
      title: 'Client details',
      sub: 'Basic contact information',
      name: 'Name',
      phone: 'Phone',
      email: 'Email',
      nationalId: 'National ID',
      address: 'Address',
      notes: 'Notes',
      empty: 'Not set',
    },
    summary: {
      title: 'Cases summary',
      allCases: 'All cases',
      active: 'Active',
      closedArchived: 'Closed/archived',
      pendingPayments: 'Pending payments',
      collected: 'collected',
      collectionRate: 'Collection rate',
    },
    filters: {
      placeholder: 'Search by case title or number...',
      ariaStatus: 'Filter by case status',
      filter: 'Filter',
      clear: 'Clear filters',
      statuses: {
        all: 'All',
        OPEN: 'Active',
        IN_PROGRESS: 'In progress',
        CLOSED: 'Closed',
        ARCHIVED: 'Archived',
      },
    },
    cases: {
      title: 'Linked cases',
      countSuffix: 'case(s) in current results',
      allCases: 'All cases',
      emptyTitle: 'No cases found',
      noCases: 'No cases are linked to this client yet.',
      noResults: 'No cases match the current filters.',
      columns: {
        case: 'Case',
        fees: 'Fees',
        paid: 'Collected',
        remaining: 'Remaining',
        collectionRate: 'Collection rate',
        status: 'Status',
      },
    },
    modal: {
      title: 'Edit client details',
      fullName: 'Full name',
      phone: 'Phone',
      email: 'Email',
      address: 'Address',
      notes: 'Notes',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving...',
    },
  },
} as const

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

function formatMoney(value: number, localeKey: 'ar' | 'en') {
  const amount = Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return `JOD ${amount}`
}

function formatClientDate(value: string, localeKey: 'ar' | 'en') {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(localeKey === 'ar' ? 'ar-JO' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { locale, isRtl } = useLocale()
  const localeKey = locale === 'ar' ? 'ar' : 'en'
  const text = COPY[localeKey]

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [form, setForm] = useState(INIT_FORM)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const load = useCallback(async () => {
    if (!id || id === 'undefined') {
      setLoading(false)
      toast.error(text.missingClientId)
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
        toast.error(safeMessage(data, text.clientNotFound))
      }
    } catch {
      toast.error(text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.clientNotFound, text.loadError, text.missingClientId])

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

  const openCases =
    client?.cases.filter((item) =>
      ['OPEN', 'IN_PROGRESS'].includes(item.status)
    ).length ?? 0

  const closedCases =
    client?.cases.filter((item) =>
      ['CLOSED', 'ARCHIVED'].includes(item.status)
    ).length ?? 0

  async function save(event: FormEvent) {
    event.preventDefault()

    if (!form.name.trim()) {
      toast.error(text.nameRequired)
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
        toast.success(text.saved)
        setEditing(false)
        load()
      } else {
        toast.error(safeMessage(data, text.saveError))
      }
    } catch {
      toast.error(text.saveUnexpected)
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
      toast.error(text.exportError)
    } finally {
      setExporting(false)
    }
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
  }

  const currencyTextClass = (value: string) =>
    value.length > 8 ? 'text-lg' : 'text-2xl'

  if (loading) return <PageLoader />

  if (!client) {
    return (
      <div
        className="min-w-0 max-w-full space-y-5 overflow-x-hidden stagger"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="card p-10 text-center">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            {text.notFoundTitle}
          </h1>

          <p className="mt-2 text-sm" style={{ color: 'var(--text-3)' }}>
            {text.notFoundSub}
          </p>

          <button onClick={() => router.back()} className="btn btn-primary mt-5">
            {text.back}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-w-0 max-w-full space-y-5 overflow-x-hidden stagger"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
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

            <div className="min-w-0 flex-1">
              <div
                className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                {text.clientFile}
              </div>

              <h1 className="truncate text-2xl font-black text-white">
                {client.name}
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
                {text.clientSince} {formatClientDate(client.createdAt, localeKey)} ·{' '}
                {client.cases.length} {text.linkedCaseSentence}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {client.phone && (
                  <span
                    dir="ltr"
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
                    dir="ltr"
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
                    dir="ltr"
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

          <div
            className={`flex flex-wrap gap-2 ${
              isRtl ? 'justify-start xl:justify-end' : 'justify-start'
            }`}
          >
            <button
              type="button"
              onClick={() => router.back()}
              className="btn h-11 px-5"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
                borderColor: 'rgba(255,255,255,0.32)',
              }}
            >
              {text.back}
            </button>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn h-11 px-5"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            >
              {text.edit}
            </button>

            <button
              type="button"
              onClick={exportClientPDF}
              disabled={exporting}
              className="btn h-11 px-5"
              style={{
                background: 'rgba(245,200,66,0.18)',
                color: '#fff',
                borderColor: 'rgba(245,200,66,0.35)',
              }}
            >
              {exporting ? text.exporting : text.pdf}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: text.stats.totalFees,
            value: formatMoney(totals.totalFees, localeKey),
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: text.stats.paid,
            value: formatMoney(totals.totalPaid, localeKey),
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: text.stats.remaining,
            value: formatMoney(totals.totalRemaining, localeKey),
            color: totals.totalRemaining > 0 ? '#dc2626' : 'var(--text-3)',
            bg: totals.totalRemaining > 0 ? 'var(--red-soft)' : 'var(--card)',
          },
          {
            label: text.stats.collectionRate,
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

<p
  dir="ltr"
  className={`
    mt-2 whitespace-nowrap font-black leading-tight
    ${item.label === text.stats.collectionRate ? 'text-2xl' : 'text-xl'}
    ${isRtl ? 'text-right' : 'text-left'}
  `}
  style={{ color: item.color }}
>
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
                {text.info.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {text.info.sub}
              </p>
            </div>

            <div className="space-y-3">
              <InfoRow icon="👤" label={text.info.name} value={client.name} empty={text.info.empty} />
              <InfoRow icon="📞" label={text.info.phone} value={client.phone} empty={text.info.empty} forceLtr />
              <InfoRow icon="✉️" label={text.info.email} value={client.email} empty={text.info.empty} forceLtr />
              <InfoRow icon="🪪" label={text.info.nationalId} value={client.nationalId} empty={text.info.empty} forceLtr />
              <InfoRow icon="📍" label={text.info.address} value={client.address} empty={text.info.empty} />
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
                  {text.info.notes}
                </p>
                {client.notes}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-black" style={{ color: 'var(--text)' }}>
              {text.summary.title}
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label={text.summary.allCases} value={String(client.cases.length)} />
              <MiniMetric label={text.summary.active} value={String(openCases)} />
              <MiniMetric label={text.summary.closedArchived} value={String(closedCases)} />
              <MiniMetric
                label={text.summary.pendingPayments}
                value={formatMoney(totals.totalPending, localeKey)}
                danger={totals.totalPending > 0}
                isRtl={isRtl}
              />
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex justify-between gap-3 text-xs font-black">
              <span style={{ color: 'var(--sidebar)' }}>
                {Math.round(totals.collectionRate)}% {text.summary.collected}
              </span>

              <span style={{ color: 'var(--text-3)' }}>{text.summary.collectionRate}</span>
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
  <div className="grid grid-cols-1 gap-3">
    <input
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-label={text.filters.placeholder}
      value={search}
      onChange={(event) => setSearch(event.target.value)}
      placeholder={text.filters.placeholder}
      className={`input h-12 w-full ${isRtl ? '!text-right' : '!text-left'}`}
      style={{
        textAlign: isRtl ? 'right' : 'left',
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    />
  </div>

  <div
    className={`mt-4 flex flex-wrap gap-2 ${
      isRtl ? 'justify-end' : 'justify-start'
    }`}
  >
    {STATUS_KEYS.map((key) => (
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
        {text.filters.statuses[key]}
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
        {text.filters.clear}
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
                  {text.cases.title}
                </h2>

                <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                  {filteredCases.length} {text.cases.countSuffix}
                </p>
              </div>

              <Link href="/dashboard/cases" className="btn btn-ghost">
                {text.cases.allCases}
              </Link>
            </div>

            {filteredCases.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon="⚖️"
                  title={text.cases.emptyTitle}
                  sub={
                    client.cases.length === 0
                      ? text.cases.noCases
                      : text.cases.noResults
                  }
                  action={
                    client.cases.length > 0 ? (
                      <button type="button" onClick={clearFilters} className="btn btn-ghost">
                        {text.filters.clear}
                      </button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="data-table min-w-[860px]">
                  <thead>
                    <tr>
                      <th>{text.cases.columns.case}</th>
                      <th>{text.cases.columns.fees}</th>
                      <th>{text.cases.columns.paid}</th>
                      <th>{text.cases.columns.remaining}</th>
                      <th>{text.cases.columns.collectionRate}</th>
                      <th>{text.cases.columns.status}</th>
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

                          <td
                            dir="ltr"
                            className={`whitespace-nowrap ${isRtl ? 'text-right' : 'text-left'}`}
                          >
                            {formatMoney(item.feeAgreed, localeKey)}
                          </td>

                          <td
                            dir="ltr"
                            className={`whitespace-nowrap font-bold ${isRtl ? 'text-right' : 'text-left'}`}
                            style={{ color: 'var(--sidebar)' }}
                          >
                            {formatMoney(paid, localeKey)}
                          </td>

                          <td
                            dir="ltr"
                            className={`whitespace-nowrap font-bold ${isRtl ? 'text-right' : 'text-left'}`}
                            style={{
                              color: remaining > 0 ? '#dc2626' : 'var(--text)',
                            }}
                          >
                            {formatMoney(remaining, localeKey)}
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
                                dir="ltr"
                                className="w-9 text-xs font-bold"
                                style={{ color: 'var(--text-2)' }}
                              >
                                {Math.round(percent)}%
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className={STATUS_BADGE[item.status] ?? 'badge badge-gray'}>
                              {text.filters.statuses[item.status as keyof typeof text.filters.statuses] ?? item.status}
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
  title={text.modal.title}
>
  <form onSubmit={save} className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
    <FormField label={text.modal.fullName} required>
      <input
        dir={isRtl ? 'rtl' : 'ltr'}
        value={form.name}
        onChange={(event) =>
          setForm((previous) => ({
            ...previous,
            name: event.target.value,
          }))
        }
        className={`input ${isRtl ? '!text-right' : '!text-left'}`}
        style={{
          textAlign: isRtl ? 'right' : 'left',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
        autoFocus
      />
    </FormField>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label={text.modal.phone}>
        <input
          dir="ltr"
          value={form.phone}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              phone: event.target.value,
            }))
          }
          className={`input ${isRtl ? '!text-right' : '!text-left'}`}
          style={{
            textAlign: isRtl ? 'right' : 'left',
            direction: 'ltr',
          }}
        />
      </FormField>

      <FormField label={text.modal.email}>
        <input
          dir="ltr"
          type="email"
          value={form.email}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              email: event.target.value,
            }))
          }
          className={`input ${isRtl ? '!text-right' : '!text-left'}`}
          style={{
            textAlign: isRtl ? 'right' : 'left',
            direction: 'ltr',
          }}
        />
      </FormField>
    </div>

    <FormField label={text.modal.address}>
      <input
        dir={isRtl ? 'rtl' : 'ltr'}
        value={form.address}
        onChange={(event) =>
          setForm((previous) => ({
            ...previous,
            address: event.target.value,
          }))
        }
        className={`input ${isRtl ? '!text-right' : '!text-left'}`}
        style={{
          textAlign: isRtl ? 'right' : 'left',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      />
    </FormField>

    <FormField label={text.modal.notes}>
      <textarea
        dir={isRtl ? 'rtl' : 'ltr'}
        value={form.notes}
        onChange={(event) =>
          setForm((previous) => ({
            ...previous,
            notes: event.target.value,
          }))
        }
        className={`input min-h-[105px] resize-none ${
          isRtl ? '!text-right' : '!text-left'
        }`}
        style={{
          textAlign: isRtl ? 'right' : 'left',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      />
    </FormField>

    <div className="flex gap-2 pt-2">
      <button
        type="button"
        onClick={() => {
          setEditing(false)
          setForm({
            name: client.name ?? '',
            phone: client.phone ?? '',
            email: client.email ?? '',
            address: client.address ?? '',
            notes: client.notes ?? '',
          })
        }}
        className="btn btn-ghost flex-1"
      >
        {text.modal.cancel}
      </button>

      <button type="submit" disabled={saving} className="btn btn-primary flex-1">
        {saving ? text.modal.saving : text.modal.save}
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
  empty,
  forceLtr,
}: {
  icon: string
  label: string
  value?: string | null
  empty: string
  forceLtr?: boolean
}) {
  return (
    <div
      className="rounded-2xl border px-3 py-2.5"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-base">{icon}</span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-start" style={{ color: 'var(--text-3)' }}>
            {label}
          </p>

          <p
            dir={forceLtr ? 'ltr' : undefined}
            className="mt-1 break-words text-start text-sm font-bold"
            style={{ color: value ? 'var(--text)' : 'var(--text-3)' }}
          >
            {value || empty}
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
  isRtl,
}: {
  label: string
  value: string
  danger?: boolean
  isRtl?: boolean
}) {
  const isLongValue = value.length > 8

  return (
    <div
      className="rounded-2xl border px-3 py-2.5"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>

      <p
        dir="ltr"
        className={`mt-1 whitespace-nowrap font-black leading-tight ${
          isLongValue ? 'text-base' : 'text-lg'
        } ${isRtl ? 'text-right' : 'text-left'}`}
        style={{ color: danger ? '#dc2626' : 'var(--text)' }}
      >
        {value}
      </p>
    </div>
  )
}
