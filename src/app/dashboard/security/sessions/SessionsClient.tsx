'use client'

import { useEffect, useState } from 'react'
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

export default function SessionsClient() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SessionItem[]>([])

  async function revokeOtherSessions() {
    await fetch('/api/auth/session/revoke-others', {
      method: 'POST',
    })

    load()
  }

  async function revokeSession(sessionId: string) {
    await fetch('/api/auth/session/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    })

    load()
  }

  async function load() {
    setLoading(true)

    const res = await fetch('/api/auth/session/list')
    const data = await res.json()

    setSessions(data.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">
          الأجهزة والجلسات النشطة
        </h1>

        <p
          className="text-sm mt-1"
          style={{ color: 'var(--muted)' }}
        >
          إدارة الأجهزة والجلسات المتصلة بحسابك
        </p>

        <button
  type="button"
  onClick={revokeOtherSessions}
  className="mt-4 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-50"
>
  إنهاء جميع الجلسات الأخرى
</button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon="💻"
          title="لا توجد جلسات"
          sub="لا توجد جلسات نشطة حاليًا"
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`card p-5 border transition-all ${
                session.isCurrent
                  ? 'border-green-300 bg-green-50/40'
                  : 'border-[var(--border)]'
              }`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">
                      {session.isCurrent
                        ? '🟢 الجلسة الحالية'
                        : '🖥️ جهاز متصل'}
                    </span>

                    {session.isCurrent && (
                      <span className="rounded-full bg-green-600 text-white text-[10px] px-2 py-1 font-bold">
                        CURRENT
                      </span>
                    )}
                  </div>

                  <div
                    className="text-sm break-all"
                    style={{ color: 'var(--muted)' }}
                  >
                    {parseDevice(session.userAgent)}
                  </div>

                  <div
                    className="text-sm"
                    style={{ color: 'var(--muted)' }}
                  >
                    IP: {session.ipAddress || 'Unknown'}
                    {(session.country || session.city) && (
                    <div
                    className="text-sm"
                    style={{ color: 'var(--muted)' }}
                    >
                    🌍 {session.city || 'Unknown City'}
                    {session.country ? `, ${session.country}` : ''}
                    </div>
                          )}
                  </div>
                </div>

<div className="text-sm text-right space-y-1">
  <div>
    <span
      style={{ color: 'var(--muted)' }}
    >
      آخر نشاط:
    </span>

    <div className="font-bold">
      {formatDate(session.lastActivityAt)}
    </div>
  </div>

  <div>
    <span
      style={{ color: 'var(--muted)' }}
    >
      تسجيل الدخول:
    </span>

    <div className="font-bold">
      {formatDate(session.createdAt)}
    </div>
  </div>

  {!session.isCurrent && (
    <button
      type="button"
      onClick={() => revokeSession(session.id)}
      className="mt-4 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-50"
    >
      تسجيل الخروج من هذا الجهاز
    </button>
  )}
</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}