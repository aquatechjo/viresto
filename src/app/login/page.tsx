'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import FormField from '@/components/ui/FormField'
import { useEffect } from 'react'

export default function LoginPage() {

  const router = useRouter()

useEffect(() => {
  const hasToken = document.cookie.includes('ld_token')

  if (hasToken) {
    router.push('/dashboard')
  }
}, [router])
  const [form,   setForm]   = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (!form.email)    err.email    = 'البريد الإلكتروني مطلوب'
    if (!form.password) err.password = 'كلمة المرور مطلوبة'
    if (Object.keys(err).length) { setErrors(err); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('مرحباً بك في Viresto!')
        router.push('/dashboard')
      } else {
        toast.error(data.message ?? 'بيانات الدخول غير صحيحة')
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] p-10" style={{ background: 'var(--sidebar)' }}>
        <div>
          <p className="text-white font-black text-3xl">نظام المحامي</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.5)' }}>Viresto</p>
        </div>
        <div className="space-y-6">
          {[
            { icon: '⚖️', title: 'إدارة القضايا', desc: 'تتبع كل قضية بسهولة ويسر' },
            { icon: '👥', title: 'ملفات الموكلين', desc: 'سجلات كاملة لجميع موكليك' },
            { icon: '💰', title: 'المدفوعات والأتعاب', desc: 'تتبع الإيرادات والمستحقات' },
            { icon: '📅', title: 'إدارة المواعيد', desc: 'جلسات المحكمة والاجتماعات' },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="text-white font-bold text-sm">{f.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.5)' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,.3)' }}>© {new Date().getFullYear()} Viresto. جميع الحقوق محفوظة.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <p className="font-black text-2xl" style={{ color: 'var(--sidebar)' }}>نظام المحامي</p>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Viresto</p>
          </div>

          <div className="card p-7">
            <h1 className="text-xl font-black mb-1.5" style={{ color: 'var(--text)' }}>تسجيل الدخول</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>أدخل بياناتك للوصول إلى لوحة التحكم</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="البريد الإلكتروني" required error={errors.email}>
                <input type="email" value={form.email} autoComplete="email"
                  onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setErrors(p => ({ ...p, email: '' })) }}
                  className="input" placeholder="lawyer@example.com" />
              </FormField>

              <FormField label="كلمة المرور" required error={errors.password}>
                <input type="password" value={form.password} autoComplete="current-password"
                  onChange={e => { setForm(p => ({ ...p, password: e.target.value })); setErrors(p => ({ ...p, password: '' })) }}
                  className="input" placeholder="••••••••" />
              </FormField>

              <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2 py-2.5">
                {loading ? <span className="spinner spinner-sm" /> : 'دخول'}
              </button>
            </form>

            <p className="text-center text-sm mt-4" style={{ color: 'var(--text-3)' }}>
              ليس لديك حساب؟{' '}
              <Link href="/register" className="font-bold" style={{ color: 'var(--sidebar)' }}>سجّل مكتبك</Link>
            </p>
          </div>

          {/* Demo credentials */}
          <div className="mt-4 p-3 rounded-xl text-center" style={{ background: 'var(--gold-soft)', border: '1px solid var(--gold)' }}>
            <p className="text-xs font-semibold" style={{ color: '#92400e' }}>بيانات تجريبية</p>
            <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>lawyer@example.com / Lawyer@123456</p>
          </div>
        </div>
      </div>
    </div>
  )
}
