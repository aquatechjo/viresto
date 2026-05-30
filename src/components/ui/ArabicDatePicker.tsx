'use client'
// src/components/ui/ArabicDatePicker.tsx
// Gregorian input that also displays the Hijri equivalent.
// No external dependency — uses Intl.DateTimeFormat with calendar:'islamic-umalqura'.

import { useState, useEffect, useRef } from 'react'

interface Props {
  value?: string         // ISO date string "YYYY-MM-DD"
  onChange: (iso: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  min?: string           // ISO date
  max?: string           // ISO date
  className?: string
}

function toHijri(isoDate: string): string {
  if (!isoDate) return ''
  try {
    const d = new Date(isoDate)
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day:   'numeric',
      month: 'long',
      year:  'numeric',
    }).format(d)
  } catch {
    return ''
  }
}

function toGregorianDisplay(isoDate: string): string {
  if (!isoDate) return ''
  try {
    const d = new Date(isoDate)
    return new Intl.DateTimeFormat('ar-EG', {
      day:   'numeric',
      month: 'long',
      year:  'numeric',
    }).format(d)
  } catch {
    return ''
  }
}

export default function ArabicDatePicker({
  value = '',
  onChange,
  label,
  placeholder = 'اختر التاريخ',
  required,
  min,
  max,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setDraft(value) }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hijri = toHijri(draft)
  const greg  = toGregorianDisplay(draft)

  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value)
    onChange(e.target.value)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-400 mr-1">*</span>}
        </label>
      )}

      {/* Display button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`
          w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm
          bg-[#1a2535] border transition-all duration-150
          ${open ? 'border-[#f5c842] ring-1 ring-[#f5c842]/30' : 'border-[#2d3f55] hover:border-[#f5c842]/50'}
          text-right
        `}
      >
        <span className={draft ? 'text-white' : 'text-gray-500'}>
          {draft ? greg : placeholder}
        </span>
        <svg className="w-4 h-4 text-[#f5c842] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#1a2535] border border-[#2d3f55] rounded-xl shadow-2xl p-4 animate-fadeIn">
          {/* Hijri display */}
          {hijri && (
            <div className="mb-3 text-center">
              <span className="text-xs text-[#f5c842] bg-[#f5c842]/10 px-3 py-1 rounded-full">
                🌙 {hijri}
              </span>
            </div>
          )}

          {/* Native date input */}
          <input
            type="date"
            value={draft}
            min={min}
            max={max}
            onChange={handleNativeChange}
            className="
              w-full bg-[#0f1923] border border-[#2d3f55] rounded-lg px-3 py-2
              text-white text-sm focus:outline-none focus:border-[#f5c842]
              [color-scheme:dark]
            "
          />

          {/* Quick shortcuts */}
          <div className="mt-3 grid grid-cols-3 gap-1">
            {[
              { label: 'اليوم',   days: 0  },
              { label: 'غداً',    days: 1  },
              { label: 'أسبوع',   days: 7  },
              { label: 'شهر',     days: 30 },
              { label: '3 أشهر',  days: 90 },
              { label: 'سنة',     days: 365 },
            ].map(({ label, days }) => {
              const d = new Date()
              d.setDate(d.getDate() + days)
              const iso = d.toISOString().split('T')[0]
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setDraft(iso); onChange(iso); setOpen(false) }}
                  className="text-xs text-gray-400 hover:text-[#f5c842] hover:bg-[#f5c842]/10 rounded-lg py-1 px-2 transition-colors"
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setDraft(''); onChange(''); setOpen(false) }}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              مسح
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs bg-[#f5c842] text-[#0f1923] font-bold px-3 py-1 rounded-lg hover:bg-[#f5c842]/90 transition-colors"
            >
              تأكيد
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
