'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  Settings,
  CreditCard,
  LogOut,
  ChevronDown,
} from 'lucide-react'

interface UserType {
  name: string
  email: string
}

export default function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<UserType | null>(null)

  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setUser(d.data)
      })
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)

    return () => {
      document.removeEventListener('mousedown', handler)
    }
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
    })

    router.push('/login')
  }

  return (
    <div className="relative" ref={ref}>
<button
  type="button"
  onClick={() => setOpen(!open)}
  className="
    flex h-12 min-w-[235px] items-center gap-3
    rounded-2xl
    border border-slate-200
    bg-white
    px-3
    text-slate-800
    shadow-sm
    transition-all
    hover:border-emerald-300
    hover:bg-slate-50

    dark:border-emerald-700/60
    dark:bg-[#08291d]
    dark:text-emerald-50
    dark:hover:border-emerald-500/80
    dark:hover:bg-[#103b2a]
  "
>
  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#07351f] text-sm font-black text-white dark:bg-emerald-900 dark:text-white">
    {user?.name?.[0] ?? 'L'}
  </div>

  <div className="hidden min-w-0 flex-1 text-right leading-tight md:block">
    <p className="truncate text-sm font-black text-slate-900 dark:text-white">
      {user?.name ?? '...'}
    </p>

    <p className="truncate text-xs font-semibold text-slate-500 dark:text-emerald-200">
      {user?.email ?? ''}
    </p>
  </div>

  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 dark:text-emerald-200" />
</button>

      {open && (
        <div
          className="
            absolute left-0 top-full z-50 mt-3
            w-72
            overflow-hidden
            rounded-3xl
            border border-slate-200
            bg-white/95
            shadow-2xl
            backdrop-blur-2xl
            dark:border-[#2d4a3e]
            dark:bg-[#10291d]/95
          "
        >
          <div className="border-b border-slate-200 p-4 dark:border-[#2d4a3e]">
            <p className="font-bold text-slate-800 dark:text-emerald-50">
              {user?.name}
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/60">
              {user?.email}
            </p>
          </div>

          <div className="p-2">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="
                flex items-center gap-3
                rounded-2xl
                px-4 py-3
                text-slate-700
                transition
                hover:bg-slate-100
                dark:text-emerald-50
                dark:hover:bg-[#173827]
              "
            >
              <Settings className="h-4 w-4" />
              الإعدادات
            </Link>

<Link
  href="/dashboard/billing"
  onClick={() => setOpen(false)}
  className="
    flex items-center gap-3
    rounded-2xl
    px-4 py-3
    text-slate-700
    transition
    hover:bg-slate-100
    dark:text-emerald-50
    dark:hover:bg-[#173827]
  "
>
  <CreditCard className="h-4 w-4" />
  الاشتراك والفواتير
</Link>

            <button
              type="button"
              onClick={logout}
              className="
                flex w-full items-center gap-3
                rounded-2xl
                px-4 py-3
                text-right
                text-red-600
                transition
                hover:bg-red-50
                dark:text-red-300
                dark:hover:bg-red-500/10
              "
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      )}
    </div>
  )
}