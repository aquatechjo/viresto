'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function getCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const currentTheme = getCurrentTheme()
    setTheme(currentTheme)
    setMounted(true)
  }, [])

  function toggleTheme() {
    const currentTheme = getCurrentTheme()
    const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark'

    const root = document.documentElement

    root.classList.toggle('dark', nextTheme === 'dark')
    root.style.colorScheme = nextTheme
    window.localStorage.setItem('theme', nextTheme)

    setTheme(nextTheme)
  }

  return (
    <button
className="
  flex h-11 w-14 items-center justify-center
  rounded-2xl
  border border-slate-200
  bg-slate-50/90
  text-slate-700
  shadow-sm
  transition-all
  hover:border-emerald-200
  hover:bg-white

  dark:border-[#286061]
  dark:bg-[#082c2d]
  dark:text-emerald-100
  dark:hover:border-emerald-400/70
  dark:hover:bg-[#185354]
"
      type="button"
      onClick={toggleTheme}
      disabled={!mounted}
      aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
      title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}