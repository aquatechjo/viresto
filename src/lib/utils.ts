import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'د.أ') {
  return `${amount.toLocaleString('ar-JO', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} ${currency}`
}

export function formatDate(iso: string | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('ar-SA', opts ?? {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(iso))
}

export function formatTime(iso: string | Date) {
  return new Intl.DateTimeFormat('ar-SA', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

export function toHijri(iso: string | Date): string {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(iso))
  } catch { return '' }
}

export function relativeTime(iso: string | Date): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'اليوم'
  if (days === 1) return 'أمس'
  if (days < 7)   return `منذ ${days} أيام`
  if (days < 30)  return `منذ ${Math.floor(days / 7)} أسبوع`
  return `منذ ${Math.floor(days / 30)} شهر`
}

export function fileSizeLabel(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1_048_576)   return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

export function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}.${parts[1][0]}`
  return parts[0]?.slice(0, 2) ?? '؟'
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .slice(0, 40)
}
