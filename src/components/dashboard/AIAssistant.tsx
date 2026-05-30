'use client'

import { useState } from 'react'

export default function AIAssistant() {
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
        body: JSON.stringify({
          message,
        }),
      })

      const data = await res.json()

      setReply(data.reply ?? 'لا يوجد رد')
    } catch (e) {
      setReply('حدث خطأ أثناء الاتصال')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p
            className="font-bold text-sm"
            style={{ color: 'var(--text)' }}
          >
            المساعد القانوني الذكي
          </p>

          <p
            className="text-xs mt-1"
            style={{ color: 'var(--text-3)' }}
          >
            AI Legal Assistant
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اسأل عن القضايا أو المواعيد أو العملاء..."
          className="input min-h-[110px]"
        />

        <button
          onClick={askAI}
          disabled={loading}
          className="btn btn-primary w-full"
        >
          {loading ? 'جاري التحليل...' : 'إرسال'}
        </button>

        {reply && (
          <div
            className="rounded-2xl p-4 text-sm leading-7"
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