'use client'

import { useEffect, useState } from 'react'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'


interface Activity {
  id: string
  type?: string
  title: string
  message?: string
  entityType?: string
  entityId?: string
  ipAddress?: string
  userAgent?: string
  actorId?: string
  createdAt: string
}


export default function SecurityDashboardClient() {
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [filter, setFilter] = useState('')

  async function load() {
    setLoading(true)

    const url = filter
      ? `/api/activity?type=${filter}&limit=50`
      : '/api/activity?limit=50'

    const res = await fetch(url)
    const data = await res.json()

    setActivities(data.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [filter])

function badgeColor(type?: string | null) {
  const safeType = type || 'UNKNOWN'

  if (safeType.includes('DELETE')) return '#dc2626'
  if (safeType.includes('LOGIN')) return '#2563eb'
  if (safeType.includes('SUSPICIOUS')) return '#ea580c'
  if (safeType.includes('UPLOAD')) return '#16a34a'
  if (safeType.includes('CREATE')) return '#16a34a'
  if (safeType.includes('UPDATE')) return '#f59e0b'

  return '#7c3aed'
}

  if (loading) {
    return <PageLoader />
  }

  const totalEvents = activities.length
  const uploadEvents = activities.filter(a => a.type?.includes('UPLOADED')).length
  const deleteEvents = activities.filter(a => a.type?.includes('DELETED')).length
  const highRiskEvents = activities.filter(a =>
  a.type?.includes('DELETED') ||
  a.type?.includes('FAILED') ||
  a.type?.includes('SUSPICIOUS')
).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black">
            Security Audit Dashboard
          </h1>

          <p
            className="text-sm mt-1"
            style={{ color: 'var(--muted)' }}
          >
            مراقبة العمليات الأمنية داخل النظام
          </p>
        </div>

        <select
          aria-label="فلترة سجلات الأمان"
          title="فلترة سجلات الأمان"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input max-w-[220px]"
        >
          <option value="">كل العمليات</option>
          <option value="LOGIN_SUCCESS">تسجيل الدخول</option>
          <option value="LOGIN_FAILED">فشل تسجيل الدخول</option>
          <option value="DOCUMENT_DELETED">حذف مستند</option>
          <option value="DOCUMENT_UPLOADED">رفع مستند</option>
        </select>
      </div>

          {/* Security Stats */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">

  <div className="card p-5 border border-slate-200 bg-slate-50/50 transition-all hover:-translate-y-1 hover:shadow-lg">
    <p className="text-sm" style={{ color: 'var(--muted)' }}>
      إجمالي الأحداث
    </p>

    <h3 className="text-3xl font-black mt-2">
      {totalEvents}
    </h3>
  </div>

  <div className="card p-5 border border-green-200 bg-green-50/50 transition-all hover:-translate-y-1 hover:shadow-lg">
    <p className="text-sm" style={{ color: 'var(--muted)' }}>
      عمليات الرفع
    </p>

    <h3 className="text-3xl font-black mt-2 text-green-600">
      {uploadEvents}
    </h3>
  </div>

  <div className="card p-5 border border-red-200 bg-red-50/50 transition-all hover:-translate-y-1 hover:shadow-lg">
    <p className="text-sm" style={{ color: 'var(--muted)' }}>
      عمليات الحذف
    </p>

    <h3 className="text-3xl font-black mt-2 text-red-600">
      {deleteEvents}
    </h3>
  </div>

  <div className="card p-5 border border-orange-200 bg-orange-50/50 transition-all hover:-translate-y-1 hover:shadow-lg">
    <p className="text-sm" style={{ color: 'var(--muted)' }}>
      أحداث عالية الخطورة
    </p>

    <h3 className="text-3xl font-black mt-2 text-orange-600">
      {highRiskEvents}
    </h3>
  </div>

</div>

      {activities.length === 0 ? (
        <EmptyState
          icon="🛡️"
          title="لا توجد سجلات"
          sub="لم يتم العثور على أي نشاط أمني"
        />
      ) : (
        <div className="space-y-4">
          {activities.map((a) => (
            <div
              key={a.id}
              className="card p-5 flex items-start justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold text-white"
                    style={{
                      background: badgeColor(a.type),
                    }}
                  >
                    {a.type || 'UNKNOWN_TYPE'}
                  </span>

                  <span className="text-sm font-bold">
                    {a.actorId ? `Actor: ${a.actorId}` : 'System User'}
                  </span>
                </div>

                <div
                  className="text-sm"
                  style={{ color: 'var(--muted)' }}
                >
                  {a.title || a.entityType || 'SYSTEM'}
                </div>

                <div
                  className="text-xs"
                  style={{ color: 'var(--muted)' }}
                >
                  IP: {a.ipAddress || 'Unknown'}
                </div>
              </div>

              <div
                className="text-xs whitespace-nowrap"
                style={{ color: 'var(--muted)' }}
              >
                {formatDate(a.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}