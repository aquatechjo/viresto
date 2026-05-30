'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const TIMEOUT_MS = 60 * 60 * 1000
const WARNING_MS = 10 * 60 * 1000

export default function SessionGuard() {
  const router = useRouter()

  const logoutTimer = useRef<NodeJS.Timeout | null>(null)
  const warningTimer = useRef<NodeJS.Timeout | null>(null)
  const lastActivitySync = useRef(0)
  const [showWarning, setShowWarning] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
    })

    router.replace('/login')
  }

  function clearTimers() {
    if (logoutTimer.current) clearTimeout(logoutTimer.current)
    if (warningTimer.current) clearTimeout(warningTimer.current)
  }

function resetTimer() {
  clearTimers()
  setShowWarning(false)

  const now = Date.now()

  if (now - lastActivitySync.current > 60 * 1000) {
    lastActivitySync.current = now

    fetch('/api/auth/session/activity', {
      method: 'POST',
    }).catch(() => {})
  }

  warningTimer.current = setTimeout(() => {
    setShowWarning(true)
  }, TIMEOUT_MS - WARNING_MS)

  logoutTimer.current = setTimeout(() => {
    logout()
  }, TIMEOUT_MS)
}

  useEffect(() => {
    resetTimer()

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

    events.forEach((event) => {
      window.addEventListener(event, resetTimer)
    })

    return () => {
      clearTimers()

      events.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [])

  return showWarning ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-2xl">
          ⚠️
        </div>

        <h2 className="text-xl font-black">
          الجلسة على وشك الانتهاء
        </h2>

        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          سيتم تسجيل خروجك تلقائيًا خلال دقيقة بسبب عدم النشاط.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={resetTimer}
            className="btn btn-primary flex-1"
          >
            تمديد الجلسة
          </button>

          <button
            type="button"
            onClick={logout}
            className="btn flex-1"
          >
            تسجيل الخروج الآن
          </button>
        </div>
      </div>
    </div>
  ) : null
}