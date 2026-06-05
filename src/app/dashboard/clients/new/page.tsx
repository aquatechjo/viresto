'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getApiMessage, isPlanLimitResponse, planLimitMessage } from '@/lib/plan-ui'

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    nationalId: '',
    address: '',
    notes: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok || data.success === false) {
      const message = isPlanLimitResponse(data)
        ? planLimitMessage(data, 'وصلت إلى حد الموكلين المسموح في خطتك الحالية.')
        : getApiMessage(data, 'تعذر إضافة الموكل')

      setError(message)
      return
    }

    router.push('/dashboard/clients')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">إضافة موكل</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          إضافة بيانات موكل جديد داخل المكتب
        </p>
      </div>

      {error && (
        <div className="max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="font-black">تعذر تنفيذ العملية</h2>
          <p className="mt-1 text-sm">{error}</p>
          {isPlanLimitResponse({ message: error }) && (
            <Link href="/dashboard/billing" className="btn btn-primary mt-4 inline-flex">
              عرض الاشتراك والخطة
            </Link>
          )}
        </div>
      )}

<form
  onSubmit={submit}
  autoComplete="off"
  className="card p-6 space-y-4 max-w-3xl"
>
  <input
  className="input"
  name="clientName"
  autoComplete="off"
  placeholder="اسم الموكل"
  value={form.name}
  onChange={(e) => setForm({ ...form, name: e.target.value })}
  required
/>

<input
  className="input"
  name="clientPhone"
  autoComplete="off"
  inputMode="tel"
  placeholder="رقم الهاتف"
  value={form.phone}
  onChange={(e) => setForm({ ...form, phone: e.target.value })}
/>

<input
  className="input"
  name="clientEmail"
  autoComplete="off"
  type="email"
  placeholder="البريد الإلكتروني"
  value={form.email}
  onChange={(e) => setForm({ ...form, email: e.target.value })}
/>

<input
  className="input"
  name="clientNationalId"
  autoComplete="off"
  placeholder="الرقم الوطني / رقم الهوية"
  value={form.nationalId}
  onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
/>

<input
  className="input"
  name="clientAddress"
  autoComplete="off"
  placeholder="العنوان"
  value={form.address}
  onChange={(e) => setForm({ ...form, address: e.target.value })}
/>

<textarea
  className="input min-h-[120px]"
  name="clientNotes"
  autoComplete="off"
  placeholder="ملاحظات"
  value={form.notes}
  onChange={(e) => setForm({ ...form, notes: e.target.value })}
/>

        <div className="flex gap-3">
          <button disabled={loading} className="btn btn-primary">
            {loading ? 'جاري الحفظ...' : 'حفظ الموكل'}
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => router.push('/dashboard/clients')}
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  )
}
