import type { Locale } from './i18n'

const NON_LATIN_DIGIT_PATTERN = /[\u0660-\u0669\u06f0-\u06f9]/g

export function withLatinDigits(locale: string) {
  return new Intl.Locale(locale, { numberingSystem: 'latn' }).toString()
}

export function toLatinDigits(value: string) {
  return value.replace(NON_LATIN_DIGIT_PATTERN, (digit) => {
    const codePoint = digit.charCodeAt(0)

    if (codePoint >= 0x0660 && codePoint <= 0x0669) {
      return String(codePoint - 0x0660)
    }

    return String(codePoint - 0x06f0)
  })
}

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
