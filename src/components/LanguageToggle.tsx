'use client'

import type { Locale } from '@/lib/i18n'
import { setCurrentLocale } from '@/lib/locale'
import { useLocale } from '@/lib/useLocale'

export default function LanguageToggle() {
  const { locale, mounted } = useLocale()

  function toggleLocale() {
    const next: Locale = locale === 'ar' ? 'en' : 'ar'

    setCurrentLocale(next)
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
        dark:bg-[#082c2d]
        dark:text-white
        dark:hover:border-emerald-500/80
        dark:hover:bg-[#185354]
      "
      aria-label="Toggle language"
      title="Toggle language"
    >
      {!mounted ? '...' : locale.toUpperCase()}
    </button>
  )
}