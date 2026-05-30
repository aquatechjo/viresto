'use client'

import { useEffect, useState } from 'react'
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

export default function ClientsPage() {
  const router = useRouter()

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)

    const url = q.trim()
      ? `/api/clients?q=${encodeURIComponent(q)}`
      : '/api/clients'

    const res = await fetch(url)
    const data = await res.json()

    setClients(data.data?.data || data.data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function search(e: React.FormEvent) {
    e.preventDefault()
    load()
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">الموكلون</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            إدارة بيانات الموكلين داخل المكتب
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => router.push('/dashboard/clients/new')}
        >
          + إضافة موكل
        </button>
      </div>

      <form onSubmit={search} className="flex gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم الموكل..."
          className="input max-w-md"
        />

        <button type="submit" className="btn">
          بحث
        </button>
      </form>

      {clients.length === 0 ? (
        <EmptyState
          icon="👥"
          title="لا يوجد موكلون"
          sub="لم يتم العثور على موكلين"
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>الموكل</th>
                <th>الهاتف</th>
                <th>البريد</th>
                <th>القضايا</th>
                <th>المواعيد</th>
              </tr>
            </thead>

            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                  className="cursor-pointer"
                >
                  <td className="font-bold">{client.name}</td>
                  <td>{client.phone || '-'}</td>
                  <td>{client.email || '-'}</td>
                  <td>{client._count?.cases ?? 0}</td>
                  <td>{client._count?.appointments ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}