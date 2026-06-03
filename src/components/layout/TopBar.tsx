'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ProfileMenu from './ProfileMenu'
import {
  Search,
  Bell,
  Settings,
  Scale,
  Briefcase,
  CheckCircle2,
} from 'lucide-react'

const TITLES: Record<string, string> = {
  '/dashboard':              'لوحة التحكم',
  '/dashboard/appointments': 'المواعيد',
  '/dashboard/cases':        'القضايا',
  '/dashboard/clients':      'الموكلون',
  '/dashboard/documents':    'المستندات',
  '/dashboard/payments':     'المدفوعات',
  '/dashboard/reports':      'التقارير المالية',
  '/dashboard/settings':     'الملف الشخصي',
  '/dashboard/tasks':        'المهام',
}

function useDebounce<T>(val: T, ms: number) {
  const [d, setD] = useState(val)
  useEffect(() => { const t = setTimeout(() => setD(val), ms); return () => clearTimeout(t) }, [val, ms])
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
  const router   = useRouter()
  const title    = Object.entries(TITLES)
    .filter(([k]) => pathname === k || pathname.startsWith(k+'/'))
    .sort((a,b) => b[0].length - a[0].length)[0]?.[1] ?? 'لوحة التحكم'

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SR | null>(null)
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const dq  = useDebounce(query, 280)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (dq.length < 2) { setResults(null); return }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(dq)}`).then(r => r.json()).then(d => { if (d.success) setResults(d.data) }).finally(() => setLoading(false))
  }, [dq])

  const hasResults =
  results &&
  (
    results.clients.length +
    results.cases.length +
    results.tasks.length +
    results.documents.length
  ) > 0

  const STATUS_AR: Record<string, string> = { OPEN:'مفتوحة', IN_PROGRESS:'جارية', CLOSED:'مغلقة', ARCHIVED:'مؤرشفة' }
  const PRIORITY_DOT: Record<string, string> = { HIGH:'🔴', MEDIUM:'🟡', LOW:'🟢' }

  const dateStr = new Intl.DateTimeFormat('ar-SA', { day:'numeric', month:'long', year:'numeric' }).format(new Date())

  return (
<header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/75 px-6 py-4 backdrop-blur-[18px] transition-colors dark:border-[#244638] dark:bg-[#07140f]/90 lg:gap-6">

      {/* Search */}
      <div ref={ref} className="relative flex-1 max-w-md">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">
  <Search className="h-4 w-4" />
</span>
        <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
className="
  w-full
  rounded-2xl
  border
  border-slate-200
  bg-white/80
  pr-10
  pl-4
  py-3
  text-sm
  text-slate-800
  placeholder:text-slate-400
  outline-none
  transition-all
  focus:border-emerald-500
  focus:ring-4
  focus:ring-emerald-500/10
  dark:border-[#2d4a3e]
  dark:bg-[#0b1f16]/90
  dark:text-emerald-50
  dark:placeholder:text-emerald-200/50
"

          style={{ fontSize:'.8rem', paddingTop:'.4rem', paddingBottom:'.4rem' }} />
        {loading && <span className="spinner-sm absolute left-3 top-1/2 -translate-y-1/2 spinner" />}
        {/* Dropdown */}
        {open && query.length >= 2 && (
          <div className="absolute top-full right-0 mt-2 w-80 card shadow-2xl overflow-hidden z-50 border" style={{ borderColor:'var(--border)' }}>
            {!hasResults && !loading && (
  <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
    لا نتائج لـ "{query}"
  </p>
)}
            {results?.clients?.map(c => (
              <button key={c.id} onClick={() => { router.push(`/dashboard/clients/${c.id}`); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <span className="text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background:'var(--green-soft)', color:'var(--sidebar)' }}>
                  {c.name[0]}
                </span>
                <div><p className="text-sm font-semibold" style={{ color:'var(--text)' }}>{c.name}</p>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>{c.phone ?? 'موكل'}</p></div>
              </button>
            ))}
            {results?.cases?.map(c => (
              <button key={c.id} onClick={() => { router.push(`/dashboard/cases/${c.id}`); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t" style={{ borderColor:'var(--border)' }}>
                <span className="text-xs"><Scale className="w-4 h-4 text-emerald-600" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color:'var(--text)' }}>{c.title}</p>
                  <p className="text-xs" style={{ color:'var(--text-3)' }}>{c.client?.name} · {STATUS_AR[c.status]}</p>
                </div>
              </button>
            ))}
            {results?.tasks?.map(t => (
              <button key={t.id} onClick={() => { router.push('/dashboard/tasks'); setOpen(false); setQuery('') }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t" style={{ borderColor:'var(--border)' }}>
                <span className="text-xs">{PRIORITY_DOT[t.priority]}</span>
                <p className="text-sm" style={{ color:'var(--text)', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</p>
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
    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t"
    style={{ borderColor: 'var(--border)' }}
  >
    <span className="text-xs">📄</span>

    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
        {d.fileName}
      </p>

                     <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                     مستند · {d.fileType}
                    </p>
                    </div>
                    </button>
                ))}
          </div>
        )}
      </div>

      {/* Right: date + icons + page title */}
{/* Right: date + profile */}
<div className="flex shrink-0 items-center gap-2">
  {/* Date */}
<span className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:border-[#2d4a3e] dark:bg-[#10291d] dark:text-emerald-100 sm:flex">
  📅 {dateStr}
</span>

  <ThemeToggle />

  <ProfileMenu />

  {/* Page title */}
<h1 className="hidden pr-2 text-sm font-black text-slate-800 dark:text-emerald-50 md:block">
  {title}
</h1>
</div>
    </header>
  )
}
