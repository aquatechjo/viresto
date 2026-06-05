'use client'

import { usePathname, useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { useState, useEffect, useRef } from 'react'
import ProfileMenu from './ProfileMenu'
import { Search, Scale } from 'lucide-react'

const TITLES: Record<string, string> = {
  '/dashboard': 'لوحة التحكم',
  '/dashboard/appointments': 'المواعيد',
  '/dashboard/cases': 'القضايا',
  '/dashboard/clients': 'الموكلون',
  '/dashboard/documents': 'المستندات',
  '/dashboard/payments': 'المدفوعات',
  '/dashboard/reports': 'التقارير المالية',
  '/dashboard/settings': 'الملف الشخصي',
  '/dashboard/tasks': 'المهام',
}

function useDebounce<T>(val: T, ms: number) {
  const [d, setD] = useState(val)

  useEffect(() => {
    const t = setTimeout(() => setD(val), ms)
    return () => clearTimeout(t)
  }, [val, ms])

  return d
}

interface SR {
  clients: any[]
  cases: any[]
  tasks: any[]
  documents: any[]
}

export default function TopBar() {
  const pathname = usePathname()
  const router = useRouter()

  const title =
    Object.entries(TITLES)
      .filter(([k]) => pathname === k || pathname.startsWith(k + '/'))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'لوحة التحكم'

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SR | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const dq = useDebounce(query, 280)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (dq.length < 2) {
      setResults(null)
      return
    }

    setLoading(true)

    fetch(`/api/search?q=${encodeURIComponent(dq)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setResults(d.data)
      })
      .finally(() => setLoading(false))
  }, [dq])

  const hasResults =
    results &&
    results.clients.length +
      results.cases.length +
      results.tasks.length +
      results.documents.length >
      0

  const STATUS_AR: Record<string, string> = {
    OPEN: 'مفتوحة',
    IN_PROGRESS: 'جارية',
    CLOSED: 'مغلقة',
    ARCHIVED: 'مؤرشفة',
  }

  const PRIORITY_DOT: Record<string, string> = {
    HIGH: '🔴',
    MEDIUM: '🟡',
    LOW: '🟢',
  }

  const dateStr = new Intl.DateTimeFormat('ar-SA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-6 py-4 shadow-sm backdrop-blur-[18px] transition-colors dark:border-[#2d4a3e] dark:bg-[#0d241a]/95 lg:gap-6">
      {/* Search */}
      <div ref={ref} className="relative flex-1 max-w-[520px]">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-emerald-200">
          <Search className="h-4 w-4" />
        </span>

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="بحث في القضايا والموكلين..."
          className="
            h-11 w-full
            rounded-2xl
            border border-slate-200
            bg-white
            pr-10
            pl-4
            text-sm
            font-semibold
            text-slate-800
            placeholder:text-slate-400
            shadow-sm
            outline-none
            transition-all
            hover:border-emerald-300
            focus:border-emerald-500
            focus:ring-4
            focus:ring-emerald-500/10

            dark:border-emerald-700/60
            dark:bg-[#08291d]
            dark:text-white
            dark:placeholder:text-emerald-200/80
            dark:hover:border-emerald-500/80
          "
          style={{
            fontSize: '.8rem',
            paddingTop: '.4rem',
            paddingBottom: '.4rem',
          }}
        />

        {loading && (
          <span className="spinner-sm spinner absolute left-3 top-1/2 -translate-y-1/2" />
        )}

        {/* Dropdown */}
        {open && query.length >= 2 && (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2d4a3e] dark:bg-[#10291d]">
            {!hasResults && !loading && (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-emerald-100/70">
                لا نتائج لـ "{query}"
              </p>
            )}

            {results?.clients?.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  router.push(`/dashboard/clients/${c.id}`)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-right transition-colors hover:bg-slate-50 dark:hover:bg-[#173827]"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: 'var(--green-soft)',
                    color: 'var(--sidebar)',
                  }}
                >
                  {c.name[0]}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-emerald-50">
                    {c.name}
                  </p>

                  <p className="truncate text-xs text-slate-500 dark:text-emerald-200">
                    {c.phone ?? 'موكل'}
                  </p>
                </div>
              </button>
            ))}

            {results?.cases?.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  router.push(`/dashboard/cases/${c.id}`)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center gap-2.5 border-t border-slate-200 px-3 py-2.5 text-right transition-colors hover:bg-slate-50 dark:border-[#2d4a3e] dark:hover:bg-[#173827]"
              >
                <span className="text-xs">
                  <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-emerald-50">
                    {c.title}
                  </p>

                  <p className="truncate text-xs text-slate-500 dark:text-emerald-200">
                    {c.client?.name} · {STATUS_AR[c.status]}
                  </p>
                </div>
              </button>
            ))}

            {results?.tasks?.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  router.push('/dashboard/tasks')
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center gap-2.5 border-t border-slate-200 px-3 py-2.5 text-right transition-colors hover:bg-slate-50 dark:border-[#2d4a3e] dark:hover:bg-[#173827]"
              >
                <span className="text-xs">{PRIORITY_DOT[t.priority]}</span>

                <p
                  className="truncate text-sm text-slate-800 dark:text-emerald-50"
                  style={{
                    textDecoration: t.completed ? 'line-through' : 'none',
                  }}
                >
                  {t.title}
                </p>
              </button>
            ))}

            {results?.documents?.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  router.push('/dashboard/documents')
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full items-center gap-2.5 border-t border-slate-200 px-3 py-2.5 text-right transition-colors hover:bg-slate-50 dark:border-[#2d4a3e] dark:hover:bg-[#173827]"
              >
                <span className="text-xs">📄</span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-emerald-50">
                    {d.fileName}
                  </p>

                  <p className="truncate text-xs text-slate-500 dark:text-emerald-200">
                    مستند · {d.fileType}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: date + theme + profile + title */}
      <div className="flex shrink-0 items-center gap-2 self-center">
        <span
          className="
            hidden h-11 items-center gap-1.5
            rounded-2xl
            border border-slate-200
            bg-slate-50/90
            px-4
            text-xs
            font-bold
            text-slate-700
            shadow-sm
            transition-all
            hover:border-emerald-200
            hover:bg-white
            sm:flex

            dark:border-emerald-700/60
            dark:bg-[#08291d]
            dark:text-white
            dark:hover:border-emerald-500/80
            dark:hover:bg-[#103b2a]
          "
        >
          📅 {dateStr}
        </span>

        <ThemeToggle />

        <ProfileMenu />

        <h1 className="hidden min-w-max pr-2 text-sm font-black text-slate-800 dark:text-emerald-50 md:block">
          {title}
        </h1>
      </div>
    </header>
  )
}