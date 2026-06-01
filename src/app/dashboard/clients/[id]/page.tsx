'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import PageLoader from '@/components/ui/PageLoader'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import { formatCurrency, formatDate, initials } from '@/lib/utils'

interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  nationalId?: string
  address?: string
  notes?: string
  createdAt: string
  cases: {
    id: string
    title: string
    caseNumber?: string
    status: string
    feeAgreed: number
    payments: {
      amount: number
      status: string
    }[]
  }[]
}

const STATUS_AR: Record<string, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'جارية',
  CLOSED: 'مغلقة',
  ARCHIVED: 'مؤرشفة',
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge badge-green',
  IN_PROGRESS: 'badge badge-blue',
  CLOSED: 'badge badge-gray',
  ARCHIVED: 'badge badge-gray',
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    const r = await fetch(`/api/clients/${id}`)
    const d = await r.json()

    if (d.success) {
      setClient(d.data)
      setForm({
        name: d.data.name,
        phone: d.data.phone ?? '',
        email: d.data.email ?? '',
        address: d.data.address ?? '',
        notes: d.data.notes ?? '',
      })
    } else {
      toast.error('الموكل غير موجود')
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const r = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const d = await r.json()

    if (d.success) {
      toast.success('تم الحفظ')
      setEditing(false)
      load()
    } else {
      toast.error(d.message)
    }

    setSaving(false)
  }

  async function exportClientPDF() {
    if (!client || exporting) return

    try {
      setExporting(true)
      const { exportClientFullPDF } = await import('@/lib/export')
      exportClientFullPDF(client)
    } catch {
      toast.error('تعذر تصدير ملف الموكل')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <PageLoader />

  if (!client) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--text-3)' }}>الموكل غير موجود</p>
        <button onClick={() => router.back()} className="btn btn-ghost mt-3">
          رجوع
        </button>
      </div>
    )
  }

  const totalFees = client.cases.reduce((s, c) => s + Number(c.feeAgreed || 0), 0)

  const totalPaid = client.cases.reduce(
    (s, c) =>
      s +
      c.payments
        .filter((p) => p.status === 'PAID')
        .reduce((ss, p) => ss + Number(p.amount || 0), 0),
    0
  )

  return (
    <div className="space-y-5 stagger">
      <button
        onClick={() => router.back()}
        className="btn btn-ghost"
        style={{ fontSize: '.8rem', padding: '.3rem .8rem' }}
      >
        ← رجوع
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-6 flex flex-col items-center text-center gap-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black"
            style={{ background: 'var(--green-soft)', color: 'var(--sidebar)' }}
          >
            {initials(client.name)}
          </div>

          <div>
            <p className="text-lg font-black" style={{ color: 'var(--text)' }}>
              {client.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              موكل منذ {formatDate(client.createdAt, { month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="w-full space-y-2 text-sm">
            {[
              ['📞', client.phone],
              ['📧', client.email],
              ['🏠', client.address],
              ['🪪', client.nationalId],
            ].map(([icon, val]) =>
              val ? (
                <div
                  key={icon as string}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-right"
                  style={{ background: 'var(--input-bg)' }}
                >
                  <span>{icon}</span>
                  <span style={{ color: 'var(--text-2)' }}>{val}</span>
                </div>
              ) : null
            )}
          </div>

          {client.notes && (
            <p className="text-xs text-center px-2" style={{ color: 'var(--text-3)' }}>
              {client.notes}
            </p>
          )}

          <button onClick={() => setEditing(true)} className="btn btn-ghost w-full mt-1">
            ✏️ تعديل البيانات
          </button>

          <button
            onClick={exportClientPDF}
            disabled={exporting}
            className="btn btn-primary w-full"
          >
            {exporting ? <span className="spinner spinner-sm" /> : '📄 تصدير ملف الموكل PDF'}
          </button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'إجمالي الأتعاب', value: formatCurrency(totalFees), color: 'var(--text)' },
              { label: 'المحصّل', value: formatCurrency(totalPaid), color: 'var(--sidebar)' },
              { label: 'المتبقي', value: formatCurrency(totalFees - totalPaid), color: '#dc2626' },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>
                  {s.label}
                </p>
                <p className="text-lg font-black" style={{ color: s.color }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <div className="card p-0 overflow-hidden">
            <div
              className="px-4 py-3 border-b flex items-center justify-end"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                القضايا ({client.cases.length})
              </p>
            </div>

            {client.cases.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--text-3)' }}>
                لا توجد قضايا
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>القضية</th>
                    <th>رقم</th>
                    <th>الأتعاب</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {client.cases.map((c) => (
                    <tr key={c.id} onClick={() => router.push(`/dashboard/cases/${c.id}`)}>
                      <td className="font-semibold">{c.title}</td>
                      <td className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                        {c.caseNumber ?? '—'}
                      </td>
                      <td className="font-semibold" style={{ color: 'var(--sidebar)' }}>
                        {formatCurrency(c.feeAgreed)}
                      </td>
                      <td>
                        <span className={STATUS_BADGE[c.status] ?? 'badge badge-gray'}>
                          {STATUS_AR[c.status] ?? c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="تعديل بيانات الموكل">
        <form onSubmit={save} className="space-y-3">
          {(
            [
              ['name', 'الاسم الكامل'],
              ['phone', 'الهاتف'],
              ['email', 'البريد'],
              ['address', 'العنوان'],
              ['notes', 'ملاحظات'],
            ] as [keyof typeof form, string][]
          ).map(([k, lbl]) => (
            <FormField key={k} label={lbl}>
              {k === 'notes' ? (
                <textarea
                  value={form[k]}
                  onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                  className="input"
                  rows={2}
                  style={{ resize: 'none' }}
                />
              ) : (
                <input
                  value={form[k]}
                  onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                  className="input"
                />
              )}
            </FormField>
          ))}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost flex-1">
              إلغاء
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'حفظ'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}