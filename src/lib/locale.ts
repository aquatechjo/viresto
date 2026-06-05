import type { Locale } from './i18n'

export function getCurrentLocale(): Locale {
  if (typeof window === 'undefined') return 'ar'

  const saved = localStorage.getItem('locale')

  if (saved === 'en' || saved === 'ar') {
    return saved
  }

  return 'ar'
}

export function applyLocale(locale: Locale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }
}

export function setCurrentLocale(locale: Locale) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale)
    applyLocale(locale)

    window.dispatchEvent(
      new CustomEvent('localechange', {
        detail: locale,
      })
    )
  }
}