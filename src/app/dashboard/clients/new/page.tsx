'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getApiMessage, isPlanLimitResponse, planLimitMessage } from '@/lib/plan-ui'
import { useLocale } from '@/lib/useLocale'
import DigitsInput from '@/components/ui/DigitsInput'
import { NATIONAL_ID_DIGITS_MESSAGE, PHONE_DIGITS_MESSAGE, TEN_DIGITS } from '@/lib/digits'

const COPY = {
  ar: {
    title: 'إضافة موكل',
    subtitle: 'إضافة بيانات موكل جديد داخل المكتب',
    errorTitle: 'تعذر تنفيذ العملية',
    planLimitFallback: 'وصلت إلى حد الموكلين المسموح في خطتك الحالية.',
    addFallback: 'تعذر إضافة الموكل',
    phoneInvalid: PHONE_DIGITS_MESSAGE,
    nationalIdInvalid: NATIONAL_ID_DIGITS_MESSAGE,
    billing: 'عرض الاشتراك والخطة',
    fields: {
      name: 'اسم الموكل',
      phone: 'رقم الهاتف',
      email: 'البريد الإلكتروني',
      nationalId: 'الرقم الوطني / رقم الهوية',
      address: 'العنوان',
      notes: 'ملاحظات',
    },
    save: 'حفظ الموكل',
    saving: 'جاري الحفظ...',
    cancel: 'إلغاء',
  },
  en: {
    title: 'Add client',
    subtitle: 'Add a new client record to the office workspace',
    errorTitle: 'Could not complete the action',
    planLimitFallback: 'You have reached the client limit allowed by your current plan.',
    addFallback: 'Could not add client',
    phoneInvalid: 'Phone number must be 10 digits',
    nationalIdInvalid: 'National ID must be 10 digits',
    billing: 'View billing and plan',
    fields: {
      name: 'Client name',
      phone: 'Phone number',
      email: 'Email address',
      nationalId: 'National ID / identity number',
      address: 'Address',
      notes: 'Notes',
    },
    save: 'Save client',
    saving: 'Saving...',
    cancel: 'Cancel',
  },
} as const

export default function NewClientPage() {
  const router = useRouter()
  const { locale, isRtl } = useLocale()
  const text = COPY[locale === 'ar' ? 'ar' : 'en']

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // After a submit, incomplete digit fields show their message too.
  const [attempted, setAttempted] = useState(false)

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
    setAttempted(true)
    if (!TEN_DIGITS.test(form.phone) || !TEN_DIGITS.test(form.nationalId)) return

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
        ? planLimitMessage(data, text.planLimitFallback)
        : getApiMessage(data, text.addFallback)

      setError(message)
      return
    }

    router.push('/dashboard/clients')
    router.refresh()
  }

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
          {text.title}
        </h1>

        <p className="text-sm font-semibold" style={{ color: 'var(--text-3)' }}>
          {text.subtitle}
        </p>
      </div>

      {error && (
        <div className="max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="font-black">{text.errorTitle}</h2>
          <p className="mt-1 text-sm font-semibold">{error}</p>

          {isPlanLimitResponse({ message: error }) && (
            <Link href="/dashboard/billing" className="btn btn-primary mt-4 inline-flex">
              {text.billing}
            </Link>
          )}
        </div>
      )}

      <form
        onSubmit={submit}
        autoComplete="off"
        className="card max-w-3xl space-y-4 p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input
            className="input h-12 w-full text-start"
            dir={isRtl ? 'rtl' : 'ltr'}
            name="clientName"
            autoComplete="off"
            placeholder={text.fields.name}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <DigitsInput
            className={`input h-12 w-full ${isRtl ? 'text-right' : 'text-left'}`}
            name="clientPhone"
            autoComplete="off"
            placeholder={text.fields.phone}
            value={form.phone}
            onValueChange={(phone) => setForm({ ...form, phone })}
            incompleteMessage={text.phoneInvalid}
            error={attempted && !TEN_DIGITS.test(form.phone) ? text.phoneInvalid : null}
          />

          <input
            className={`input h-12 w-full ${isRtl ? 'text-right' : 'text-left'}`}
            dir="ltr"
            name="clientEmail"
            autoComplete="off"
            type="email"
            placeholder={text.fields.email}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <DigitsInput
            className={`input h-12 w-full ${isRtl ? 'text-right' : 'text-left'}`}
            name="clientNationalId"
            autoComplete="off"
            placeholder={text.fields.nationalId}
            value={form.nationalId}
            onValueChange={(nationalId) => setForm({ ...form, nationalId })}
            incompleteMessage={text.nationalIdInvalid}
            error={
              attempted && !TEN_DIGITS.test(form.nationalId) ? text.nationalIdInvalid : null
            }
          />
        </div>

        <input
          className="input h-12 w-full text-start"
          dir={isRtl ? 'rtl' : 'ltr'}
          name="clientAddress"
          autoComplete="off"
          placeholder={text.fields.address}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />

        <textarea
          className="input min-h-[130px] w-full resize-none text-start leading-relaxed"
          dir={isRtl ? 'rtl' : 'ltr'}
          name="clientNotes"
          autoComplete="off"
          placeholder={text.fields.notes}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary h-12 flex-1"
          >
            {loading ? text.saving : text.save}
          </button>

          <button
            type="button"
            className="btn h-12 flex-1"
            onClick={() => router.push('/dashboard/clients')}
          >
            {text.cancel}
          </button>
        </div>
      </form>
    </div>
  )
}
