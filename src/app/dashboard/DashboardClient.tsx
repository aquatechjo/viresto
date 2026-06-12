'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import PageLoader from '@/components/ui/PageLoader'
import StatCard from '@/components/ui/StatCard'
import { formatCurrency, formatTime } from '@/lib/utils'
import type { Locale } from '@/lib/i18n'
import { useLocale } from '@/lib/useLocale'
import AppLoader from "@/components/ui/AppLoader"
const AIAssistant = dynamic(() => import('@/components/dashboard/AIAssistant'), {
  ssr: false,
  loading: () => (
    <div
      className="card flex h-full min-h-[300px] items-center justify-center p-6 text-sm"
      style={{ color: 'var(--text-3)' }}
    >
      جاري تحميل المساعد...
    </div>
  ),
})

interface Stats {
  clientCount: number
  activeCaseCount: number
  totalCasesCount: number
  closedCasesCount: number
  closedCaseRate: number
  monthlyRevenue: number
  todayApptCount: number
  totalRevenue: number
  pendingAmount: number
  newClientsThisMonth: number
  todayAppts: {
    id: string
    title: string
    startTime: string
    location?: string
    type: string
  }[]
}

interface CaseItem {
  id: string
  title: string
  caseNumber?: string
  status: string
  client?: {
    name: string
  }
}

interface DocumentItem {
  id: string
  fileName: string
  fileType?: string
  createdAt: string
  tags?: string[]
}

interface ActivityItem {
  id: string
  type: string
  title: string
  message?: string
  createdAt: string
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge badge-green',
  IN_PROGRESS: 'badge badge-blue',
  CLOSED: 'badge badge-gray',
  ARCHIVED: 'badge badge-gray',
}

const STATUS_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    OPEN: 'نشطة',
    IN_PROGRESS: 'قيد المتابعة',
    CLOSED: 'مغلقة',
    ARCHIVED: 'مؤرشفة',
  },
  en: {
    OPEN: 'Active',
    IN_PROGRESS: 'In progress',
    CLOSED: 'Closed',
    ARCHIVED: 'Archived',
  },
}

const TYPE_COLOR: Record<string, string> = {
  COURT_SESSION: 'var(--sidebar)',
  MEETING: '#2563eb',
  PHONE_CALL: 'var(--gold)',
  DEADLINE: '#dc2626',
  OTHER: 'var(--text-3)',
}

const ACTIVITY_CONFIG: Record<
  string,
  {
    icon: string
    color: string
  }
> = {
  CLIENT_CREATED: {
    icon: '👤',
    color: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  },
  CASE_CREATED: {
    icon: '⚖️',
    color: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  },
  APPOINTMENT_CREATED: {
    icon: '📅',
    color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  },
  PAYMENT_CREATED: {
    icon: '💰',
    color: 'bg-green-500/20 text-green-700 border-green-500/30',
  },
  DOCUMENT_UPLOADED: {
    icon: '📄',
    color: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  },
  DOCUMENT_DELETED: {
    icon: '✨',
    color: 'bg-red-500/20 text-red-700 border-red-500/30',
  },
  DOCUMENT_UPDATED: {
    icon: '📝',
    color: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  },
  DOCUMENT_OPENED: {
    icon: '📖',
    color: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  },
  USER_CREATED: {
    icon: '👥',
    color: 'bg-cyan-500/20 text-cyan-700 border-cyan-500/30',
  },
  AI_ASSISTANT_ENABLED: {
    icon: '✨',
    color: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  },
  AI_ASSISTANT_DISABLED: {
    icon: '✨',
    color: 'bg-slate-500/20 text-slate-700 border-slate-500/30',
  },
}

const TEXT = {
  ar: {
    assistantLoading: 'جاري تحميل المساعد...',
    heroBadge: 'لوحة إدارة المكتب القانوني',
    heroTitle: 'إدارة القضايا والموكلين من مكان واحد',
    heroDescription:
      'مركز تحكم شامل لمتابعة أداء المكتب القانوني، من القضايا والمواعيد إلى المستندات والموكلين والمؤشرات المالية، بواجهة واضحة تساعدك على إدارة العمل بثقة.',
    todaySummary: 'ملخص اليوم',
    todayAppointments: 'مواعيد اليوم',
    activeCases: 'قضايا نشطة',
    clients: 'الموكلون',
    thisMonth: 'هذا الشهر',
    nextAppointment: 'أقرب موعد',
    noAppointment: 'لا يوجد',
    noUpcomingAppointments: 'لا توجد مواعيد قادمة',
    receivables: 'المستحقات',
    unpaid: 'غير محصلة',
    recentCases: 'آخر القضايا',
    recentCasesSub: 'أحدث القضايا المسجلة في المكتب',
    noCases: 'لا توجد قضايا',
    noClient: 'بدون موكل',
    todayScheduleOnly: 'جدول مواعيد اليوم فقط',
    noAppointmentsToday: 'لا مواعيد اليوم',
    recentDocuments: 'آخر المستندات',
    recentDocumentsSub: 'آخر 5 ملفات مرفوعة في النظام',
    noDocuments: 'لا يوجد مستندات بعد',
    officeSummary: 'ملخص المكتب',
    officeSummarySub: 'نظرة رقمية مختصرة على الأداء',
    totalCases: 'إجمالي القضايا',
    closedCases: 'القضايا المغلقة',
    monthlyRevenue: 'إيرادات الشهر',
    totalRevenue: 'إجمالي الإيرادات',
    recentActivities: 'آخر النشاطات',
    recentActivitiesSub: 'آخر 5 عمليات مسجلة داخل المكتب',
    noActivities: 'لا توجد نشاطات حالياً',
  },
  en: {
    assistantLoading: 'Loading assistant...',
    heroBadge: 'Legal office management dashboard',
    heroTitle: 'Manage cases and clients from one place',
    heroDescription:
      'A complete control center for monitoring your law office performance, from cases and appointments to documents, clients, and financial indicators.',
    todaySummary: 'Today summary',
    todayAppointments: 'Today appointments',
    activeCases: 'Active cases',
    clients: 'Clients',
    thisMonth: 'this month',
    nextAppointment: 'Next appointment',
    noAppointment: 'None',
    noUpcomingAppointments: 'No upcoming appointments',
    receivables: 'Receivables',
    unpaid: 'Unpaid',
    recentCases: 'Recent cases',
    recentCasesSub: 'Latest cases registered in the office',
    noCases: 'No cases found',
    noClient: 'No client',
    todayScheduleOnly: "Today's schedule only",
    noAppointmentsToday: 'No appointments today',
    recentDocuments: 'Recent documents',
    recentDocumentsSub: 'Latest 5 uploaded files in the system',
    noDocuments: 'No documents yet',
    officeSummary: 'Office summary',
    officeSummarySub: 'A quick numerical view of performance',
    totalCases: 'Total cases',
    closedCases: 'Closed cases',
    monthlyRevenue: 'Monthly revenue',
    totalRevenue: 'Total revenue',
    recentActivities: 'Recent activities',
    recentActivitiesSub: 'Latest 5 logged actions in the office',
    noActivities: 'No activities yet',
  },
} as const

const ACTIVITY_TEXT: Record<
  Locale,
  Record<string, { title: string; message?: string }>
> = {
  ar: {
    LOGIN_SUCCESS: { title: 'تم تسجيل الدخول بنجاح' },
    LOGIN_NEW_IP: { title: 'تسجيل دخول من جهاز أو IP جديد' },
    NEW_IP_LOGIN: { title: 'تسجيل دخول من جهاز أو IP جديد' },
    NEW_DEVICE_LOGIN: { title: 'تسجيل دخول من جهاز أو IP جديد' },
    SECURITY_LOGIN: { title: 'تسجيل دخول من جهاز أو IP جديد' },
    SUSPICIOUS_LOGIN: { title: 'تسجيل دخول من جهاز أو IP جديد' },

    CLIENT_CREATED: { title: 'تم إنشاء موكل جديد' },
    CLIENT_UPDATED: { title: 'تم تعديل بيانات موكل' },
    CLIENT_DELETED: { title: 'تم حذف موكل' },

    CASE_CREATED: { title: 'تم إنشاء قضية جديدة' },
    CASE_UPDATED: { title: 'تم تعديل قضية' },
    CASE_DELETED: { title: 'تم حذف قضية' },

    APPOINTMENT_CREATED: { title: 'تم إنشاء موعد جديد' },
    APPOINTMENT_UPDATED: { title: 'تم تعديل موعد' },
    APPOINTMENT_DELETED: { title: 'تم حذف موعد' },

    PAYMENT_CREATED: { title: 'تم تسجيل دفعة جديدة' },
    PAYMENT_ADDED: { title: 'تم تسجيل دفعة جديدة' },
    PAYMENT_UPDATED: { title: 'تم تعديل دفعة' },
    PAYMENT_DELETED: { title: 'تم حذف دفعة' },

    DOCUMENT_UPLOADED: { title: 'تم رفع مستند جديد' },
    DOCUMENT_CREATED: { title: 'تم رفع مستند جديد' },
    DOCUMENT_UPDATED: { title: 'تم تعديل مستند' },
    DOCUMENT_DELETED: { title: 'تم حذف مستند' },
    DOCUMENT_OPENED: { title: 'تم فتح مستند' },
    DOCUMENT_VIEWED: { title: 'تم فتح مستند' },
    DOCUMENT_PREVIEWED: { title: 'تم فتح مستند' },

    USER_CREATED: { title: 'تم إنشاء مستخدم جديد' },
    USER_UPDATED: { title: 'تم تعديل مستخدم' },
    USER_DISABLED: { title: 'تم تعطيل مستخدم' },
    USER_ENABLED: { title: 'تم تفعيل مستخدم' },

    AI_ASSISTANT_ENABLED: { title: 'تم تفعيل المساعد الذكي' },
    AI_ASSISTANT_DISABLED: { title: 'تم تعطيل المساعد الذكي' },
  },
  en: {
    LOGIN_SUCCESS: { title: 'Signed in successfully' },
    LOGIN_NEW_IP: { title: 'New device or IP sign-in' },
    NEW_IP_LOGIN: { title: 'New device or IP sign-in' },
    NEW_DEVICE_LOGIN: { title: 'New device or IP sign-in' },
    SECURITY_LOGIN: { title: 'New device or IP sign-in' },
    SUSPICIOUS_LOGIN: { title: 'New device or IP sign-in' },

    CLIENT_CREATED: { title: 'New client created' },
    CLIENT_UPDATED: { title: 'Client updated' },
    CLIENT_DELETED: { title: 'Client deleted' },

    CASE_CREATED: { title: 'New case created' },
    CASE_UPDATED: { title: 'Case updated' },
    CASE_DELETED: { title: 'Case deleted' },

    APPOINTMENT_CREATED: { title: 'New appointment created' },
    APPOINTMENT_UPDATED: { title: 'Appointment updated' },
    APPOINTMENT_DELETED: { title: 'Appointment deleted' },

    PAYMENT_CREATED: { title: 'New payment recorded' },
    PAYMENT_ADDED: { title: 'New payment recorded' },
    PAYMENT_UPDATED: { title: 'Payment updated' },
    PAYMENT_DELETED: { title: 'Payment deleted' },

    DOCUMENT_UPLOADED: { title: 'New document uploaded' },
    DOCUMENT_CREATED: { title: 'New document uploaded' },
    DOCUMENT_UPDATED: { title: 'Document updated' },
    DOCUMENT_DELETED: { title: 'Document deleted' },
    DOCUMENT_OPENED: { title: 'Document opened' },
    DOCUMENT_VIEWED: { title: 'Document opened' },
    DOCUMENT_PREVIEWED: { title: 'Document opened' },

    USER_CREATED: { title: 'New user created' },
    USER_UPDATED: { title: 'User updated' },
    USER_DISABLED: { title: 'User disabled' },
    USER_ENABLED: { title: 'User enabled' },

    AI_ASSISTANT_ENABLED: { title: 'AI assistant enabled' },
    AI_ASSISTANT_DISABLED: { title: 'AI assistant disabled' },
  },
}

function containsAny(source: string, patterns: string[]) {
  return patterns.some((pattern) => source.includes(pattern))
}
function normalizeActivityType(activity: ActivityItem) {
  const source = `${activity.type ?? ''} ${activity.title ?? ''} ${activity.message ?? ''}`
  const normalized = source.toLowerCase()

  if (
    containsAny(source, [
      'LOGIN_SUCCESS',
      'تم تسجيل الدخول بنجاح',
    ]) ||
    containsAny(normalized, [
      'signed in successfully',
      'login success',
    ])
  ) {
    return 'LOGIN_SUCCESS'
  }

  if (
    containsAny(source, [
      'LOGIN_NEW_IP',
      'NEW_IP_LOGIN',
      'NEW_DEVICE_LOGIN',
      'SECURITY_LOGIN',
      'SUSPICIOUS_LOGIN',
      'جديد IP',
      'IP جديد',
    ]) ||
    containsAny(normalized, [
      'new device',
      'new ip',
      'suspicious login',
    ])
  ) {
    return 'LOGIN_NEW_IP'
  }

  if (
    containsAny(source, [
      'DOCUMENT_OPENED',
      'DOCUMENT_VIEWED',
      'DOCUMENT_PREVIEWED',
      'OPEN_DOCUMENT',
      'VIEW_DOCUMENT',
      'PREVIEW_DOCUMENT',
      'فتح مستند',
      'عرض مستند',
      'معاينة مستند',
    ]) ||
    containsAny(normalized, [
      'document opened',
      'opened document',
      'document viewed',
      'viewed document',
      'document previewed',
      'previewed document',
    ])
  ) {
    return 'DOCUMENT_OPENED'
  }

  if (
    containsAny(source, ['DOCUMENT_DELETED', 'DOCUMENT_DELETE', 'DELETE_DOCUMENT', 'حذف مستند']) ||
    containsAny(normalized, ['document deleted', 'deleted document'])
  ) {
    return 'DOCUMENT_DELETED'
  }

  if (
    containsAny(source, ['DOCUMENT_UPDATED', 'UPDATE_DOCUMENT', 'تعديل مستند', 'تحديث مستند']) ||
    containsAny(normalized, ['document updated', 'updated document'])
  ) {
    return 'DOCUMENT_UPDATED'
  }

  if (
    containsAny(source, ['DOCUMENT_UPLOADED', 'DOCUMENT_CREATED', 'UPLOAD_DOCUMENT', 'رفع مستند', 'مستند جديد']) ||
    containsAny(normalized, ['new document uploaded', 'document uploaded', 'uploaded document'])
  ) {
    return 'DOCUMENT_UPLOADED'
  }

  if (
    containsAny(source, ['CLIENT_DELETED', 'DELETE_CLIENT', 'حذف موكل']) ||
    containsAny(normalized, ['client deleted', 'deleted client'])
  ) {
    return 'CLIENT_DELETED'
  }

  if (
    containsAny(source, ['CLIENT_UPDATED', 'UPDATE_CLIENT', 'تعديل موكل', 'تحديث موكل']) ||
    containsAny(normalized, ['client updated', 'updated client'])
  ) {
    return 'CLIENT_UPDATED'
  }

  if (
    containsAny(source, ['CLIENT_CREATED', 'CREATE_CLIENT', 'موكل جديد', 'إنشاء موكل']) ||
    containsAny(normalized, ['new client', 'client created', 'created client'])
  ) {
    return 'CLIENT_CREATED'
  }

  if (
    containsAny(source, ['CASE_DELETED', 'DELETE_CASE', 'حذف قضية']) ||
    containsAny(normalized, ['case deleted', 'deleted case'])
  ) {
    return 'CASE_DELETED'
  }

  if (
    containsAny(source, ['CASE_UPDATED', 'UPDATE_CASE', 'تعديل قضية', 'تحديث قضية']) ||
    containsAny(normalized, ['case updated', 'updated case'])
  ) {
    return 'CASE_UPDATED'
  }

  if (
    containsAny(source, ['CASE_CREATED', 'CREATE_CASE', 'قضية جديدة', 'إنشاء قضية']) ||
    containsAny(normalized, ['new case', 'case created', 'created case'])
  ) {
    return 'CASE_CREATED'
  }

  if (
    containsAny(source, ['APPOINTMENT_DELETED', 'DELETE_APPOINTMENT', 'حذف موعد']) ||
    containsAny(normalized, ['appointment deleted', 'deleted appointment'])
  ) {
    return 'APPOINTMENT_DELETED'
  }

  if (
    containsAny(source, ['APPOINTMENT_UPDATED', 'UPDATE_APPOINTMENT', 'تعديل موعد', 'تحديث موعد']) ||
    containsAny(normalized, ['appointment updated', 'updated appointment'])
  ) {
    return 'APPOINTMENT_UPDATED'
  }

  if (
    containsAny(source, ['APPOINTMENT_CREATED', 'CREATE_APPOINTMENT', 'موعد جديد', 'إنشاء موعد']) ||
    containsAny(normalized, ['new appointment', 'appointment created', 'created appointment'])
  ) {
    return 'APPOINTMENT_CREATED'
  }

  if (
    containsAny(source, ['PAYMENT_DELETED', 'DELETE_PAYMENT', 'حذف دفعة']) ||
    containsAny(normalized, ['payment deleted', 'deleted payment'])
  ) {
    return 'PAYMENT_DELETED'
  }

  if (
    containsAny(source, ['PAYMENT_UPDATED', 'UPDATE_PAYMENT', 'تعديل دفعة', 'تحديث دفعة']) ||
    containsAny(normalized, ['payment updated', 'updated payment'])
  ) {
    return 'PAYMENT_UPDATED'
  }

  if (
    containsAny(source, ['PAYMENT_CREATED', 'PAYMENT_ADDED', 'CREATE_PAYMENT', 'دفعة جديدة', 'تسجيل دفعة']) ||
    containsAny(normalized, ['new payment', 'payment recorded', 'payment created', 'payment added'])
  ) {
    return 'PAYMENT_CREATED'
  }

  if (
    containsAny(source, ['AI_ASSISTANT_ENABLED', 'ENABLE_AI_ASSISTANT', 'AI_ENABLED', 'تفعيل المساعد الذكي', 'تم تفعيل المساعد الذكي']) ||
    containsAny(normalized, ['ai assistant enabled', 'enabled ai assistant'])
  ) {
    return 'AI_ASSISTANT_ENABLED'
  }

  if (
    containsAny(source, ['AI_ASSISTANT_DISABLED', 'DISABLE_AI_ASSISTANT', 'AI_DISABLED', 'تعطيل المساعد الذكي', 'تم تعطيل المساعد الذكي']) ||
    containsAny(normalized, ['ai assistant disabled', 'disabled ai assistant'])
  ) {
    return 'AI_ASSISTANT_DISABLED'
  }

  if (
    containsAny(source, ['USER_DISABLED', 'DISABLE_USER', 'تعطيل مستخدم']) ||
    containsAny(normalized, ['user disabled', 'disabled user'])
  ) {
    return 'USER_DISABLED'
  }

  if (
    containsAny(source, ['USER_ENABLED', 'ENABLE_USER', 'تفعيل مستخدم']) ||
    containsAny(normalized, ['user enabled', 'enabled user'])
  ) {
    return 'USER_ENABLED'
  }

  if (
    containsAny(source, ['USER_UPDATED', 'UPDATE_USER', 'تعديل مستخدم']) ||
    containsAny(normalized, ['user updated', 'updated user'])
  ) {
    return 'USER_UPDATED'
  }

  if (
    containsAny(source, ['USER_CREATED', 'CREATE_USER', 'مستخدم جديد', 'إنشاء مستخدم']) ||
    containsAny(normalized, ['new user', 'user created', 'created user'])
  ) {
    return 'USER_CREATED'
  }

  return activity.type
}
function getActivityText(activity: ActivityItem, locale: Locale) {
  const activityType = normalizeActivityType(activity)
  const translated = ACTIVITY_TEXT[locale][activityType]
  const oppositeLocale = locale === 'ar' ? 'en' : 'ar'
  const oppositeTitle = ACTIVITY_TEXT[oppositeLocale][activityType]?.title
  const rawMessage = activity.message?.trim()
  const rawTitle = activity.title?.trim()

  return {
    title: translated?.title ?? rawTitle ?? activityType,
    message:
      rawMessage && rawMessage !== rawTitle && rawMessage !== translated?.title && rawMessage !== oppositeTitle
        ? rawMessage
        : undefined,
  }
}

function formatMoney(value: number, locale: Locale) {
  if (locale === 'en') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'JOD',
      maximumFractionDigits: 2,
    }).format(value)
  }

  return formatCurrency(value)
}

function getDocumentIcon(fileType?: string) {
  if (fileType === 'application/pdf') return '📄'
  if (fileType?.startsWith('image/')) return '🖼️'
  return '📁'
}

function formatDate(date: string, locale: Locale) {
  return new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-JO' : 'en-US')
}

export default function DashboardPage() {
  const { locale, isRtl } = useLocale()
  const t = TEXT[locale]
  const statusLabels = STATUS_LABELS[locale]

  const [stats, setStats] = useState<Stats | null>(null)
  const [cases, setCases] = useState<CaseItem[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const responses = await Promise.all([
          fetch('/api/dashboard-stats'),
          fetch('/api/cases?limit=4'),
          fetch('/api/activity?limit=5'),
          fetch('/api/documents?limit=5'),
        ])

        const json = await Promise.all(
          responses.map(async (response) => {
            if (!response.ok) {
              console.warn('Dashboard API failed:', response.url, response.status)
              return { data: [] }
            }

            try {
              return await response.json()
            } catch {
              return { data: [] }
            }
          })
        )

        const [statsData, casesData, activitiesData, documentsData] = json

        setStats(statsData.data || null)
        setCases(Array.isArray(casesData.data) ? casesData.data.slice(0, 4) : [])
        setActivities(Array.isArray(activitiesData.data) ? activitiesData.data.slice(0, 5) : [])
        setDocuments(Array.isArray(documentsData.data) ? documentsData.data.slice(0, 5) : [])
      } catch (error) {
        console.error('Dashboard load failed:', error)

        setStats(null)
        setCases([])
        setActivities([])
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const recentDocuments = useMemo(() => documents.slice(0, 5), [documents])
  const firstAppointment = stats?.todayAppts?.[0]

if (loading) {
  return <AppLoader fullScreen={false} text="جاري تحميل لوحة التحكم..." />
}

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-5 text-start stagger">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6 md:p-7"
        style={{
          background:
            'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 55%, var(--sidebar-dark) 100%)',
          borderColor: 'rgba(255,255,255,0.12)',
          boxShadow: '0 22px 60px rgba(45, 74, 62, 0.22)',
        }}
      >
        <div
          className="absolute -start-16 -top-16 h-44 w-44 rounded-full"
          style={{ background: 'rgba(245, 200, 66, 0.18)' }}
        />

        <div
          className="absolute -bottom-20 end-12 h-56 w-56 rounded-full"
          style={{ background: 'rgba(255, 255, 255, 0.08)' }}
        />

        <div className="relative z-10">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.13)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <span>⚖️</span>
              <span>{t.heroBadge}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_.75fr] lg:items-center">
            <div>
              <h1 className="text-2xl font-black leading-relaxed text-white md:text-3xl">
                {t.heroTitle}
              </h1>

              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/75">
                {t.heroDescription}
              </p>
            </div>

            <div
              className="rounded-3xl p-5"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <p className="text-sm font-black text-white">{t.todaySummary}</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div
                  className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.12)' }}
                >
                  <p className="text-xs font-bold text-white/65">{t.todayAppointments}</p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {stats?.todayApptCount ?? 0}
                  </p>
                </div>

                <div
                  className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.12)' }}
                >
                  <p className="text-xs font-bold text-white/65">{t.activeCases}</p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {stats?.activeCaseCount ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="relative z-0 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label={t.clients}
          value={stats?.clientCount ?? 0}
          sub={`+${stats?.newClientsThisMonth ?? 0} ${t.thisMonth}`}
        />

        <StatCard
          label={t.nextAppointment}
          value={firstAppointment ? firstAppointment.title : t.noAppointment}
          sub={firstAppointment ? `${formatTime(firstAppointment.startTime)}` : t.noUpcomingAppointments}
        />

        <StatCard
          label={t.receivables}
          value={formatMoney(stats?.pendingAmount ?? 0, locale)}
          sub={t.unpaid}
          bg={(stats?.pendingAmount ?? 0) > 0 ? 'var(--red-soft)' : undefined}
          color={(stats?.pendingAmount ?? 0) > 0 ? '#dc2626' : undefined}
        />
      </div>

      {/* AI + Cases + Appointments */}
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <div className="h-full min-h-[300px] [&>*]:h-full">
          <AIAssistant />
        </div>

        {/* Recent Cases */}
        <div className="card h-full min-h-[300px] p-5">
          <div className="mb-4">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {t.recentCases}
            </p>

            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
              {t.recentCasesSub}
            </p>
          </div>

          {cases.length === 0 ? (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>
              {t.noCases}
            </p>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border p-3"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-black" style={{ color: 'var(--text)' }}>
                      {c.title}
                    </p>

                    <span className={STATUS_BADGE[c.status] ?? 'badge badge-gray'}>
                      {statusLabels[c.status] ?? c.status}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="truncate text-xs" style={{ color: 'var(--text-3)' }}>
                      {c.client?.name ?? t.noClient}
                    </p>

                    <p className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                      #{c.caseNumber?.split('/').pop() ?? c.id.slice(-4)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Appointments */}
        <div className="card h-full min-h-[300px] p-5">
          <div className="mb-4">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {t.todayAppointments}
            </p>

            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
              {t.todayScheduleOnly}
            </p>
          </div>

          {!stats?.todayAppts?.length ? (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>
              {t.noAppointmentsToday}
            </p>
          ) : (
            <div className="space-y-4">
              {stats.todayAppts.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div
                    className="w-1 shrink-0 self-stretch rounded-full"
                    style={{
                      background: TYPE_COLOR[a.type] ?? 'var(--text-3)',
                      minHeight: 44,
                    }}
                  />

                  <div className="min-w-0">
                    <p className="text-sm font-black" style={{ color: 'var(--text)' }}>
                      {formatTime(a.startTime)}
                    </p>

                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {a.title}
                    </p>

                    {a.location && (
                      <p className="truncate text-xs" style={{ color: 'var(--text-3)' }}>
                        {a.location}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Documents + Office Summary */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Documents */}
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {t.recentDocuments}
            </h3>

            <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
              {t.recentDocumentsSub}
            </p>
          </div>

          <div className="space-y-3">
            {recentDocuments.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>
                {t.noDocuments}
              </p>
            ) : (
              recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border p-3"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ background: 'var(--green-soft)' }}
                    >
                      {getDocumentIcon(doc.fileType)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold" style={{ color: 'var(--text)' }}>
                        {doc.fileName}
                      </p>

                      {!!doc.tags?.length && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {doc.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border px-2 py-1 text-[10px]"
                              style={{
                                background: 'var(--green-soft)',
                                color: 'var(--sidebar)',
                                borderColor: 'transparent',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 text-xs" style={{ color: 'var(--text-3)' }}>
                    {formatDate(doc.createdAt, locale)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Office Summary */}
        <div className="card p-5">
          <div className="mb-5">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {t.officeSummary}
            </h3>

            <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
              {t.officeSummarySub}
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                {t.totalCases}
              </p>

              <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text)' }}>
                {stats?.totalCasesCount ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                {t.closedCases}
              </p>

              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="text-2xl font-black" style={{ color: 'var(--text)' }}>
                  {stats?.closedCasesCount ?? 0}
                </p>

                <span className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                  {stats?.closedCaseRate ?? 0}%
                </span>
              </div>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                {t.monthlyRevenue}
              </p>

              <p className="mt-1 text-2xl font-black" style={{ color: 'var(--sidebar)' }}>
                {formatMoney(stats?.monthlyRevenue ?? 0, locale)}
              </p>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
                {t.totalRevenue}
              </p>

              <p className="mt-1 text-2xl font-black" style={{ color: 'var(--sidebar)' }}>
                {formatMoney(stats?.totalRevenue ?? 0, locale)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="card p-5">
        <div className="mb-4">
          <h3 className="text-lg font-black" style={{ color: 'var(--text)' }}>
            {t.recentActivities}
          </h3>

          <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
            {t.recentActivitiesSub}
          </p>
        </div>

        {activities.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed p-6 text-center text-sm"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-3)',
            }}
          >
            {t.noActivities}
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 5).map((activity) => {
              const activityType = normalizeActivityType(activity)
              const config = ACTIVITY_CONFIG[activityType] ?? {
                icon: '✨',
                color: '',
              }
              const activityText = getActivityText(activity, locale)

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-2xl border p-4"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--green-soft)',
                    color: 'var(--text)',
                  }}
                >
                  <div className="shrink-0 text-xl">{config.icon}</div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-bold">{activityText.title}</p>

                      <span className="whitespace-nowrap text-xs" style={{ color: 'var(--text-3)' }}>
                        {formatDate(activity.createdAt, locale)}
                      </span>
                    </div>

                    {activityText.message && (
                      <p className="mt-1 truncate text-sm" style={{ color: 'var(--text-2)' }}>
                        {activityText.message}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
