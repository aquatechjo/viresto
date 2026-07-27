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
        border border-[#286061]
        bg-[#082c2d]
        px-4
        text-xs font-black
        text-white
        shadow-none
        transition-all
        hover:border-copper-400/60
        hover:bg-[#185354]
      "
      aria-label="Toggle language"
      title="Toggle language"
    >
      {!mounted ? '...' : locale.toUpperCase()}
    </button>
  )
}
