'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Activity as ActivityIcon,
  CalendarClock,
  FileText,
  Filter,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, formatTime } from '@/lib/utils'

interface ActivityItem {
  id: string
  type: string
  title: string
  message?: string | null
  entityType?: string | null
  entityId?: string | null
  createdAt: string
  ipAddress?: string | null
  userAgent?: string | null
  actor?: {
    id: string
    name: string
    email: string
    role: string
  } | null
}

const TYPE_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'إضافة موكل',
  CLIENT_UPDATED: 'تعديل موكل',
  CLIENT_DELETED: 'حذف موكل',
  CASE_CREATED: 'إضافة قضية',
  CASE_UPDATED: 'تعديل قضية',
  CASE_STATUS_CHANGED: 'تغيير حالة قضية',
  CASE_DELETED: 'حذف قضية',
  APPOINTMENT_CREATED: 'إضافة موعد',
  APPOINTMENT_UPDATED: 'تعديل موعد',
  APPOINTMENT_DELETED: 'حذف موعد',
  TASK_CREATED: 'إضافة مهمة',
  TASK_COMPLETED: 'إنجاز مهمة',
  TASK_REOPENED: 'إعادة فتح مهمة',
  TASK_DELETED: 'حذف مهمة',
  DOCUMENT_UPLOADED: 'رفع مستند',
  DOCUMENT_VIEWED: 'فتح مستند',
  DOCUMENT_DELETED: 'حذف مستند',
  PAYMENT_ADDED: 'إضافة دفعة',
  PAYMENT_UPDATED: 'تعديل دفعة',
  PAYMENT_DELETED: 'حذف دفعة',
  INVOICE_CREATED: 'إنشاء فاتورة',
  INVOICE_UPDATED: 'تعديل فاتورة',
  INVOICE_DELETED: 'حذف فاتورة',
  USER_LOGIN: 'تسجيل دخول',
  USER_LOGOUT: 'تسجيل خروج',
}

const TYPE_OPTIONS = [
  ['all', 'كل الأنشطة'],
  ['CLIENT_CREATED', 'الموكلون'],
  ['CASE_CREATED', 'القضايا'],
  ['APPOINTMENT_CREATED', 'المواعيد'],
  ['TASK_CREATED', 'المهام'],
  ['DOCUMENT_UPLOADED', 'المستندات'],
  ['PAYMENT_ADDED', 'الدفعات'],
  ['INVOICE_CREATED', 'الفواتير'],
  ['USER_LOGIN', 'الأمان'],
] as const

function activityLabel(type: string) {
  return TYPE_LABELS[type] ?? type.replaceAll('_', ' ')
}

function entityLabel(entityType?: string | null) {
  const labels: Record<string, string> = {
    CASE: 'قضية',
    CLIENT: 'موكل',
    DOCUMENT: 'مستند',
    PAYMENT: 'دفعة',
    INVOICE: 'فاتورة',
    TASK: 'مهمة',
    APPOINTMENT: 'موعد',
    USER: 'مستخدم',
  }

  return entityType ? labels[entityType] ?? entityType : '-'
}

function entityHref(activity: ActivityItem) {
  if (!activity.entityId || !activity.entityType) return null

  if (activity.entityType === 'CASE') return `/dashboard/cases/${activity.entityId}`
  if (activity.entityType === 'CLIENT') return `/dashboard/clients/${activity.entityId}`
  if (activity.entityType === 'INVOICE') return `/dashboard/invoices/${activity.entityId}`

  return null
}

function categoryOf(type: string) {
  if (type.includes('LOGIN') || type.includes('LOGOUT') || type.includes('SESSION')) return 'security'
  if (type.includes('PAYMENT') || type.includes('INVOICE')) return 'finance'
  if (type.includes('CASE')) return 'cases'
  return 'other'
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')

  async function load(showToast = false) {
    try {
      if (activities.length) setRefreshing(true)
      else setLoading(true)

      const params = new URLSearchParams({ limit: '100' })
      if (type !== 'all') params.set('type', type)
      if (search.trim()) params.set('q', search.trim())

      const res = await fetch(`/api/activity?${params.toString()}`)
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.success) {
        toast.error(data.message ?? 'تعذر تحميل سجل النشاط')
        return
      }

      setActivities(Array.isArray(data.data) ? data.data : [])
      if (showToast) toast.success('تم تحديث سجل النشاط')
    } catch {
      toast.error('حدث خطأ أثناء تحميل سجل النشاط')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activities

    return activities.filter((a) => {
      return (
        a.title?.toLowerCase().includes(q) ||
        a.message?.toLowerCase().includes(q) ||
        a.type?.toLowerCase().includes(q) ||
        a.entityType?.toLowerCase().includes(q) ||
        a.actor?.name?.toLowerCase().includes(q) ||
        a.actor?.email?.toLowerCase().includes(q)
      )
    })
  }, [activities, search])

  const today = new Date().toDateString()
  const stats = {
    total: activities.length,
    today: activities.filter((a) => new Date(a.createdAt).toDateString() === today).length,
    security: activities.filter((a) => categoryOf(a.type) === 'security').length,
    finance: activities.filter((a) => categoryOf(a.type) === 'finance').length,
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 stagger">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--text)' }}>
            سجل النشاط
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-3)' }}>
            متابعة العمليات التي تمت داخل المكتب حسب المستخدم والنوع والوقت.
          </p>
        </div>

        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn btn-primary w-fit"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'كل الأنشطة', value: stats.total, icon: ActivityIcon },
          { label: 'اليوم', value: stats.today, icon: CalendarClock },
          { label: 'أمان وجلسات', value: stats.security, icon: ShieldCheck },
          { label: 'حركات مالية', value: stats.finance, icon: ReceiptText },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text)' }}>
                  {stat.value}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5">
                <stat.icon className="h-5 w-5" style={{ color: 'var(--sidebar)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في النشاط..."
                className="input w-72 pr-9"
              />
            </div>

            <button
              type="button"
              onClick={() => load()}
              className="btn"
              title="بحث"
            >
              بحث
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input w-44"
              aria-label="فلترة نوع النشاط"
            >
              {TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🧾" title="لا توجد أنشطة" sub="ستظهر العمليات هنا بعد تنفيذ أي إجراء داخل المكتب" />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>النشاط</th>
                  <th>المستخدم</th>
                  <th>الكيان</th>
                  <th>الوقت</th>
                  <th>IP</th>
                  <th>فتح</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((activity) => {
                  const href = entityHref(activity)

                  return (
                    <tr key={activity.id}>
                      <td>
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-black/5">
                            <FileText className="h-4 w-4" style={{ color: 'var(--sidebar)' }} />
                          </div>
                          <div>
                            <p className="font-black" style={{ color: 'var(--text)' }}>
                              {activity.title || activityLabel(activity.type)}
                            </p>
                            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                              {activity.message || activityLabel(activity.type)}
                            </p>
                            <span className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold bg-black/5">
                              {activityLabel(activity.type)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center gap-2">
                          <UserRound className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
                          <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                              {activity.actor?.name ?? 'النظام'}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                              {activity.actor?.email ?? '-'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="rounded-full px-2 py-1 text-xs font-bold bg-black/5">
                          {entityLabel(activity.entityType)}
                        </span>
                      </td>

                      <td>
                        <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                          {formatDate(activity.createdAt)}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {formatTime(activity.createdAt)}
                        </div>
                      </td>

                      <td>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {activity.ipAddress ?? '-'}
                        </span>
                      </td>

                      <td>
                        {href ? (
                          <Link href={href} className="btn text-xs">
                            فتح
                          </Link>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                            -
                          </span>
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
