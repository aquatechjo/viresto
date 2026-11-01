'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity as ActivityIcon,
  LogIn,
  MonitorSmartphone,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'

import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { FilterBar, FilterSelect, PageHeader, PageHeaderAction, PageStats } from '@/components/page'
import { formatDate } from '@/lib/utils'

interface Activity {
  id: string
  type?: string | null
  title: string
  message?: string | null
  entityType?: string | null
  entityId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  actorId?: string | null
  createdAt: string
}

const FILTERS = [
  { value: '', label: 'كل العمليات' },
  { value: 'LOGIN_SUCCESS', label: 'تسجيل دخول ناجح' },
  { value: 'LOGIN_FAILED', label: 'فشل تسجيل الدخول' },
  { value: 'DOCUMENT_UPLOADED', label: 'رفع مستند' },
  { value: 'DOCUMENT_DELETED', label: 'حذف مستند' },
  { value: 'PAYMENT_ADDED', label: 'إضافة دفعة' },
  { value: 'CASE_CREATED', label: 'إنشاء قضية' },
  { value: 'CLIENT_CREATED', label: 'إنشاء موكل' },
]

// Same values as the period filter of /api/activity (Amman days).
const PERIODS = [
  { value: '', label: 'كل الأوقات' },
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: 'آخر 7 أيام' },
  { value: '30d', label: 'آخر 30 يومًا' },
  { value: '90d', label: 'آخر 90 يومًا' },
]

function eventLabel(type?: string | null) {
  const safeType = type || 'UNKNOWN'

  const labels: Record<string, string> = {
    LOGIN_SUCCESS: 'تسجيل دخول ناجح',
    LOGIN_FAILED: 'فشل تسجيل الدخول',
    DOCUMENT_DELETED: 'حذف مستند',
    DOCUMENT_UPLOADED: 'رفع مستند',
    PAYMENT_ADDED: 'إضافة دفعة',
    CASE_CREATED: 'إنشاء قضية',
    CLIENT_CREATED: 'إنشاء موكل',
    APPOINTMENT_CREATED: 'إنشاء موعد',
    TASK_CREATED: 'إنشاء مهمة',
  }

  return labels[safeType] ?? safeType.replaceAll('_', ' ')
}

function eventBadgeClass(type?: string | null) {
  const safeType = type || 'UNKNOWN'

  if (safeType.includes('DELETE') || safeType.includes('FAILED')) {
    return 'badge badge-red'
  }

  if (safeType.includes('LOGIN')) {
    return 'badge badge-blue'
  }

  if (safeType.includes('UPLOAD') || safeType.includes('CREATE') || safeType.includes('ADDED')) {
    return 'badge badge-green'
  }

  if (safeType.includes('UPDATE')) {
    return 'badge badge-amber'
  }

  return 'badge badge-gray'
}

function eventIcon(type?: string | null) {
  const safeType = type || 'UNKNOWN'

  if (safeType.includes('LOGIN')) return '🔐'
  if (safeType.includes('DELETE')) return '🗑️'
  if (safeType.includes('UPLOAD')) return '📤'
  if (safeType.includes('CREATE')) return '➕'
  if (safeType.includes('UPDATE')) return '✏️'
  if (safeType.includes('PAYMENT')) return '💳'
  if (safeType.includes('FAILED') || safeType.includes('SUSPICIOUS')) return '⚠️'

  return '🛡️'
}

function isHighRisk(activity: Activity) {
  const type = activity.type || ''

  return (
    type.includes('DELETED') ||
    type.includes('DELETE') ||
    type.includes('FAILED') ||
    type.includes('SUSPICIOUS')
  )
}

function getActor(activity: Activity) {
  if (activity.actorId) return `Actor: ${activity.actorId}`
  return 'System User'
}

export default function SecurityDashboardClient() {
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [filter, setFilter] = useState('')
  const [period, setPeriod] = useState('')

  async function load() {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      params.set('limit', '50')

      if (filter) params.set('type', filter)
      if (period) params.set('period', period)

      const response = await fetch(`/api/activity?${params.toString()}`, {
        cache: 'no-store',
      })

      if (response.status === 401) {
        window.location.href = '/login'
        return
      }

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success !== false) {
        const list = Array.isArray(data.data)
          ? data.data
          : data.data?.items ?? []

        setActivities(list)
      } else {
        setActivities([])
      }
    } catch (error) {
      console.error('Security activity load failed:', error)
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, period])

  const stats = useMemo(() => {
    const totalEvents = activities.length

    const loginEvents = activities.filter((activity) =>
      activity.type?.includes('LOGIN')
    ).length

    const uploadEvents = activities.filter((activity) =>
      activity.type?.includes('UPLOADED')
    ).length

    const deleteEvents = activities.filter((activity) =>
      activity.type?.includes('DELETED')
    ).length

    const highRiskEvents = activities.filter(isHighRisk).length

    return {
      totalEvents,
      loginEvents,
      uploadEvents,
      deleteEvents,
      highRiskEvents,
    }
  }, [activities])

  if (loading) {
    return <PageLoader />
  }

  return (
    <div dir="rtl" className="min-w-0 space-y-4 stagger">
      <PageHeader
        dir="rtl"
        title="لوحة مراقبة الأمان"
        description="متابعة عمليات تسجيل الدخول، رفع وحذف الملفات، والأنشطة الحساسة داخل النظام لمراجعة أي حركة غير طبيعية."
        actions={
          <>
            <PageHeaderAction
              primary
              icon={MonitorSmartphone}
              label="الجلسات النشطة"
              href="/dashboard/security/sessions"
            />
            <PageHeaderAction iconOnly icon={RefreshCw} label="تحديث" onClick={load} />
          </>
        }
      />

      <PageStats
        dir="rtl"
        items={[
          { label: 'إجمالي الأحداث', value: stats.totalEvents, hint: 'آخر 50 عملية', icon: <ActivityIcon className="h-4 w-4" />, tone: 'teal' },
          { label: 'تسجيل الدخول', value: stats.loginEvents, hint: 'نجاح أو فشل', icon: <LogIn className="h-4 w-4" />, tone: 'blue' },
          { label: 'عمليات الرفع', value: stats.uploadEvents, hint: 'مستندات وملفات', icon: <Upload className="h-4 w-4" />, tone: 'emerald' },
          { label: 'عمليات الحذف', value: stats.deleteEvents, hint: 'إجراءات حساسة', icon: <Trash2 className="h-4 w-4" />, tone: 'red' },
          {
            label: 'عالية الخطورة',
            value: stats.highRiskEvents,
            hint: 'فشل/حذف/اشتباه',
            hintTone: stats.highRiskEvents > 0 ? 'bad' : 'neutral',
            icon: <TriangleAlert className="h-4 w-4" />,
            tone: stats.highRiskEvents > 0 ? 'gold' : 'slate',
          },
        ]}
      />

      <FilterBar
        dir="rtl"
        active={Boolean(filter || period)}
        onClear={() => {
          setFilter('')
          setPeriod('')
        }}
        clearLabel="مسح الفلاتر"
      >
        <FilterSelect
          dir="rtl"
          aria-label="فلترة سجلات الأمان"
          title="فلترة سجلات الأمان"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {FILTERS.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          dir="rtl"
          aria-label="فلترة الفترة"
          title="فلترة الفترة"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          {PERIODS.map((item) => (
            <option key={item.value || 'all'} value={item.value}>
              {item.label}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      {/* Activity List */}
      <div className="card overflow-hidden p-0">
        <div
          className="flex flex-col gap-2 border-b px-5 py-4 md:flex-row md:items-center md:justify-between"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h2 className="font-black" style={{ color: 'var(--text)' }}>
              سجل الأحداث الأمنية
            </h2>

            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
              {activities.length} حدث (أحدث 50 كحد أقصى)
            </p>
          </div>

          {stats.highRiskEvents > 0 ? (
            <span className="badge badge-amber">
              يوجد {stats.highRiskEvents} حدث يحتاج مراجعة
            </span>
          ) : (
            <span className="badge badge-green">لا توجد أحداث خطرة</span>
          )}
        </div>

        {activities.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon="🛡️"
              title="لا توجد سجلات"
              description={
                activities.length === 0
                  ? 'لم يتم العثور على أي نشاط أمني.'
                  : 'لا توجد نتائج مطابقة للفلاتر الحالية.'
              }
            />
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex flex-col gap-4 p-5 transition-all hover:bg-black/[0.02] xl:flex-row xl:items-start xl:justify-between"
              >
                <div className="flex min-w-0 gap-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg"
                    style={{
                      background: isHighRisk(activity)
                        ? 'var(--red-soft)'
                        : 'var(--green-soft)',
                    }}
                  >
                    {eventIcon(activity.type)}
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={eventBadgeClass(activity.type)}>
                        {eventLabel(activity.type)}
                      </span>

                      <span
                        className="rounded-full px-3 py-1 text-xs font-bold"
                        style={{
                          background: 'var(--input-bg)',
                          color: 'var(--text-2)',
                        }}
                      >
                        {getActor(activity)}
                      </span>
                    </div>

                    <p className="font-black" style={{ color: 'var(--text)' }}>
                      {activity.title || activity.entityType || 'SYSTEM'}
                    </p>

                    {activity.message && (
                      <p className="mt-1 text-sm leading-7" style={{ color: 'var(--text-3)' }}>
                        {activity.message}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                      <span
                        className="rounded-full px-3 py-1"
                        style={{
                          background: 'var(--input-bg)',
                          color: 'var(--text-3)',
                        }}
                      >
                        IP: {activity.ipAddress || 'Unknown'}
                      </span>

                      {activity.entityType && (
                        <span
                          className="rounded-full px-3 py-1"
                          style={{
                            background: 'var(--input-bg)',
                            color: 'var(--text-3)',
                          }}
                        >
                          Entity: {activity.entityType}
                        </span>
                      )}

                      {activity.entityId && (
                        <span
                          className="rounded-full px-3 py-1"
                          style={{
                            background: 'var(--input-bg)',
                            color: 'var(--text-3)',
                          }}
                        >
                          ID: {activity.entityId.slice(-8)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className="shrink-0 text-xs font-bold xl:text-left"
                  style={{ color: 'var(--text-3)' }}
                >
                  {formatDate(activity.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
