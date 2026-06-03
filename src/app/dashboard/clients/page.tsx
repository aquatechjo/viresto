'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'

interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  nationalId?: string
  address?: string
  notes?: string
  createdAt: string
  _count?: {
    cases: number
    appointments: number
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ar-JO')
}

export default function ClientsPage() {
  const router = useRouter()

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [caseFilter, setCaseFilter] = useState<'all' | 'withCases' | 'withoutCases'>('all')

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const url = q.trim()
        ? `/api/clients?q=${encodeURIComponent(q)}&limit=100`
        : '/api/clients?limit=100'

      const response = await fetch(url)
      const data = await response.json().catch(() => ({}))

      setClients(Array.isArray(data.data?.data) ? data.data.data : Array.isArray(data.data) ? data.data : [])
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    load()
  }, [load])

  function search(event: React.FormEvent) {
    event.preventDefault()
    load()
  }

  function clearFilters() {
    setQ('')
    setCaseFilter('all')
  }

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const casesCount = client._count?.cases ?? 0

      if (caseFilter === 'withCases') return casesCount > 0
      if (caseFilter === 'withoutCases') return casesCount === 0

      return true
    })
  }, [clients, caseFilter])

  const totalClients = clients.length
  const clientsWithCases = clients.filter((client) => (client._count?.cases ?? 0) > 0).length
  const clientsWithoutCases = clients.filter((client) => (client._count?.cases ?? 0) === 0).length

  const newThisMonth = clients.filter((client) => {
    const created = new Date(client.createdAt)
    const now = new Date()

    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth()
    )
  }).length

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 stagger">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6"
        style={{
          background:
            'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)',
          borderColor: 'rgba(255,255,255,0.12)',
          boxShadow: '0 18px 50px rgba(45, 74, 62, 0.18)',
        }}
      >
        <div
          className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
          style={{ background: 'rgba(245, 200, 66, 0.16)' }}
        />

        <div
          className="absolute -bottom-20 right-16 h-52 w-52 rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              إدارة علاقات الموكلين
            </div>

            <h1 className="text-2xl font-black text-white">الموكلون</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              تابع بيانات الموكلين، معلومات التواصل، عدد القضايا والمواعيد المرتبطة
              بكل موكل من واجهة منظمة وسريعة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/dashboard/clients/new')}
            className="btn shrink-0"
            style={{
              background: '#fff',
              color: 'var(--sidebar)',
              borderColor: 'rgba(255,255,255,0.32)',
            }}
          >
            + موكل جديد
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'كل الموكلين',
            value: totalClients,
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: 'جدد هذا الشهر',
            value: newThisMonth,
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: 'لديهم قضايا',
            value: clientsWithCases,
            color: '#92400e',
            bg: 'var(--amber-soft)',
          },
          {
            label: 'بدون قضايا',
            value: clientsWithoutCases,
            color: '#6b7280',
            bg: 'var(--card)',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5"
            style={{
              background: item.bg,
              borderColor: 'var(--border)',
            }}
          >
            <p className="text-xs font-black" style={{ color: item.color }}>
              {item.label}
            </p>

            <p className="mt-2 text-3xl font-black" style={{ color: item.color }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form
          onSubmit={search}
          className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_.8fr_auto]"
        >
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="ابحث باسم الموكل، الهاتف، البريد أو الرقم الوطني..."
            className="input"
          />

          <select
            value={caseFilter}
            onChange={(event) =>
              setCaseFilter(event.target.value as 'all' | 'withCases' | 'withoutCases')
            }
            className="input"
            aria-label="فلترة حسب القضايا"
          >
            <option value="all">جميع الموكلين</option>
            <option value="withCases">لديهم قضايا</option>
            <option value="withoutCases">بدون قضايا</option>
          </select>

          <button type="submit" className="btn btn-ghost whitespace-nowrap">
            بحث
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['all', 'الكل'],
              ['withCases', 'لديهم قضايا'],
              ['withoutCases', 'بدون قضايا'],
            ] as ['all' | 'withCases' | 'withoutCases', string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCaseFilter(key)}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={
                caseFilter === key
                  ? {
                      background: 'var(--sidebar)',
                      color: '#fff',
                    }
                  : {
                      background: 'var(--green-soft)',
                      color: 'var(--text-2)',
                    }
              }
            >
              {label}
            </button>
          ))}

          {(q || caseFilter !== 'all') && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={{
                background: 'var(--card)',
                color: 'var(--text-2)',
                border: '1px solid var(--border)',
              }}
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {filteredClients.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="👥"
            title="لا يوجد موكلون"
            sub={
              clients.length === 0
                ? 'لم يتم إضافة أي موكل بعد. ابدأ بإضافة أول موكل داخل المكتب.'
                : 'لا توجد نتائج مطابقة للفلاتر الحالية.'
            }
            action={
              clients.length === 0 ? (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/clients/new')}
                  className="btn btn-primary"
                >
                  + إضافة موكل
                </button>
              ) : (
                <button type="button" onClick={clearFilters} className="btn btn-ghost">
                  مسح الفلاتر
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              onClick={() => router.push(`/dashboard/clients/${client.id}`)}
              className="card group cursor-pointer p-5 transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
                      style={{
                        background: 'var(--green-soft)',
                        color: 'var(--sidebar)',
                      }}
                    >
                      {client.name.slice(0, 1)}
                    </div>

                    <div className="min-w-0">
                      <h3
                        className="truncate text-base font-black"
                        style={{ color: 'var(--text)' }}
                      >
                        {client.name}
                      </h3>

                      <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                        أضيف بتاريخ {formatDate(client.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold"
                      style={{
                        background: 'var(--green-soft)',
                        color: 'var(--sidebar)',
                      }}
                    >
                      ⚖️ {client._count?.cases ?? 0} قضايا
                    </span>

                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold"
                      style={{
                        background: 'var(--green-soft)',
                        color: 'var(--text-2)',
                      }}
                    >
                      📅 {client._count?.appointments ?? 0} مواعيد
                    </span>

                    {client.nationalId && (
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                        🪪 {client.nationalId}
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-black"
                  style={{
                    background:
                      (client._count?.cases ?? 0) > 0
                        ? 'var(--green-soft)'
                        : 'var(--card)',
                    color:
                      (client._count?.cases ?? 0) > 0
                        ? 'var(--sidebar)'
                        : 'var(--text-3)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {(client._count?.cases ?? 0) > 0 ? 'نشط' : 'بدون قضايا'}
                </span>
              </div>

              <div
                className="mt-5 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                    الهاتف
                  </p>

                  <p className="mt-1 truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {client.phone || '-'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                    البريد الإلكتروني
                  </p>

                  <p className="mt-1 truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {client.email || '-'}
                  </p>
                </div>

                {client.address && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                      العنوان
                    </p>

                    <p className="mt-1 line-clamp-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {client.address}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}