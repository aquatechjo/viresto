'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

import {
  LayoutDashboard,
  CalendarDays,
  Briefcase,
  Users,
  FileText,
  Wallet,
  ReceiptText,
  BarChart3,
  CreditCard,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react'

import { initials } from '@/lib/utils'

const NAV = [
  {
    section: 'الرئيسية',
    items: [
      { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
    ],
  },
  {
    section: 'الإدارة',
    items: [
      { href: '/dashboard/cases', label: 'القضايا', icon: Briefcase, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
      { href: '/dashboard/clients', label: 'الموكلون', icon: Users, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
      { href: '/dashboard/team', label: 'الفريق', icon: Users, roles: ['ADMIN'] },
      { href: '/dashboard/appointments', label: 'المواعيد', icon: CalendarDays, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
      { href: '/dashboard/documents', label: 'المستندات', icon: FileText, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
      { href: '/dashboard/tasks', label: 'المهام', icon: FileText, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
    ],
  },
{
  section: 'الأعمال',
  items: [
    { href: '/dashboard/payments', label: 'المدفوعات', icon: Wallet, roles: ['ADMIN', 'LAWYER'] },
    { href: '/dashboard/invoices', label: 'الفواتير', icon: ReceiptText, roles: ['ADMIN', 'LAWYER'] },
    { href: '/dashboard/reports', label: 'التقارير', icon: BarChart3, roles: ['ADMIN', 'LAWYER'] },
    { href: '/dashboard/billing', label: 'الاشتراك والخطة', icon: CreditCard, roles: ['ADMIN'] },
  ],
},
] as const

interface User {
  name: string
  email: string
  role: string
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setUser(d.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
    })

    toast.success('تم تسجيل الخروج')

    router.push('/login')
  }

  function isActive(href: string) {
    return href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href)
  }

const roleLabel: Record<string, string> = {
  ADMIN: 'مدير النظام',
  LAWYER: 'محامٍ',
  STAFF: 'موظف',
}

  const Inner = () => (
    <div className="flex flex-col h-full bg-[#17352b] text-white">

{/* top brand */}
<div className="px-5 pt-6 pb-5 border-b border-white/10">
  <div className="flex items-center gap-3">
    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
      <img
        src="/logo.png"
        alt=""
        className="w-12 h-12 object-contain"
      />
    </div>

    <div className="min-w-0">
      <p className="font-black text-lg leading-tight text-white">
        Viresto
      </p>

      <p className="text-xs text-white/40 mt-0.5">
        Legal SaaS Platform
      </p>
    </div>
  </div>
</div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">

        {NAV.map((group) => (
          <div key={group.section} className="mb-6">

            <p className="text-[11px] uppercase tracking-wider text-white/30 px-3 mb-2 font-bold">
              {group.section}
            </p>

            <div className="space-y-1">

              {group.items
                .filter((item) => !user || item.roles.includes(user.role as any))
                .map((item) => {
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-3 rounded-2xl
                      transition-all duration-200
                      group
                    `}
                    style={{
                      background: active
                        ? 'rgba(255,255,255,.10)'
                        : 'transparent',

                      color: active
                        ? '#fff'
                        : 'rgba(255,255,255,.55)',
                    }}
                  >
                    <item.icon
                      className={`
                        w-5 h-5 transition-all
                        ${active ? 'text-emerald-300' : 'text-white/40'}
                      `}
                    />

                    <span className="font-semibold text-sm">
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* bottom */}
      <div className="border-t border-white/10 p-4">

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 transition"
        >
          <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center font-black text-sm text-emerald-300">
            {user ? initials(user.name) : 'L'}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">
              {user?.name ?? '...'}
            </p>

            <p className="text-xs text-white/40 mt-0.5">
              {user ? roleLabel[user.role] ?? user.role : ''}
            </p>
          </div>

          <Settings className="w-4 h-4 text-white/40" />
        </Link>

        <button
          onClick={logout}
          className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition text-sm font-semibold text-white/70"
        >
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  )

  return (
    <>
{/* mobile trigger */}
<button
  type="button"
  aria-label="فتح القائمة الجانبية"
  title="فتح القائمة"
  onClick={() => setMobileOpen(true)}
  className="lg:hidden fixed top-4 right-4 z-50 w-11 h-11 rounded-2xl"
>
  <Menu className="w-5 h-5" />
</button>

      {/* mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex justify-end">

          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="relative w-64 h-full shadow-2xl">
            <Inner />
          </aside>
        </div>
      )}

      {/* desktop */}
      <aside className="hidden lg:block fixed top-0 right-0 h-full w-64 z-30 shadow-2xl">
        <Inner />
      </aside>
    </>
  )
}