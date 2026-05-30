'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import FormField from '@/components/ui/FormField'

export default function RegisterPage() {
  const router = useRouter()
  const [form,    setForm]    = useState({ tenantName: '', name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  function update(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      const data = await res.json()
      if (data.success) { toast.success('تم إنشاء مكتبك بنجاح!'); router.push('/dashboard') }
      else toast.error(data.message ?? 'حدث خطأ')
    } catch { toast.error('حدث خطأ في الاتصال') }
    finally  { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="font-black text-2xl" style={{ color: 'var(--sidebar)' }}>نظام المحامي</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>أنشئ مكتبك القانوني الآن</p>
        </div>

        <div className="card p-7">
          <h1 className="text-xl font-black mb-5" style={{ color: 'var(--text)' }}>تسجيل مكتب جديد</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="اسم المكتب القانوني" required>
              <input value={form.tenantName} onChange={update('tenantName')} className="input" placeholder="مكتب المنصوري للمحاماة" />
            </FormField>
            <FormField label="اسمك الكامل" required>
              <input value={form.name} onChange={update('name')} className="input" placeholder="أحمد المنصوري" />
            </FormField>
            <FormField label="البريد الإلكتروني" required>
              <input type="email" value={form.email} onChange={update('email')} className="input" placeholder="ahmed@law.jo" />
            </FormField>
            <FormField label="كلمة المرور" required>
              <input type="password" value={form.password} onChange={update('password')} className="input" placeholder="8 أحرف على الأقل" />
            </FormField>
            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 mt-1">
              {loading ? <span className="spinner spinner-sm" /> : 'إنشاء المكتب'}
            </button>
          </form>
          <p className="text-center text-sm mt-4" style={{ color: 'var(--text-3)' }}>
            لديك حساب؟ <Link href="/login" className="font-bold" style={{ color: 'var(--sidebar)' }}>سجّل دخولك</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
