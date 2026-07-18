'use client'

import { useSyncExternalStore } from 'react'
import type { Locale } from '@/lib/i18n'
import { applyLocale, getCurrentLocale } from '@/lib/locale'

let initialLocaleApplied = false

function subscribeToLocale(onStoreChange: () => void) {
  if (!initialLocaleApplied) {
    applyLocale(getCurrentLocale())
    initialLocaleApplied = true
  }

  function handleLocaleChange() {
    onStoreChange()
  }

  function handleStorage(event: StorageEvent) {
    if (event.key !== 'locale') return

    applyLocale(getCurrentLocale())
    onStoreChange()
  }

  window.addEventListener('localechange', handleLocaleChange)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener('localechange', handleLocaleChange)
    window.removeEventListener('storage', handleStorage)
  }
}

function getServerLocale(): Locale {
  return 'ar'
}

function subscribeToMounted() {
  return () => {}
}

function getClientMounted() {
  return true
}

function getServerMounted() {
  return false
}

export function useLocale() {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getCurrentLocale,
    getServerLocale,
  )
  const mounted = useSyncExternalStore(
    subscribeToMounted,
    getClientMounted,
    getServerMounted,
  )

  return {
    locale,
    mounted,
    isRtl: locale === 'ar',
    isLtr: locale === 'en',
  }
}