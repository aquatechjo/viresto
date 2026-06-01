'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import PageLoader from '@/components/ui/PageLoader'
import StatCard from '@/components/ui/StatCard'
import { formatCurrency, formatTime } from '@/lib/utils'

const RevenueChart = dynamic(() => import('@/components/dashboard/RevenueChart'), {
  ssr: false,
  loading: () => (
    <div className="card p-6 min-h-[360px] flex items-center justify-center">
      <span className="spinner spinner-sm" />
    </div>
  ),
})

const AIAssistant = dynamic(() => import('@/components/dashboard/AIAssistant'), {
  ssr: false,
  loading: () => (
    <div className="card p-6 min-h-[360px] flex items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>
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
  client: { name: string }


}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge badge-green',
  IN_PROGRESS: 'badge badge-blue',
  CLOSED: 'badge badge-gray',
  ARCHIVED: 'badge badge-gray',
}

const STATUS_AR: Record<string, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'جارية',
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

function MiniCalendar({ appts }: { appts: { startTime: string }[] }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const name = new Intl.DateTimeFormat('ar-SA', {
    month: 'long',
    year: 'numeric',
  }).format(today)

  const first = new Date(year, month, 1).getDay()
  const total = new Date(year, month + 1, 0).getDate()
  const days = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب']
const busy = useMemo(
  () =>
    new Set(
      Array.isArray(appts)
        ? appts.map((a) => new Date(a.startTime).getDate())
        : []
    ),
  [appts]
)
  

  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ]

  return (
    <div>
      <p className="text-center font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>
        {name}
      </p>

      <div className="grid grid-cols-7 mb-1">
        {days.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-bold py-1"
            style={{ color: 'var(--text-3)' }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => (
          <div key={i} className="aspect-square flex flex-col items-center justify-center relative">
            {d && (
              <>
                <span
                  className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold ${
                    d === today.getDate() ? 'text-white font-black' : ''
                  }`}
                  style={
                    d === today.getDate()
                      ? { background: 'var(--sidebar)' }
                      : { color: 'var(--text)' }
                  }
                >
                  {d}
                </span>

                {busy.has(d) && d !== today.getDate() && (
                  <span
                    className="absolute bottom-0 w-1 h-1 rounded-full"
                    style={{ background: 'var(--sidebar)' }}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
    
  const [stats, setStats] = useState<Stats | null>(null)
  const [cases, setCases] = useState<CaseItem[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<any[]>([])
  
useEffect(() => {
  async function loadDashboard() {
    try {
      const rs = await Promise.all([
        fetch('/api/dashboard-stats'),
        fetch('/api/cases?limit=4'),
        fetch('/api/activity?limit=8'),
        fetch('/api/documents?limit=5'),
      ])

      const json = await Promise.all(
        rs.map(async (r) => {
          if (!r.ok) {
            console.warn('Dashboard API failed:', r.url, r.status)
            return { data: [] }
          }

          try {
            return await r.json()
          } catch {
            return { data: [] }
          }
        })
      )

      const [s, c, a, d] = json

      setStats(s.data || null)

      setCases(
        Array.isArray(c.data)
          ? c.data.slice(0, 4)
          : []
      )

      setActivities(
        Array.isArray(a.data)
          ? a.data
          : []
      )

      setDocuments(
        Array.isArray(d.data)
          ? d.data.slice(0, 5)
          : []
      )
    } catch (err) {
      console.error('Dashboard load failed:', err)

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

const documentStats = useMemo(
  () => [
    {
      title: 'إجمالي المستندات',
      value: documents.length,
      icon: '📁',
    },
    {
      title: 'ملفات PDF',
      value: documents.filter((d) => d.fileType === 'application/pdf').length,
      icon: '📄',
    },
    {
      title: 'الصور',
      value: documents.filter((d) => d.fileType?.startsWith('image/')).length,
      icon: '🖼️',
    },
    {
      title: 'العقود',
      value: documents.filter((d) => d.tags?.includes('عقد')).length,
      icon: '⚖️',
    },
  ],
  [documents]
)

const recentDocuments = useMemo(() => documents.slice(0, 5), [documents])

return (
  <div className="space-y-5 stagger">
    <div className="relative z-[99999]">
      <DashboardHeader />

    </div>


      {/* Main Stats */}
      <div className="relative z-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="الموكلون"
          value={stats?.clientCount ?? 0}
          sub={`+${stats?.newClientsThisMonth ?? 0} هذا الشهر`}
        />

        <StatCard
          label="القضايا النشطة"
          value={stats?.activeCaseCount ?? 0}
          sub="قيد المتابعة"
        />
        
        

<StatCard
  label="مواعيد اليوم"
  value={stats?.todayApptCount ?? 0}
  sub={
    stats?.todayAppts?.[0]
      ? `أقرب موعد: ${formatTime(stats.todayAppts[0].startTime)}`
      : 'لا مواعيد اليوم'
  }
/>
<StatCard
  label="أقرب موعد"
  value={
    stats?.todayAppts?.[0]
      ? stats.todayAppts[0].title
      : 'لا يوجد'
  }
  sub={
    stats?.todayAppts?.[0]
      ? `${formatTime(stats.todayAppts[0].startTime)}`
      : 'لا توجد مواعيد قادمة'
  }
/>

        <StatCard
          label="المستحقات"
          value={formatCurrency(stats?.pendingAmount ?? 0)}
          sub="غير محصلة"
          bg="var(--red-soft)"
          color="#dc2626"
        />
      </div>

      <div className="card p-5 mb-4">
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
      آخر المستندات
    </h3>
    <span className="text-sm" style={{ color: 'var(--text-2)' }}>
      آخر 5 ملفات مرفوعة
    </span>
  </div>

  <div className="space-y-3">
    {recentDocuments.length === 0 ? (
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>
        لا يوجد مستندات بعد
      </p>
    ) : (
      recentDocuments.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between rounded-2xl border p-3"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--card)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'var(--green-soft)' }}
            >
              {doc.fileType === 'application/pdf'
                ? '📄'
                : doc.fileType?.startsWith('image/')
                ? '🖼️'
                : '📁'}
            </div>

            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                {doc.fileName}
              </p>

              <div className="mt-1 flex flex-wrap gap-1">
                {doc.tags?.slice(0, 3).map((tag: string) => (
                  <span
                    key={tag}
                    className={`rounded-full border px-2 py-1 text-[10px] `}
                    style={{
                      background: 'var(--green-soft)',
                      color: 'var(--sidebar)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
            {new Date(doc.createdAt).toLocaleDateString('ar-JO')}
          </span>
        </div>
      ))
    )}
  </div>
</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
  {documentStats.map((item) => (
    <div
      key={item.title}
      className="card p-5 flex items-center justify-between"
    >
      <div>
        <p
          className="text-sm mb-1"
          style={{ color: 'var(--text-2)' }}
        >
          {item.title}
        </p>

        <h3
          className="text-3xl font-black"
          style={{ color: 'var(--text)' }}
        >
          {item.value}
        </h3>
      </div>

      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
        style={{
          background: 'var(--green-soft)',
        }}
      >
        {item.icon}
      </div>
    </div>
  ))}
</div>

      {/* Revenue + AI */}
<div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
  <div className="xl:col-span-2 min-h-[360px]">
    <RevenueChart />
  </div>

  <AIAssistant />
</div>

      {/* Daily Work */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's Appointments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/dashboard/appointments"
              className="btn btn-primary"
              style={{ fontSize: '.72rem', padding: '.25rem .75rem' }}
            >
              + إضافة
            </Link>

            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              مواعيد اليوم
            </p>
          </div>

          {!stats?.todayAppts?.length ? (
            <p className="text-center py-6 text-sm" style={{ color: 'var(--text-3)' }}>
              لا مواعيد اليوم
            </p>
          ) : (
            <div className="space-y-3">
              {Array.isArray(stats?.todayAppts) && stats.todayAppts.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div
                    className="w-1 rounded-full shrink-0 self-stretch"
                    style={{
                      background: TYPE_COLOR[a.type] ?? 'var(--text-3)',
                      minHeight: 40,
                    }}
                  />

                  <div>
                    <p className="font-black text-sm" style={{ color: 'var(--text)' }}>
                      {formatTime(a.startTime)}
                    </p>

<div className="flex items-center gap-2">
  <p
    className="text-sm font-medium"
    style={{ color: 'var(--text)' }}
  >
    {a.title}
  </p>
</div>

                    {a.location && (
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {a.location}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="card p-5">
          <MiniCalendar appts={stats?.todayAppts ?? []} />
        </div>

        {/* Recent Cases */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/dashboard/cases"
              className="btn btn-ghost"
              style={{ fontSize: '.72rem', padding: '.2rem .7rem' }}
            >
              عرض الكل
            </Link>

            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              آخر القضايا
            </p>
          </div>

          {cases.length === 0 ? (
            <p className="text-center py-6 text-sm" style={{ color: 'var(--text-3)' }}>
              لا توجد قضايا
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs" style={{ color: 'var(--text-3)' }}>
                  <th className="text-right pb-2 font-bold">الحالة</th>
                  <th className="text-right pb-2 font-bold">الموكل</th>
                  <th className="text-right pb-2 font-bold">رقم</th>
                </tr>
              </thead>

              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2.5">
                      <span className={STATUS_BADGE[c.status]}>
                        {STATUS_AR[c.status]}
                      </span>
                    </td>

                    <td className="py-2.5 font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      {c.client.name.split(' ').slice(0, 2).join(' ')}
                    </td>

                    <td className="py-2.5 text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                      #{c.caseNumber?.split('/').pop() ?? c.id.slice(-4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>       
      </div>

      {/* Activity Timeline */}
<div className="card p-5">
  <div className="flex items-center justify-between mb-5">
    <h3 className="text-lg font-black">
      آخر النشاطات
    </h3>

    <Link
      href="/dashboard/activity"
      className="text-sm font-semibold hover:underline"
      style={{ color: 'var(--sidebar)' }}
    >
      عرض الكل
    </Link>
  </div>

  <div className="space-y-3">

    {activities.length === 0 && (
      <div
        className="rounded-2xl border border-dashed p-6 text-center text-sm"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--text-3)',
        }}
      >
        لا توجد نشاطات حالياً
      </div>
    )}

    {Array.isArray(activities) && activities.map((a) => {
const configMap = {
  CLIENT_CREATED: {
    icon: '👤',
    color: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
    link: '/dashboard/clients',
    label: 'موكل',
  },

  CASE_CREATED: {
    icon: '⚖️',
    color: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
    link: '/dashboard/cases',
    label: 'قضية',
  },

  APPOINTMENT_CREATED: {
    icon: '📅',
    color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
    link: '/dashboard/appointments',
    label: 'موعد',
  },

  PAYMENT_CREATED: {
    icon: '💰',
    color: 'bg-green-500/20 text-green-700 border-green-500/30',
    link: '/dashboard/payments',
    label: 'دفعة',
  },

  DOCUMENT_UPLOADED: {
    icon: '📄',
    color: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
    link: '/dashboard/documents',
    label: 'مستند',
  },

  USER_CREATED: {
    icon: '👥',
    color: 'bg-cyan-500/20 text-cyan-700 border-cyan-500/30',
    link: '/dashboard/team',
    label: 'مستخدم',
  },
}

const config = configMap[a.type as keyof typeof configMap] ?? {
  icon: '✨',
  color: 'bg-white/10 text-white border-white/10',
  link: '#',
}

      return (
        <Link
          key={a.id}
          href={config.link}
          className={`flex items-start gap-3 rounded-2xl border p-4 transition-all hover:scale-[1.01] ${config.color}`}
        >
          <div className="text-2xl">
            {config.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold truncate">
                {a.title}
              </p>

              <span className="text-xs opacity-70 whitespace-nowrap">
                {new Date(a.createdAt).toLocaleDateString('ar-SA')}
              </span>
            </div>

            {a.message && (
              <p className="text-sm opacity-80 mt-1 truncate">
                {a.message}
              </p>
            )}
          </div>
        </Link>
      )
    })}
  </div>
</div>

      {/* Reports Summary */}
      <div className="card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex gap-6">
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
              إجمالي الإيرادات
            </p>

            <p className="text-2xl font-black mt-0.5" style={{ color: 'var(--sidebar)' }}>
              {formatCurrency(stats?.totalRevenue ?? 0)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
              المستحق
            </p>

            <p className="text-2xl font-black mt-0.5 text-red-500">
              {formatCurrency(stats?.pendingAmount ?? 0)}
            </p>
          </div>
        </div>

        <Link href="/dashboard/reports" className="btn btn-ghost">
          عرض التقارير الكاملة
        </Link>
      </div>
    </div>
  )
}