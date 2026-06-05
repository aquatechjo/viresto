'use client'

import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { getCurrentLocale, setCurrentLocale } from '@/lib/locale'

export default function LanguageToggle() {
  const [locale, setLocale] = useState<Locale>('ar')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const current = getCurrentLocale()

    setLocale(current)
    setMounted(true)

    document.documentElement.lang = current
    document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr'
  }, [])

  function toggleLocale() {
    const next: Locale = locale === 'ar' ? 'en' : 'ar'

    setLocale(next)
    setCurrentLocale(next)

    document.documentElement.lang = next
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'

    window.location.reload()
  }

  return (
    <button
      type="button"
      onClick={mounted ? toggleLocale : undefined}
      className="
        flex h-11 min-w-14 items-center justify-center
        rounded-2xl
        border border-slate-200
        bg-slate-50/90
        px-4
        text-xs font-black
        text-slate-700
        shadow-sm
        transition-all
        hover:border-emerald-300
        hover:bg-white

        dark:border-emerald-700/60
        dark:bg-[#08291d]
        dark:text-white
        dark:hover:border-emerald-500/80
        dark:hover:bg-[#103b2a]
      "
      aria-label="Toggle language"
      title="Toggle language"
    >
      {!mounted ? '...' : locale.toUpperCase()}
    </button>
  )
}