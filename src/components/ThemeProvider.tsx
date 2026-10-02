'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  THEME_STORAGE_KEY,
  applyTheme,
  isForcedDarkPath,
  resolveTheme,
} from '@/lib/theme'

// Re-applies the theme on every route change (the root layout's inline
// script only covers the first load): forced-dark pages get dark without
// touching the stored choice, every other page gets the user's own theme.
// Layout effect so a client-side navigation never paints the old theme.
export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ''

  useLayoutEffect(() => {
    if (isForcedDarkPath(pathname)) {
      applyTheme('dark')
      return
    }

    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    } catch {}

    const theme = resolveTheme(
      pathname,
      stored,
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    )

    applyTheme(theme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {}
  }, [pathname])

  return <>{children}</>
}
