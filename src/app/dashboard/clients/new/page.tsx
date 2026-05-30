'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setLoading(false)

    if (!res.ok) {
      alert('تعذر إضافة الموكل')
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

      <form onSubmit={submit} className="card p-6 space-y-4 max-w-3xl">
        <input
          className="input"
          placeholder="اسم الموكل"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

        <input
          className="input"
          placeholder="رقم الهاتف"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        <input
          className="input"
          placeholder="البريد الإلكتروني"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <input
          className="input"
          placeholder="الرقم الوطني / رقم الهوية"
          value={form.nationalId}
          onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
        />

        <input
          className="input"
          placeholder="العنوان"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />

        <textarea
          className="input min-h-[120px]"
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