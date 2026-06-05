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
  Activity,
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
      { href: '/dashboard/clients', label: 'الموكلون', icon: Users, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
      { href: '/dashboard/cases', label: 'القضايا', icon: Briefcase, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
      { href: '/dashboard/documents', label: 'المستندات', icon: FileText, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
      { href: '/dashboard/appointments', label: 'المواعيد', icon: CalendarDays, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
      { href: '/dashboard/tasks', label: 'المهام', icon: FileText, roles: ['ADMIN', 'LAWYER', 'STAFF'] },
      { href: '/dashboard/team', label: 'الفريق', icon: Users, roles: ['ADMIN'] },
    ],
  },
  {
    section: 'الأعمال',
    items: [
      { href: '/dashboard/payments', label: 'المدفوعات', icon: Wallet, roles: ['ADMIN', 'LAWYER'] },
      { href: '/dashboard/invoices', label: 'الفواتير', icon: ReceiptText, roles: ['ADMIN', 'LAWYER'] },
      { href: '/dashboard/reports', label: 'التقارير', icon: BarChart3, roles: ['ADMIN', 'LAWYER'] },
      { href: '/dashboard/activity', label: 'سجل النشاط', icon: Activity, roles: ['ADMIN', 'LAWYER'] },
      { href: '/dashboard/billing', label: 'الاشتراك والخطة', icon: CreditCard, roles: ['ADMIN'] },
    ],
  },
] as const

interface User {
  name: string
  email: string
  role: string
}

const roleLabel: Record<string, string> = {
  ADMIN: 'مدير النظام',
  LAWYER: 'محامٍ',
  STAFF: 'موظف',
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

  const Inner = () => (
    <div className="flex h-full flex-col bg-[#0f2b21] text-emerald-50">
      {/* Brand */}
      <div className="border-b border-emerald-100/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50/10 ring-1 ring-emerald-100/10">
            <img
              src="/logo.png"
              alt="Viresto"
              className="h-12 w-12 object-contain"
            />
          </div>

          <div className="min-w-0">
            <p className="text-lg font-black leading-tight text-emerald-50">
              Viresto
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="mb-2 px-3 text-xs font-black tracking-wide text-emerald-100/55">
              {group.section}
            </p>

            <div className="space-y-1.5">
              {group.items
                .filter((item) => !user || item.roles.includes(user.role as any))
                .map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        group flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-black transition-all duration-200
                        ${
                          active
                            ? 'bg-[#294d3c] text-emerald-50 shadow-sm ring-1 ring-emerald-100/10'
                            : 'text-emerald-100/70 hover:bg-[#173827] hover:text-emerald-50'
                        }
                      `}
                    >
                      <span className="truncate">{item.label}</span>

                      <Icon
                        className={`
                          h-5 w-5 shrink-0 transition-all
                          ${
                            active
                              ? 'text-emerald-300'
                              : 'text-emerald-100/55 group-hover:text-emerald-200'
                          }
                        `}
                      />
                    </Link>
                  )
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-emerald-100/10 p-4">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-2xl bg-emerald-50/5 p-3 transition hover:bg-emerald-50/10"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#294d3c] text-sm font-black text-emerald-50">
            {user ? initials(user.name) : 'L'}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-emerald-50">
              {user?.name ?? '...'}
            </p>

            <p className="mt-0.5 truncate text-xs font-medium text-emerald-100/65">
              {user ? roleLabel[user.role] ?? user.role : ''}
            </p>
          </div>

          <Settings className="h-4 w-4 shrink-0 text-emerald-100/60" />
        </Link>

        <button
          type="button"
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f4d35] px-4 py-3 text-sm font-black text-emerald-50 transition hover:bg-[#276342]"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        aria-label="فتح القائمة الجانبية"
        title="فتح القائمة"
        onClick={() => setMobileOpen(true)}
        className="fixed right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-[#10291d] text-emerald-50 shadow-lg lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex justify-end lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="relative h-full w-72 shadow-2xl">
            <Inner />
          </aside>
        </div>
      )}

      {/* Desktop */}
      <aside className="fixed right-0 top-0 z-30 hidden h-full w-64 shadow-2xl lg:block">
        <Inner />
      </aside>
    </>
  )
}