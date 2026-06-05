'use client'

import { useState } from 'react'
import { useLocale } from '@/lib/useLocale'

const aiTexts = {
  ar: {
    title: 'المساعد القانوني الذكي',
    subtitle: 'AI Legal Assistant',
    placeholder: 'اسأل عن القضايا أو المواعيد أو العملاء...',
    send: 'إرسال',
    loading: 'جاري التحليل...',
    noReply: 'لا يوجد رد',
    error: 'حدث خطأ أثناء الاتصال',
  },
  en: {
    title: 'AI Legal Assistant',
    subtitle: 'Smart legal workspace assistant',
    placeholder: 'Ask about cases, appointments, or clients...',
    send: 'Send',
    loading: 'Analyzing...',
    noReply: 'No reply',
    error: 'Connection error occurred',
  },
} as const

export default function AIAssistant() {
  const { locale, isRtl } = useLocale()
  const t = aiTexts[locale]

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState('')

  async function askAI() {
    if (!message.trim()) return

    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      })

      const data = await res.json()
      setReply(data.reply ?? t.noReply)
    } catch (e) {
      setReply(t.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-start">
          <p
            className="text-sm font-bold"
            style={{ color: 'var(--text)' }}
          >
            {t.title}
          </p>

          <p
            className="mt-1 text-xs"
            style={{ color: 'var(--text-3)' }}
          >
            {t.subtitle}
          </p>
        </div>
      </div>

      <div className="space-y-3">
<textarea
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  placeholder={t.placeholder}
  dir={isRtl ? 'rtl' : 'ltr'}
className="input h-[155px] resize-none text-start leading-relaxed placeholder:text-start"
/>

        <button
          type="button"
          onClick={askAI}
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? t.loading : t.send}
        </button>

        {reply && (
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="rounded-2xl p-4 text-start text-sm leading-7"
            style={{
              background: 'var(--green-soft)',
              color: 'var(--text)',
            }}
          >
            {reply}
          </div>
        )}
      </div>
    </div>
  )
}