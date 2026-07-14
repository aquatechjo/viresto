'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
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
  const [search, setSearch] = useState('')

  async function load() {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      params.set('limit', '50')

      if (filter) params.set('type', filter)

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
  }, [filter])

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return activities

    return activities.filter((activity) => {
      return (
        activity.type?.toLowerCase().includes(query) ||
        activity.title?.toLowerCase().includes(query) ||
        activity.message?.toLowerCase().includes(query) ||
        activity.entityType?.toLowerCase().includes(query) ||
        activity.ipAddress?.toLowerCase().includes(query) ||
        activity.actorId?.toLowerCase().includes(query)
      )
    })
  }, [activities, search])

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
    <div className="space-y-5 stagger">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6"
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

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              Security Audit
            </div>

            <h1 className="text-2xl font-black text-white">
              لوحة مراقبة الأمان
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              متابعة عمليات تسجيل الدخول، رفع وحذف الملفات، والأنشطة الحساسة داخل النظام لمراجعة أي حركة غير طبيعية.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/security/sessions"
              className="btn"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
                borderColor: 'rgba(255,255,255,0.32)',
              }}
            >
              الجلسات النشطة
            </Link>

            <button
              type="button"
              onClick={load}
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            >
              تحديث
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'إجمالي الأحداث',
            value: stats.totalEvents,
            hint: 'آخر 50 عملية',
            bg: 'var(--card)',
            color: 'var(--text)',
          },
          {
            label: 'تسجيل الدخول',
            value: stats.loginEvents,
            hint: 'نجاح أو فشل',
            bg: 'var(--card)',
            color: '#2563eb',
          },
          {
            label: 'عمليات الرفع',
            value: stats.uploadEvents,
            hint: 'مستندات وملفات',
            bg: 'var(--green-soft)',
            color: 'var(--sidebar)',
          },
          {
            label: 'عمليات الحذف',
            value: stats.deleteEvents,
            hint: 'إجراءات حساسة',
            bg: 'var(--red-soft)',
            color: '#dc2626',
          },
          {
            label: 'عالية الخطورة',
            value: stats.highRiskEvents,
            hint: 'فشل/حذف/اشتباه',
            bg: stats.highRiskEvents > 0 ? 'var(--amber-soft)' : 'var(--card)',
            color: stats.highRiskEvents > 0 ? '#92400e' : 'var(--text)',
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

            <p className="mt-1 text-xs font-bold" style={{ color: 'var(--text-3)' }}>
              {item.hint}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_.8fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالنوع، العنوان، IP، أو المستخدم..."
            className="input"
          />

          <select
            aria-label="فلترة سجلات الأمان"
            title="فلترة سجلات الأمان"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="input"
          >
            {FILTERS.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch('')
              setFilter('')
            }}
            className="btn btn-ghost whitespace-nowrap"
          >
            مسح الفلاتر
          </button>
        </div>
      </div>

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
              {filteredActivities.length} نتيجة ظاهرة من أصل {activities.length}
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

        {filteredActivities.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon="🛡️"
              title="لا توجد سجلات"
              sub={
                activities.length === 0
                  ? 'لم يتم العثور على أي نشاط أمني.'
                  : 'لا توجد نتائج مطابقة للفلاتر الحالية.'
              }
            />
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filteredActivities.map((activity) => (
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