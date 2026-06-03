'use client'

import { useEffect, useMemo, useState } from 'react'

import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'
import { parseDevice } from '@/lib/device'

interface SessionItem {
  id: string
  ipAddress?: string
  userAgent?: string
  country?: string
  city?: string
  lastActivityAt: string
  createdAt: string
  isCurrent: boolean
}

function getLocation(session: SessionItem) {
  if (session.city && session.country) return `${session.city}, ${session.country}`
  if (session.city) return session.city
  if (session.country) return session.country
  return 'غير معروف'
}

function getSessionRisk(session: SessionItem) {
  if (!session.ipAddress || session.ipAddress === 'Unknown') return 'medium'
  if (!session.userAgent) return 'medium'
  return 'low'
}

function riskLabel(risk: string) {
  if (risk === 'high') return 'مرتفع'
  if (risk === 'medium') return 'متوسط'
  return 'منخفض'
}

function riskBadge(risk: string) {
  if (risk === 'high') return 'badge badge-red'
  if (risk === 'medium') return 'badge badge-amber'
  return 'badge badge-green'
}

export default function SessionsClient() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    try {
      setLoading(true)

      const res = await fetch('/api/auth/session/list', {
        cache: 'no-store',
      })

      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      const data = await res.json().catch(() => ({}))

      if (res.ok && data.success !== false) {
        setSessions(Array.isArray(data.data) ? data.data : [])
      } else {
        setSessions([])
      }
    } catch (error) {
      console.error('Sessions load failed:', error)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  async function revokeOtherSessions() {
    const confirmed = window.confirm(
      'هل أنت متأكد من إنهاء جميع الجلسات الأخرى؟ سيتم تسجيل خروج كل الأجهزة باستثناء جهازك الحالي.'
    )

    if (!confirmed) return

    try {
      setActionLoading('others')

      const res = await fetch('/api/auth/session/revoke-others', {
        method: 'POST',
      })

      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      await load()
    } finally {
      setActionLoading(null)
    }
  }

  async function revokeSession(sessionId: string) {
    const confirmed = window.confirm('هل تريد تسجيل الخروج من هذا الجهاز؟')
    if (!confirmed) return

    try {
      setActionLoading(sessionId)

      const res = await fetch('/api/auth/session/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      })

      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      await load()
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return sessions

    return sessions.filter((session) => {
      const device = parseDevice(session.userAgent).toLowerCase()
      const ip = session.ipAddress?.toLowerCase() || ''
      const country = session.country?.toLowerCase() || ''
      const city = session.city?.toLowerCase() || ''

      return (
        device.includes(query) ||
        ip.includes(query) ||
        country.includes(query) ||
        city.includes(query)
      )
    })
  }, [sessions, search])

  const stats = useMemo(() => {
    const current = sessions.filter((session) => session.isCurrent).length
    const others = sessions.filter((session) => !session.isCurrent).length
    const unknownIp = sessions.filter(
      (session) => !session.ipAddress || session.ipAddress === 'Unknown'
    ).length

    const locations = new Set(
      sessions.map((session) => getLocation(session)).filter((location) => location !== 'غير معروف')
    )

    return {
      total: sessions.length,
      current,
      others,
      unknownIp,
      locations: locations.size,
    }
  }, [sessions])

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
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              Active Sessions
            </div>

            <h1 className="text-2xl font-black text-white">
              الأجهزة والجلسات النشطة
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              راقب الأجهزة المتصلة بحسابك، وتحقق من آخر نشاط، وأنهِ أي جلسة غير معروفة لحماية الحساب.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              className="btn"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
                borderColor: 'rgba(255,255,255,0.32)',
              }}
            >
              تحديث
            </button>

            <button
              type="button"
              onClick={revokeOtherSessions}
              disabled={actionLoading === 'others' || stats.others === 0}
              className="btn"
              style={{
                background: 'rgba(239,68,68,0.18)',
                color: '#fff',
                borderColor: 'rgba(239,68,68,0.32)',
              }}
            >
              {actionLoading === 'others'
                ? 'جاري الإنهاء...'
                : 'إنهاء الجلسات الأخرى'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'إجمالي الجلسات',
            value: stats.total,
            hint: 'كل الأجهزة المتصلة',
            bg: 'var(--card)',
            color: 'var(--text)',
          },
          {
            label: 'الجلسة الحالية',
            value: stats.current,
            hint: 'هذا الجهاز',
            bg: 'var(--green-soft)',
            color: 'var(--sidebar)',
          },
          {
            label: 'أجهزة أخرى',
            value: stats.others,
            hint: 'جلسات يمكن إنهاؤها',
            bg: stats.others > 0 ? 'var(--amber-soft)' : 'var(--card)',
            color: stats.others > 0 ? '#92400e' : 'var(--text)',
          },
          {
            label: 'مواقع مختلفة',
            value: stats.locations,
            hint: 'حسب بيانات IP',
            bg: 'var(--card)',
            color: 'var(--text)',
          },
          {
            label: 'IP غير معروف',
            value: stats.unknownIp,
            hint: 'يحتاج مراجعة',
            bg: stats.unknownIp > 0 ? 'var(--red-soft)' : 'var(--card)',
            color: stats.unknownIp > 0 ? '#dc2626' : 'var(--text)',
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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالجهاز، المتصفح، IP، الدولة أو المدينة..."
            className="input"
          />

          <button
            type="button"
            onClick={() => setSearch('')}
            className="btn btn-ghost whitespace-nowrap"
          >
            مسح البحث
          </button>
        </div>
      </div>

      {/* Security Note */}
      {stats.others > 0 && (
        <div
          className="rounded-[24px] border p-4 text-sm font-bold leading-7"
          style={{
            borderColor: '#fbbf24',
            background: 'var(--amber-soft)',
            color: '#92400e',
          }}
        >
          يوجد {stats.others} جلسة أخرى نشطة. إذا كنت لا تتعرف على أي جهاز، أنهِ الجلسة فورًا وغيّر كلمة المرور.
        </div>
      )}

      {/* Sessions */}
      {filteredSessions.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="💻"
            title="لا توجد جلسات"
            sub={
              sessions.length === 0
                ? 'لا توجد جلسات نشطة حاليًا.'
                : 'لا توجد جلسات مطابقة للبحث الحالي.'
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div
            className="flex flex-col gap-2 border-b px-5 py-4 md:flex-row md:items-center md:justify-between"
            style={{ borderColor: 'var(--border)' }}
          >
            <div>
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                قائمة الجلسات
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {filteredSessions.length} جلسة ظاهرة من أصل {sessions.length}
              </p>
            </div>

            <span className={stats.others > 0 ? 'badge badge-amber' : 'badge badge-green'}>
              {stats.others > 0 ? 'يوجد أجهزة أخرى' : 'هذا الجهاز فقط'}
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filteredSessions.map((session) => {
              const risk = getSessionRisk(session)
              const device = parseDevice(session.userAgent)

              return (
                <div
                  key={session.id}
                  className="p-5 transition-all hover:bg-black/[0.02]"
                  style={{
                    background: session.isCurrent ? 'var(--green-soft)' : 'transparent',
                  }}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
                        style={{
                          background: session.isCurrent ? '#fff' : 'var(--input-bg)',
                          color: 'var(--sidebar)',
                        }}
                      >
                        {session.isCurrent ? '🟢' : '🖥️'}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="font-black" style={{ color: 'var(--text)' }}>
                            {session.isCurrent ? 'الجلسة الحالية' : 'جهاز متصل'}
                          </span>

                          {session.isCurrent && (
                            <span className="badge badge-green">
                              Current
                            </span>
                          )}

                          <span className={riskBadge(risk)}>
                            خطورة {riskLabel(risk)}
                          </span>
                        </div>

                        <p className="break-words text-sm font-bold" style={{ color: 'var(--text-2)' }}>
                          {device || 'جهاز غير معروف'}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                          <span
                            className="rounded-full px-3 py-1"
                            style={{
                              background: session.isCurrent ? '#fff' : 'var(--input-bg)',
                              color: 'var(--text-3)',
                            }}
                          >
                            IP: {session.ipAddress || 'Unknown'}
                          </span>

                          <span
                            className="rounded-full px-3 py-1"
                            style={{
                              background: session.isCurrent ? '#fff' : 'var(--input-bg)',
                              color: 'var(--text-3)',
                            }}
                          >
                            🌍 {getLocation(session)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-[220px] space-y-3 text-sm xl:text-left">
                      <div>
                        <span style={{ color: 'var(--text-3)' }}>آخر نشاط:</span>
                        <div className="font-black" style={{ color: 'var(--text)' }}>
                          {formatDate(session.lastActivityAt)}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-3)' }}>تسجيل الدخول:</span>
                        <div className="font-black" style={{ color: 'var(--text)' }}>
                          {formatDate(session.createdAt)}
                        </div>
                      </div>

                      {!session.isCurrent && (
                        <button
                          type="button"
                          onClick={() => revokeSession(session.id)}
                          disabled={actionLoading === session.id}
                          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionLoading === session.id
                            ? 'جاري الإنهاء...'
                            : 'تسجيل الخروج من هذا الجهاز'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}