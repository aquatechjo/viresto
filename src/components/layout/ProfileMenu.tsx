'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  User,
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
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
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
        onClick={() => setOpen(!open)}
        className="
          flex items-center gap-3
          rounded-2xl
          border border-black/5
          bg-white/70
          backdrop-blur-xl
          px-3 py-2
          hover:bg-white
          transition
        "
      >
        <div className="w-9 h-9 rounded-xl bg-[#17352b] text-white flex items-center justify-center font-bold">
          {user?.name?.[0] ?? 'L'}
        </div>

        <div className="hidden md:block text-right">
          <p className="text-sm font-bold leading-tight">
            {user?.name ?? '...'}
          </p>

          <p className="text-xs text-gray-500">
            {user?.email ?? ''}
          </p>
        </div>

        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {open && (
        <div
          className="
            absolute left-0 top-full mt-3
            w-72
            rounded-3xl
            border border-black/5
            bg-white/90
            backdrop-blur-2xl
            shadow-2xl
            overflow-hidden
            z-50
          "
        >

          <div className="p-4 border-b border-black/5">
            <p className="font-bold">
              {user?.name}
            </p>

            <p className="text-sm text-gray-500 mt-1">
              {user?.email}
            </p>
          </div>

          <div className="p-2">

            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/5 transition"
            >
              <Settings className="w-4 h-4" />
              الإعدادات
            </Link>

            <button
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/5 transition text-right"
            >
              <CreditCard className="w-4 h-4" />
              الاشتراك والفواتير
            </button>

            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 text-red-600 transition text-right"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </button>

          </div>
        </div>
      )}
    </div>
  )
}