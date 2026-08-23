'use client'

import { useEffect } from 'react'

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const root = document.documentElement
    const storedTheme = window.localStorage.getItem('theme')

    const theme =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'

    root.classList.toggle('dark', theme === 'dark')
    root.dataset.theme = 'viresto'
    root.style.colorScheme = theme
    window.localStorage.setItem('theme', theme)
  }, [])

  return <>{children}</>
}
