'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'

import PageLoader from '@/components/ui/PageLoader'
import FormField from '@/components/ui/FormField'
import { initials } from '@/lib/utils'

interface User {
  name: string
  email: string
  role: string
  twoFactorEnabled?: boolean
  tenant: {
    name: string
    slug: string
    plan: string
    email?: string | null
    phone?: string | null
    address?: string | null
    logoUrl?: string | null
  }
}

interface CompanySettings {
  name: string
  email: string
  phone: string
  address: string
  logoUrl: string
  aiEnabled: boolean
  aiConsentAt: string | null
}

const ROLE_AR: Record<string, string> = {
  OWNER: 'المالك',
  ADMIN: 'مدير النظام',
  LAWYER: 'محامٍ',
  STAFF: 'موظف',
  ASSISTANT: 'مساعد',
}

const PLAN_AR: Record<string, string> = {
  FREE: 'مجاني',
  PRO: 'احترافي',
  ENTERPRISE: 'مؤسسي',
}

const INIT_COMPANY: CompanySettings = {
  name: '',
  email: '',
  phone: '',
  address: '',
  logoUrl: '',
  aiEnabled: false,
  aiConsentAt: null,
}

function getApiMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback
}

function Toggle({
  on,
  set,
  disabled,
}: {
  on: boolean
  set: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => set(!on)}
      className="relative h-6 w-11 rounded-full transition-all duration-200 disabled:opacity-60"
      style={{
        background: on ? 'var(--sidebar)' : 'var(--border)',
      }}
      aria-label={on ? 'تعطيل' : 'تفعيل'}
    >
      <span
        className="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
        style={{
          right: on ? 5 : 'auto',
          left: on ? 'auto' : 5,
        }}
      />
    </button>
  )
}

function InfoLine({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3"
      style={{ background: 'var(--input-bg)' }}
    >
      <span className="min-w-0 truncate text-sm font-bold" style={{ color: value ? 'var(--text)' : 'var(--text-3)' }}>
        {value || 'غير محدد'}
      </span>

      <span className="shrink-0 text-xs font-black" style={{ color: 'var(--text-3)' }}>
        {label}
      </span>
    </div>
  )
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
  })

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })

  const [company, setCompany] = useState<CompanySettings>(INIT_COMPANY)

  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [darkModeEnabled, setDarkModeEnabled] = useState(false)

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)
  const [savingAi, setSavingAi] = useState(false)

  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [twoFACode, setTwoFACode] = useState('')
  const [twoFALoading, setTwoFALoading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        const [meResponse, settingsResponse] = await Promise.all([
          fetch('/api/auth/me', { cache: 'no-store' }),
          fetch('/api/settings', { cache: 'no-store' }),
        ])

        if (meResponse.status === 401 || settingsResponse.status === 401) {
          window.location.href = '/login'
          return
        }

        const meData = await meResponse.json().catch(() => ({}))
        const settingsData = await settingsResponse.json().catch(() => ({}))

        if (meData.success) {
          const currentUser = meData.data as User

          setUser(currentUser)
          setProfileForm({
            name: currentUser.name || '',
            email: currentUser.email || '',
          })
          setTwoFAEnabled(!!currentUser.twoFactorEnabled)
        } else {
          toast.error(getApiMessage(meData, 'تعذر تحميل بيانات الحساب'))
        }

        if (settingsData.success) {
          setCompany({
            name: settingsData.data?.name || '',
            email: settingsData.data?.email || '',
            phone: settingsData.data?.phone || '',
            address: settingsData.data?.address || '',
            logoUrl: settingsData.data?.logoUrl || '',
            aiEnabled: !!settingsData.data?.aiEnabled,
            aiConsentAt: settingsData.data?.aiConsentAt || null,
          })
        }
      } catch {
        toast.error('تعذر تحميل الإعدادات')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()

    if (!profileForm.name.trim()) {
      toast.error('الاسم مطلوب')
      return
    }

    if (!profileForm.email.trim()) {
      toast.error('البريد الإلكتروني مطلوب')
      return
    }

    try {
      setSavingProfile(true)

      const response = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        toast.success('تم حفظ البيانات')
        setEditingProfile(false)

        setUser((previous) =>
          previous
            ? {
                ...previous,
                name: data.data?.name ?? profileForm.name,
                email: data.data?.email ?? profileForm.email,
              }
            : previous
        )
      } else {
        toast.error(getApiMessage(data, 'تعذر حفظ بيانات الحساب'))
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ البيانات')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()

    if (!passwordForm.current || !passwordForm.next) {
      toast.error('أدخل كلمة المرور الحالية والجديدة')
      return
    }

    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('كلمتا المرور غير متطابقتين')
      return
    }

    if (passwordForm.next.length < 8) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }

    try {
      setSavingPassword(true)

      const response = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.next,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        toast.success('تم تغيير كلمة المرور')
        setPasswordForm({
          current: '',
          next: '',
          confirm: '',
        })
      } else {
        toast.error(getApiMessage(data, 'تعذر تغيير كلمة المرور'))
      }
    } catch {
      toast.error('حدث خطأ أثناء تغيير كلمة المرور')
    } finally {
      setSavingPassword(false)
    }
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault()

    if (!company.name.trim()) {
      toast.error('اسم المكتب مطلوب')
      return
    }

    try {
      setSavingCompany(true)

      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: company.name,
          email: company.email,
          phone: company.phone,
          address: company.address,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        toast.success('تم حفظ بيانات المكتب')

        setUser((previous) =>
          previous
            ? {
                ...previous,
                tenant: {
                  ...previous.tenant,
                  name: data.data?.name ?? company.name,
                  email: data.data?.email ?? company.email,
                  phone: data.data?.phone ?? company.phone,
                  address: data.data?.address ?? company.address,
                  logoUrl: data.data?.logoUrl ?? company.logoUrl,
                },
              }
            : previous
        )
      } else {
        toast.error(getApiMessage(data, 'تعذر حفظ بيانات المكتب'))
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ بيانات المكتب')
    } finally {
      setSavingCompany(false)
    }
  }

  async function toggleAi() {
    const nextValue = !company.aiEnabled

    if (nextValue) {
      const confirmed = window.confirm(
        'سيتم تفعيل المساعد الذكي لهذا المكتب. قد يتم إرسال السؤال وبيانات عامة محدودة إلى مزود ذكاء اصطناعي خارجي. هل تريد المتابعة؟'
      )

      if (!confirmed) return
    }

    try {
      setSavingAi(true)

      const response = await fetch('/api/settings/ai', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: nextValue,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        setCompany((previous) => ({
          ...previous,
          aiEnabled: !!data.data?.aiEnabled,
          aiConsentAt: data.data?.aiConsentAt || null,
        }))

        toast.success(nextValue ? 'تم تفعيل المساعد الذكي' : 'تم تعطيل المساعد الذكي')
      } else {
        toast.error(getApiMessage(data, 'تعذر تحديث إعدادات المساعد الذكي'))
      }
    } catch {
      toast.error('حدث خطأ أثناء تحديث إعدادات المساعد الذكي')
    } finally {
      setSavingAi(false)
    }
  }

  async function setup2FA() {
    try {
      setTwoFALoading(true)

      const response = await fetch('/api/auth/2fa/setup', {
        cache: 'no-store',
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        setQrCode(data.data?.qrCode || '')
        toast.success('تم إنشاء QR Code')
      } else {
        toast.error(getApiMessage(data, 'فشل إعداد التحقق الثنائي'))
      }
    } catch {
      toast.error('فشل إعداد التحقق الثنائي')
    } finally {
      setTwoFALoading(false)
    }
  }

  async function verify2FA() {
    if (!twoFACode.trim()) {
      toast.error('أدخل رمز التحقق')
      return
    }

    try {
      setTwoFALoading(true)

      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: twoFACode,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        setTwoFAEnabled(true)
        setQrCode('')
        setTwoFACode('')
        toast.success('تم تفعيل التحقق الثنائي')
      } else {
        toast.error(getApiMessage(data, 'فشل تفعيل التحقق الثنائي'))
      }
    } catch {
      toast.error('فشل تفعيل التحقق الثنائي')
    } finally {
      setTwoFALoading(false)
    }
  }

  if (loading) return <PageLoader />

  if (!user) {
    return (
      <div className="card p-10 text-center">
        <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
          تعذر تحميل الإعدادات
        </h1>

        <p className="mt-2 text-sm" style={{ color: 'var(--text-3)' }}>
          لم نتمكن من تحميل بيانات الحساب.
        </p>
      </div>
    )
  }

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

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-2xl font-black"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
              }}
            >
              {initials(user.name)}
            </div>

            <div className="min-w-0">
              <div
                className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                إعدادات النظام
              </div>

              <h1 className="truncate text-2xl font-black text-white">
                إعدادات الحساب والمكتب
              </h1>

              <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
                إدارة بيانات الحساب، معلومات المكتب، إعدادات الأمان، والمساعد الذكي من مكان واحد.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-4 py-2 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              {ROLE_AR[user.role] ?? user.role}
            </span>

            <span
              className="rounded-full px-4 py-2 text-xs font-black"
              style={{
                background: 'rgba(245,200,66,0.18)',
                color: '#fff',
                border: '1px solid rgba(245,200,66,0.35)',
              }}
            >
              خطة {PLAN_AR[user.tenant.plan] ?? user.tenant.plan}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'المكتب',
            value: user.tenant.name || 'غير محدد',
            hint: user.tenant.slug,
          },
          {
            label: 'الدور',
            value: ROLE_AR[user.role] ?? user.role,
            hint: 'صلاحيات الحساب',
          },
          {
            label: 'المساعد الذكي',
            value: company.aiEnabled ? 'مفعّل' : 'غير مفعّل',
            hint: company.aiConsentAt ? 'تمت الموافقة' : 'لم تتم الموافقة',
          },
          {
            label: 'الحماية الثنائية',
            value: twoFAEnabled ? 'مفعّلة' : 'غير مفعّلة',
            hint: '2FA',
          },
        ].map((item) => (
          <div key={item.label} className="card p-5">
            <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
              {item.label}
            </p>

            <p className="mt-2 truncate text-xl font-black" style={{ color: 'var(--text)' }}>
              {item.value}
            </p>

            <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--text-3)' }}>
              {item.hint || '-'}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left */}
        <div className="space-y-5 xl:col-span-5">
          {/* Personal Info */}
          <div className="card p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black" style={{ color: 'var(--text)' }}>
                  البيانات الشخصية
                </h2>

                <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                  بيانات حساب المستخدم الحالي
                </p>
              </div>

              {!editingProfile && (
                <button
                  type="button"
                  onClick={() => setEditingProfile(true)}
                  className="btn btn-ghost"
                >
                  تعديل
                </button>
              )}
            </div>

            <div className="mb-5 flex flex-col items-center">
              <div
                className="mb-3 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black"
                style={{
                  background: 'var(--green-soft)',
                  color: 'var(--sidebar)',
                }}
              >
                {initials(user.name)}
              </div>

              <p className="text-lg font-black" style={{ color: 'var(--text)' }}>
                {user.name}
              </p>

              <p className="mt-1 text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                {user.email}
              </p>
            </div>

            {editingProfile ? (
              <form onSubmit={saveProfile} className="space-y-3">
                <FormField label="الاسم الكامل" required>
                  <input
                    value={profileForm.name}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    className="input"
                    autoFocus
                  />
                </FormField>

                <FormField label="البريد الإلكتروني" required>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) =>
                      setProfileForm((previous) => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                    className="input"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(false)
                      setProfileForm({
                        name: user.name || '',
                        email: user.email || '',
                      })
                    }}
                    className="btn btn-ghost"
                  >
                    إلغاء
                  </button>

                  <button type="submit" disabled={savingProfile} className="btn btn-primary">
                    {savingProfile ? 'جاري الحفظ...' : 'حفظ'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <InfoLine label="الاسم" value={user.name} />
                <InfoLine label="البريد" value={user.email} />
                <InfoLine label="المكتب" value={user.tenant.name} />
                <InfoLine label="الدور" value={ROLE_AR[user.role] ?? user.role} />
              </div>
            )}
          </div>

          {/* Company Info */}
          <div className="card p-5">
            <div className="mb-5">
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                بيانات المكتب
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                تظهر هذه البيانات في الفواتير والطباعة
              </p>
            </div>

            <form onSubmit={saveCompany} className="space-y-3">
              <FormField label="اسم المكتب / الشركة" required>
                <input
                  value={company.name}
                  onChange={(event) =>
                    setCompany((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  className="input"
                />
              </FormField>

              <FormField label="البريد الإلكتروني">
                <input
                  type="email"
                  value={company.email}
                  onChange={(event) =>
                    setCompany((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                  className="input"
                  placeholder="company@example.com"
                />
              </FormField>

              <FormField label="رقم الهاتف">
                <input
                  value={company.phone}
                  onChange={(event) =>
                    setCompany((previous) => ({
                      ...previous,
                      phone: event.target.value,
                    }))
                  }
                  className="input"
                  placeholder="+962..."
                />
              </FormField>

              <FormField label="العنوان">
                <input
                  value={company.address}
                  onChange={(event) =>
                    setCompany((previous) => ({
                      ...previous,
                      address: event.target.value,
                    }))
                  }
                  className="input"
                  placeholder="الأردن - عمّان"
                />
              </FormField>

              <button type="submit" disabled={savingCompany} className="btn btn-primary w-full">
                {savingCompany ? 'جاري الحفظ...' : 'حفظ بيانات المكتب'}
              </button>
            </form>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-5 xl:col-span-7">
          {/* AI */}
          <div className="card p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <h2 className="font-black" style={{ color: 'var(--text)' }}>
                  المساعد الذكي
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-7" style={{ color: 'var(--text-3)' }}>
                  عند التفعيل، قد يتم إرسال السؤال وبيانات عامة محدودة عن المكتب إلى مزود ذكاء اصطناعي خارجي لمعالجة الطلب.
                </p>
              </div>

              <span className={company.aiEnabled ? 'badge badge-green' : 'badge badge-gray'}>
                {company.aiEnabled ? 'مفعّل' : 'غير مفعّل'}
              </span>
            </div>

            <div
              className="mt-4 rounded-2xl border p-4 text-sm leading-7"
              style={{
                borderColor: '#fbbf24',
                background: 'var(--amber-soft)',
                color: '#92400e',
              }}
            >
              لا يتم إرسال أسماء الموكلين أو تفاصيل القضايا الحساسة افتراضيًا. استخدم المساعد فقط للمهام التنظيمية والمتابعة.
            </div>

            <button
              type="button"
              onClick={toggleAi}
              disabled={savingAi}
              className="btn btn-primary mt-4"
            >
              {savingAi
                ? 'جاري الحفظ...'
                : company.aiEnabled
                  ? 'تعطيل المساعد الذكي'
                  : 'تفعيل المساعد الذكي'}
            </button>
          </div>

          {/* General Settings */}
          <div className="card p-5">
            <h2 className="font-black" style={{ color: 'var(--text)' }}>
              الإعدادات العامة
            </h2>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Toggle on={notificationsEnabled} set={setNotificationsEnabled} />

                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    الإشعارات
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                    تنبيهات المواعيد والمهام
                  </p>
                </div>
              </div>

              <div
                className="flex items-center justify-between gap-4 border-y py-4"
                style={{ borderColor: 'var(--border)' }}
              >
                <span
                  className="rounded-xl px-3 py-1.5 text-xs font-black"
                  style={{
                    background: 'var(--sidebar)',
                    color: '#fff',
                  }}
                >
                  العربية
                </span>

                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    اللغة
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                    لغة الواجهة الحالية
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <Toggle on={darkModeEnabled} set={setDarkModeEnabled} />

                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    الوضع الليلي
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                    خيار واجهة محلي، لا يغيّر إعدادات النظام حاليًا
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="card p-5">
            <h2 className="font-black" style={{ color: 'var(--text)' }}>
              تغيير كلمة المرور
            </h2>

            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
              استخدم كلمة مرور قوية لا تقل عن 8 أحرف.
            </p>

            <form onSubmit={savePassword} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <FormField label="كلمة المرور الحالية">
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(event) =>
                    setPasswordForm((previous) => ({
                      ...previous,
                      current: event.target.value,
                    }))
                  }
                  className="input"
                  placeholder="••••••••"
                />
              </FormField>

              <FormField label="كلمة المرور الجديدة">
                <input
                  type="password"
                  value={passwordForm.next}
                  onChange={(event) =>
                    setPasswordForm((previous) => ({
                      ...previous,
                      next: event.target.value,
                    }))
                  }
                  className="input"
                  placeholder="••••••••"
                />
              </FormField>

              <FormField label="تأكيد كلمة المرور">
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(event) =>
                    setPasswordForm((previous) => ({
                      ...previous,
                      confirm: event.target.value,
                    }))
                  }
                  className="input"
                  placeholder="••••••••"
                />
              </FormField>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={savingPassword || !passwordForm.current || !passwordForm.next}
                  className="btn btn-primary w-full"
                >
                  {savingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                </button>
              </div>
            </form>
          </div>

          {/* 2FA */}
          <div className="card p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <h2 className="font-black" style={{ color: 'var(--text)' }}>
                  الحماية الثنائية 2FA
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-7" style={{ color: 'var(--text-3)' }}>
                  حماية إضافية لحسابات المحامين والإدارة عبر تطبيقات مثل Google Authenticator.
                </p>
              </div>

              <span className={twoFAEnabled ? 'badge badge-green' : 'badge badge-gray'}>
                {twoFAEnabled ? 'مفعّل' : 'غير مفعّل'}
              </span>
            </div>

            {!twoFAEnabled && !qrCode && (
              <button
                type="button"
                onClick={setup2FA}
                disabled={twoFALoading}
                className="btn btn-primary mt-4"
              >
                {twoFALoading ? 'جاري الإنشاء...' : 'تفعيل 2FA'}
              </button>
            )}

            {qrCode && (
              <div className="mt-5 space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="2FA QR"
                  className="mx-auto h-52 w-52 rounded-2xl border bg-white p-2"
                  style={{ borderColor: 'var(--border)' }}
                />

                <input
                  value={twoFACode}
                  onChange={(event) => setTwoFACode(event.target.value)}
                  placeholder="أدخل رمز التحقق"
                  className="input text-center"
                />

                <button
                  type="button"
                  onClick={verify2FA}
                  disabled={twoFALoading}
                  className="btn btn-primary w-full"
                >
                  {twoFALoading ? 'جاري التأكيد...' : 'تأكيد التفعيل'}
                </button>
              </div>
            )}

            {twoFAEnabled && (
              <div
                className="mt-4 rounded-2xl border p-4 text-sm font-bold"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--green-soft)',
                  color: 'var(--sidebar)',
                }}
              >
                التحقق الثنائي مفعّل على هذا الحساب.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}