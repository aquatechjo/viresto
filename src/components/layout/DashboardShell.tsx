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

  useEffect(() => {
    const current = getCurrentLocale()
    setLocale(current)

    function handleLocaleChange(e: Event) {
      const next = (e as CustomEvent<Locale>).detail
      setLocale(next)
    }

    window.addEventListener('localechange', handleLocaleChange)

    return () => {
      window.removeEventListener('localechange', handleLocaleChange)
    }
  }, [])

  const isRtl = locale === 'ar'

  return (
    <div
      className={`
        flex min-h-screen flex-col
        ${isRtl ? 'lg:mr-64' : 'lg:ml-64'}
      `}
    >
      {children}
    </div>
  )
}