'use client'

import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { getCurrentLocale } from '@/lib/locale'

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [locale, setLocale] = useState<Locale>('ar')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const current = getCurrentLocale()
    setLocale(current)

    function handleLocaleChange(e: Event) {
      const next = (e as CustomEvent<Locale>).detail
      setLocale(next)
    }

    const stored = window.localStorage.getItem('viresto_sidebar_collapsed')
    setSidebarCollapsed(stored === 'true')

    function handleSidebarChange(e: Event) {
      const next = (e as CustomEvent<boolean>).detail
      setSidebarCollapsed(next)
    }

    window.addEventListener('localechange', handleLocaleChange)
    window.addEventListener('viresto-sidebar-change', handleSidebarChange)

    return () => {
      window.removeEventListener('localechange', handleLocaleChange)
      window.removeEventListener('viresto-sidebar-change', handleSidebarChange)
    }
  }, [])

  const isRtl = locale === 'ar'

  return (
    <div
      className={`
        flex min-h-screen flex-col
        ${
          isRtl
            ? sidebarCollapsed
              ? 'xl:mr-20'
              : 'xl:mr-64'
            : sidebarCollapsed
              ? 'xl:ml-20'
              : 'xl:ml-64'
        }
      `}
    >
      {children}
    </div>
  )
}