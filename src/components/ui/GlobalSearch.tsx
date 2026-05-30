'use client'
// src/components/ui/GlobalSearch.tsx
// Wired search bar — live results from /api/search

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResults {
  clients:      { id: string; name: string; email?: string; phone?: string }[]
  cases:        { id: string; title: string; caseNumber?: string; status: string; client: { name: string } }[]
  appointments: { id: string; title: string; startTime: string; type: string }[]
  tasks:        { id: string; title: string; priority: string; completed: boolean; dueDate?: string }[]
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'مفتوحة', IN_PROGRESS: 'جارية', CLOSED: 'مغلقة', ARCHIVED: 'مؤرشفة',
}
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'text-green-400', IN_PROGRESS: 'text-yellow-400', CLOSED: 'text-gray-400', ARCHIVED: 'text-gray-600',
}
const PRIORITY_LABELS: Record<string, string> = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' }

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const debouncedQ = useDebounce(query, 300)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.success) setResults(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { search(debouncedQ) }, [debouncedQ, search])

  const hasResults = results && (
    results.clients.length + results.cases.length +
    results.appointments.length + results.tasks.length > 0
  )

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
    setQuery('')
    setResults(null)
  }

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      {/* Input */}
      <div className="relative">
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="بحث في العملاء، القضايا، المهام..."
          className="
            w-full bg-[#1a2535] border border-[#2d3f55] rounded-xl
            pr-9 pl-4 py-2 text-sm text-white placeholder-gray-500
            focus:outline-none focus:border-[#f5c842]/60 focus:ring-1 focus:ring-[#f5c842]/20
            transition-all
          "
        />
        {loading && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border-2 border-[#f5c842]/40 border-t-[#f5c842] rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && query.length >= 2 && (
        <div className="absolute z-50 top-full mt-2 w-80 bg-[#1a2535] border border-[#2d3f55] rounded-xl shadow-2xl overflow-hidden">
          {!hasResults && !loading && (
            <div className="p-4 text-center text-sm text-gray-500">لا توجد نتائج لـ "{query}"</div>
          )}

          {/* Clients */}
          {results?.clients && results.clients.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs text-gray-500 bg-[#141e2b] border-b border-[#2d3f55]">العملاء</div>
              {results.clients.map(c => (
                <button key={c.id} onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#243552] transition-colors text-right">
                  <div className="w-7 h-7 rounded-full bg-[#f5c842]/20 flex items-center justify-center text-[#f5c842] text-xs font-bold shrink-0">
                    {c.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{c.name}</p>
                    <p className="text-xs text-gray-500 truncate">{c.phone || c.email || '—'}</p>
                  </div>
                </button>
              ))}
            </section>
          )}

          {/* Cases */}
          {results?.cases && results.cases.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs text-gray-500 bg-[#141e2b] border-b border-[#2d3f55] border-t">القضايا</div>
              {results.cases.map(c => (
                <button key={c.id} onClick={() => navigate(`/dashboard/cases/${c.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#243552] transition-colors text-right">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs shrink-0">
                    ⚖️
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{c.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.client.name}
                      {c.caseNumber && ` · ${c.caseNumber}`}
                    </p>
                  </div>
                  <span className={`text-xs shrink-0 ${STATUS_COLORS[c.status]}`}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </button>
              ))}
            </section>
          )}

          {/* Appointments */}
          {results?.appointments && results.appointments.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs text-gray-500 bg-[#141e2b] border-b border-[#2d3f55] border-t">المواعيد</div>
              {results.appointments.map(a => (
                <button key={a.id} onClick={() => navigate('/dashboard/appointments')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#243552] transition-colors text-right">
                  <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs shrink-0">📅</div>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{a.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(a.startTime).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </button>
              ))}
            </section>
          )}

          {/* Tasks */}
          {results?.tasks && results.tasks.length > 0 && (
            <section>
              <div className="px-3 py-1.5 text-xs text-gray-500 bg-[#141e2b] border-b border-[#2d3f55] border-t">المهام</div>
              {results.tasks.map(t => (
                <button key={t.id} onClick={() => navigate('/dashboard/tasks')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#243552] transition-colors text-right">
                  <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-xs shrink-0">
                    {PRIORITY_LABELS[t.priority]}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${t.completed ? 'line-through text-gray-500' : 'text-white'}`}>{t.title}</p>
                    {t.dueDate && (
                      <p className="text-xs text-gray-500">
                        {new Date(t.dueDate).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
