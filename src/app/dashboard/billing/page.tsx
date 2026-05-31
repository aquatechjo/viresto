'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import PageLoader from '@/components/ui/PageLoader'
import { formatLimit } from '@/lib/plans'

type PlanKey = 'FREE' | 'PRO' | 'ENTERPRISE'
type TenantStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED'

interface PlanMeta {
  key: PlanKey
  nameAr: string
  nameEn: string
  priceLabel: string
  description: string
  recommended?: boolean
  limits: {
    users: number | null
    clients: number | null
    cases: number | null
    documents: number | null
    storageMb: number | null
    invoices: boolean
    reports: boolean
    aiSummaries: boolean
    support: string
  }
  features: string[]
}

interface UsageItem {
  used: number
  limit: number | null
  percent: number | null
}

interface BillingData {
  tenant: {
    id: string
    name: string
    slug: string
    plan: PlanKey
    status: TenantStatus
    statusLabel: string
    statusTone: 'success' | 'warning' | 'danger'
    isSuspended: boolean
    maxUsers: number
    trialEndsAt?: string | null
    trialDaysLeft?: number | null
    createdAt: string
  }
  currentPlan: PlanMeta
  usage: {
    users: UsageItem
    clients: UsageItem
    cases: UsageItem
    documents: UsageItem
    payments: UsageItem
    invoices: UsageItem
  }
  warnings: Array<{ key: string; percent: number | null }>
  availablePlans: PlanMeta[]
}

const usageLabels: Record<keyof BillingData['usage'], string> = {
  users: 'المستخدمون',
  clients: 'الموكلون',
  cases: 'القضايا',
  documents: 'المستندات',
  payments: 'المدفوعات',
  invoices: 'الفواتير',
}

const statusClasses = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)

    const res = await fetch('/api/billing')
    const json = await res.json().catch(() => ({}))

    if (res.status === 401) {
      window.location.href = '/login'
      return
    }

    if (res.status === 403) {
      toast.error('صفحة الاشتراك متاحة للمدير فقط')
      setLoading(false)
      return
    }

    if (!res.ok || !json.success) {
      toast.error(json.message || 'تعذر تحميل بيانات الاشتراك')
      setLoading(false)
      return
    }

    setData(json.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const trialLabel = useMemo(() => {
    if (!data?.tenant.trialEndsAt) return 'لا توجد تجربة محددة'
    if (data.tenant.trialDaysLeft === null || data.tenant.trialDaysLeft === undefined) {
      return 'تاريخ تجربة غير واضح'
    }
    if (data.tenant.trialDaysLeft < 0) return 'انتهت الفترة التجريبية'
    if (data.tenant.trialDaysLeft === 0) return 'تنتهي التجربة اليوم'
    return `متبقي ${data.tenant.trialDaysLeft} يوم`
  }, [data])

  if (loading) return <PageLoader />

  if (!data) {
    return (
      <div className="card p-6">
        <h1 className="text-2xl font-black mb-2">الاشتراك والخطة</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          لا يمكن عرض بيانات الاشتراك لهذا الحساب.
        </p>
      </div>
    )
  }

  const currentPlan = data.currentPlan

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black">الاشتراك والخطة</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            راقب خطة المكتب، الحدود، والاستخدام الحالي قبل الترقية أو التوسعة.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.open('https://wa.me/', '_blank')}
          className="btn btn-primary"
        >
          طلب ترقية الخطة
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
                الخطة الحالية
              </p>
              <h2 className="mt-1 text-3xl font-black">{currentPlan.nameAr}</h2>
              <p className="mt-2 text-sm leading-7" style={{ color: 'var(--muted)' }}>
                {currentPlan.description}
              </p>
            </div>

            <span className={`rounded-full px-4 py-2 text-xs font-black ${statusClasses[data.tenant.statusTone]}`}>
              {data.tenant.statusLabel}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border p-4">
              <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>المكتب</p>
              <p className="mt-1 font-black">{data.tenant.name}</p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>الحد الأقصى للمستخدمين</p>
              <p className="mt-1 font-black">{formatLimit(data.tenant.maxUsers)}</p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>الفترة التجريبية</p>
              <p className="mt-1 font-black">{trialLabel}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
            ملخص سريع
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>الفواتير</span>
              <b>{currentPlan.limits.invoices ? 'مفعلة' : 'غير مفعلة'}</b>
            </div>
            <div className="flex items-center justify-between">
              <span>التقارير</span>
              <b>{currentPlan.limits.reports ? 'مفعلة' : 'غير مفعلة'}</b>
            </div>
            <div className="flex items-center justify-between">
              <span>AI للمستندات</span>
              <b>{currentPlan.limits.aiSummaries ? 'مفعلة' : 'غير مفعلة'}</b>
            </div>
            <div className="flex items-center justify-between">
              <span>الدعم</span>
              <b>{currentPlan.limits.support}</b>
            </div>
          </div>
        </div>
      </div>

      {data.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          اقتربت من استهلاك بعض حدود خطتك الحالية. راجع الاستخدام أو اطلب ترقية قبل الوصول للحد الأقصى.
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-xl font-black mb-4">الاستخدام الحالي</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(data.usage) as Array<keyof BillingData['usage']>).map((key) => {
            const item = data.usage[key]
            const percent = item.percent ?? 0

            return (
              <div key={key} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{usageLabels[key]}</p>
                  <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                    {item.used.toLocaleString('ar-JO')} / {formatLimit(item.limit)}
                  </p>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: item.limit ? `${Math.min(percent, 100)}%` : '100%' }}
                  />
                </div>

                <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                  {item.limit ? `${percent}% مستخدم` : 'لا يوجد حد محدد'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-black mb-4">الخطط المتاحة</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {data.availablePlans.map((plan) => {
            const active = plan.key === data.tenant.plan

            return (
              <div
                key={plan.key}
                className={`card p-5 relative ${active ? 'ring-2 ring-emerald-600' : ''}`}
              >
                {plan.recommended && (
                  <span className="absolute left-4 top-4 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                    الأكثر مناسبة
                  </span>
                )}

                <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>{plan.nameEn}</p>
                <h3 className="mt-1 text-2xl font-black">{plan.nameAr}</h3>
                <p className="mt-2 text-lg font-black">{plan.priceLabel}</p>
                <p className="mt-2 min-h-12 text-sm leading-7" style={{ color: 'var(--muted)' }}>
                  {plan.description}
                </p>

                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="text-emerald-600">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-2xl bg-black/5 p-3 text-xs leading-6">
                  <p>المستخدمون: {formatLimit(plan.limits.users)}</p>
                  <p>الموكلون: {formatLimit(plan.limits.clients)}</p>
                  <p>القضايا: {formatLimit(plan.limits.cases)}</p>
                  <p>المستندات: {formatLimit(plan.limits.documents)}</p>
                </div>

                <button
                  type="button"
                  disabled={active}
                  className={`mt-5 w-full ${active ? 'btn btn-ghost opacity-70' : 'btn btn-primary'}`}
                  onClick={() => toast.info('حاليًا يتم تعديل الخطة من لوحة إدارة النظام')}
                >
                  {active ? 'خطتك الحالية' : 'طلب الترقية'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
