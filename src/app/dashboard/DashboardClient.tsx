'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'
import StatCard from '@/components/ui/StatCard'
import { formatCurrency, formatTime } from '@/lib/utils'

const AIAssistant = dynamic(() => import('@/components/dashboard/AIAssistant'), {
  ssr: false,
  loading: () => (
    <div
      className="card p-6 min-h-[300px] h-full flex items-center justify-center text-sm"
      style={{ color: 'var(--text-3)' }}
    >
      جاري تحميل المساعد...
    </div>
  ),
})

interface Stats {
  clientCount: number
  activeCaseCount: number
  totalCasesCount: number
  closedCasesCount: number
  closedCaseRate: number
  monthlyRevenue: number
  todayApptCount: number
  totalRevenue: number
  pendingAmount: number
  newClientsThisMonth: number
  todayAppts: {
    id: string
    title: string
    startTime: string
    location?: string
    type: string
  }[]
}

interface CaseItem {
  id: string
  title: string
  caseNumber?: string
  status: string
  client?: {
    name: string
  }
}

interface DocumentItem {
  id: string
  fileName: string
  fileType?: string
  createdAt: string
  tags?: string[]
}

interface ActivityItem {
  id: string
  type: string
  title: string
  message?: string
  createdAt: string
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

const TYPE_COLOR: Record<string, string> = {
  COURT_SESSION: 'var(--sidebar)',
  MEETING: '#2563eb',
  PHONE_CALL: 'var(--gold)',
  DEADLINE: '#dc2626',
  OTHER: 'var(--text-3)',
}

const ACTIVITY_CONFIG: Record<
  string,
  {
    icon: string
    color: string
  }
> = {
  CLIENT_CREATED: {
    icon: '👤',
    color: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  },
  CASE_CREATED: {
    icon: '⚖️',
    color: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  },
  APPOINTMENT_CREATED: {
    icon: '📅',
    color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  },
  PAYMENT_CREATED: {
    icon: '💰',
    color: 'bg-green-500/20 text-green-700 border-green-500/30',
  },
  DOCUMENT_UPLOADED: {
    icon: '📄',
    color: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  },
  USER_CREATED: {
    icon: '👥',
    color: 'bg-cyan-500/20 text-cyan-700 border-cyan-500/30',
  },
}

function getDocumentIcon(fileType?: string) {
  if (fileType === 'application/pdf') return '📄'
  if (fileType?.startsWith('image/')) return '🖼️'
  return '📁'
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ar-JO')
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [cases, setCases] = useState<CaseItem[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const responses = await Promise.all([
          fetch('/api/dashboard-stats'),
          fetch('/api/cases?limit=4'),
          fetch('/api/activity?limit=5'),
          fetch('/api/documents?limit=5'),
        ])

        const json = await Promise.all(
          responses.map(async (response) => {
            if (!response.ok) {
              console.warn('Dashboard API failed:', response.url, response.status)
              return { data: [] }
            }

            try {
              return await response.json()
            } catch {
              return { data: [] }
            }
          })
        )

        const [statsData, casesData, activitiesData, documentsData] = json

        setStats(statsData.data || null)
        setCases(Array.isArray(casesData.data) ? casesData.data.slice(0, 4) : [])
        setActivities(Array.isArray(activitiesData.data) ? activitiesData.data.slice(0, 5) : [])
        setDocuments(Array.isArray(documentsData.data) ? documentsData.data.slice(0, 5) : [])
      } catch (error) {
        console.error('Dashboard load failed:', error)

        setStats(null)
        setCases([])
        setActivities([])
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const recentDocuments = useMemo(() => documents.slice(0, 5), [documents])
  const firstAppointment = stats?.todayAppts?.[0]

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 stagger">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6 md:p-7"
        style={{
          background:
            'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 55%, var(--sidebar-dark) 100%)',
          borderColor: 'rgba(255,255,255,0.12)',
          boxShadow: '0 22px 60px rgba(45, 74, 62, 0.22)',
        }}
      >
        <div
          className="absolute -left-16 -top-16 h-44 w-44 rounded-full"
          style={{ background: 'rgba(245, 200, 66, 0.18)' }}
        />

        <div
          className="absolute -bottom-20 right-12 h-56 w-56 rounded-full"
          style={{ background: 'rgba(255, 255, 255, 0.08)' }}
        />

        <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_.75fr] lg:items-center">
          <div>
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.13)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <span>⚖️</span>
              <span>لوحة إدارة المكتب القانوني</span>
            </div>

            <h1 className="text-2xl font-black leading-relaxed text-white md:text-3xl">
              إدارة القضايا والموكلين من مكان واحد
            </h1>

<p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/75">
  مركز تحكم شامل لمتابعة أداء المكتب القانوني، من القضايا والمواعيد إلى
  المستندات والموكلين والمؤشرات المالية، بواجهة واضحة تساعدك على إدارة العمل بثقة.
</p>
          </div>

          <div
            className="rounded-3xl p-5"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.18)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <p className="text-sm font-black text-white">ملخص اليوم</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <p className="text-xs font-bold text-white/65">مواعيد اليوم</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {stats?.todayApptCount ?? 0}
                </p>
              </div>

              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <p className="text-xs font-bold text-white/65">قضايا نشطة</p>
                <p className="mt-1 text-2xl font-black text-white">
                  {stats?.activeCaseCount ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="relative z-0 grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="الموكلون"
          value={stats?.clientCount ?? 0}
          sub={`+${stats?.newClientsThisMonth ?? 0} هذا الشهر`}
        />

        <StatCard
          label="أقرب موعد"
          value={firstAppointment ? firstAppointment.title : 'لا يوجد'}
          sub={
            firstAppointment
              ? `${formatTime(firstAppointment.startTime)}`
              : 'لا توجد مواعيد قادمة'
          }
        />

        <StatCard
          label="المستحقات"
          value={formatCurrency(stats?.pendingAmount ?? 0)}
          sub="غير محصلة"
          bg={(stats?.pendingAmount ?? 0) > 0 ? 'var(--red-soft)' : undefined}
          color={(stats?.pendingAmount ?? 0) > 0 ? '#dc2626' : undefined}
        />
      </div>

      {/* AI + Cases + Appointments */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <div className="min-h-[300px] h-full [&>*]:h-full">
          <AIAssistant />
        </div>

        {/* Recent Cases */}
        <div className="card p-5 min-h-[300px] h-full">
          <div className="mb-4">
            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              آخر القضايا
            </p>

            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              أحدث القضايا المسجلة في المكتب
            </p>
          </div>

          {cases.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--text-3)' }}>
              لا توجد قضايا
            </p>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border p-3"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={STATUS_BADGE[c.status] ?? 'badge badge-gray'}>
                      {STATUS_AR[c.status] ?? c.status}
                    </span>

                    <p className="text-sm font-black truncate" style={{ color: 'var(--text)' }}>
                      {c.title}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                      {c.client?.name ?? 'بدون موكل'}
                    </p>

                    <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                      #{c.caseNumber?.split('/').pop() ?? c.id.slice(-4)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Appointments */}
        <div className="card p-5 min-h-[300px] h-full">
          <div className="mb-4">
            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              مواعيد اليوم
            </p>

            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              جدول مواعيد اليوم فقط
            </p>
          </div>

          {!stats?.todayAppts?.length ? (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--text-3)' }}>
              لا مواعيد اليوم
            </p>
          ) : (
            <div className="space-y-4">
              {stats.todayAppts.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div
                    className="w-1 rounded-full shrink-0 self-stretch"
                    style={{
                      background: TYPE_COLOR[a.type] ?? 'var(--text-3)',
                      minHeight: 44,
                    }}
                  />

                  <div className="min-w-0">
                    <p className="font-black text-sm" style={{ color: 'var(--text)' }}>
                      {formatTime(a.startTime)}
                    </p>

                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {a.title}
                    </p>

                    {a.location && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                        {a.location}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Documents + Office Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Documents */}
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4">
            <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
              آخر المستندات
            </h3>

            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
              آخر 5 ملفات مرفوعة في النظام
            </p>
          </div>

          <div className="space-y-3">
            {recentDocuments.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-3)' }}>
                لا يوجد مستندات بعد
              </p>
            ) : (
              recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border p-3"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: 'var(--green-soft)' }}
                    >
                      {getDocumentIcon(doc.fileType)}
                    </div>

                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold truncate"
                        style={{ color: 'var(--text)' }}
                      >
                        {doc.fileName}
                      </p>

                      {!!doc.tags?.length && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {doc.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border px-2 py-1 text-[10px]"
                              style={{
                                background: 'var(--green-soft)',
                                color: 'var(--sidebar)',
                                borderColor: 'transparent',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-xs shrink-0" style={{ color: 'var(--text-3)' }}>
                    {formatDate(doc.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Office Summary */}
        <div className="card p-5">
          <div className="mb-5">
            <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
              ملخص المكتب
            </h3>

            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
              نظرة رقمية مختصرة على الأداء
            </p>
          </div>

          <div className="space-y-3">
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                إجمالي القضايا
              </p>

              <p className="text-2xl font-black mt-1" style={{ color: 'var(--text)' }}>
                {stats?.totalCasesCount ?? 0}
              </p>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                القضايا المغلقة
              </p>

              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="text-2xl font-black" style={{ color: 'var(--text)' }}>
                  {stats?.closedCasesCount ?? 0}
                </p>

                <span className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                  {stats?.closedCaseRate ?? 0}%
                </span>
              </div>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                إيرادات الشهر
              </p>

              <p className="text-2xl font-black mt-1" style={{ color: 'var(--sidebar)' }}>
                {formatCurrency(stats?.monthlyRevenue ?? 0)}
              </p>
            </div>

            <div
  className="rounded-2xl border p-4"
  style={{ borderColor: 'var(--border)' }}
>
  <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
    إجمالي الإيرادات
  </p>

  <p className="text-2xl font-black mt-1" style={{ color: 'var(--sidebar)' }}>
    {formatCurrency(stats?.totalRevenue ?? 0)}
  </p>
</div>

          </div>
        </div>
      </div>

{/* Activity Timeline */}
<div className="card p-5">
  <div className="mb-4">
    <h3 className="text-lg font-black" style={{ color: 'var(--text)' }}>
      آخر النشاطات
    </h3>

    <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
      آخر 5 عمليات مسجلة داخل المكتب
    </p>
  </div>

  {activities.length === 0 ? (
    <div
      className="rounded-2xl border border-dashed p-6 text-center text-sm"
      style={{
        borderColor: 'var(--border)',
        color: 'var(--text-3)',
      }}
    >
      لا توجد نشاطات حالياً
    </div>
  ) : (
    <div className="space-y-3">
      {activities.slice(0, 5).map((activity) => {
        const config = ACTIVITY_CONFIG[activity.type] ?? {
          icon: '✨',
          color: '',
        }

        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 rounded-2xl border p-4"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--green-soft)',
              color: 'var(--text)',
            }}
          >
            <div className="text-xl shrink-0">
              {config.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold truncate">
                  {activity.title}
                </p>

                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                  {formatDate(activity.createdAt)}
                </span>
              </div>

              {activity.message && (
                <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-2)' }}>
                  {activity.message}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )}
</div>
    </div>
  )
}