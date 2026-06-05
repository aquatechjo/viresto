'use client'

import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { applyLocale, getCurrentLocale } from '@/lib/locale'

export function useLocale() {
  const [locale, setLocale] = useState<Locale>('ar')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const current = getCurrentLocale()

    setLocale(current)
    applyLocale(current)
    setMounted(true)

    function handleLocaleChange(e: Event) {
      const next = (e as CustomEvent<Locale>).detail
      setLocale(next)
      applyLocale(next)
    }

    window.addEventListener('localechange', handleLocaleChange)

    return () => {
      window.removeEventListener('localechange', handleLocaleChange)
    }
  }, [])

  return {
    locale,
    mounted,
    isRtl: locale === 'ar',
    isLtr: locale === 'en',
  }
}