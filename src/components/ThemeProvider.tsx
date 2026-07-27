'use client'

import { useEffect } from 'react'

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.dataset.theme = 'viresto'
    localStorage.setItem('theme', 'dark')
  }, [])

  return <>{children}</>
}
