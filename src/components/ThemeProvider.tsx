'use client'

import { useEffect } from 'react'

type Theme = 'light' | 'dark'

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    const theme: Theme = savedTheme ?? (prefersDark ? 'dark' : 'light')

    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [])

  return <>{children}</>
}