'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'dark' : 'light')
    setMounted(true)
  }, [])

  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'

    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
    localStorage.setItem('theme', nextTheme)
    setTheme(nextTheme)
  }

  return (
    <button
      type="button"
      onClick={mounted ? toggleTheme : undefined}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#2d4a3e] dark:bg-[#10291d] dark:text-emerald-100 dark:hover:bg-[#173827]"
      aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
      title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}