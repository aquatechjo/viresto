'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import PageLoader from '@/components/ui/PageLoader'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import { fileSizeLabel, formatCurrency, formatDate, formatTime } from '@/lib/utils'

interface Payment {
  id: string
  amount: number
  status: string
  method: string
  paidAt: string
  notes?: string | null
  invoice?: {
    id: string
    invoiceNumber: string
    status: string
    total: number
  } | null
}

interface Appointment {
  id: string
  title: string
  description?: string | null
  startTime: string
  endTime?: string | null
  type: string
  status: string
  location?: string | null
}

interface DocumentItem {
  id: string
  fileName: string
  fileType: string
  fileSize?: number | null
  fileUrl?: string | null
  notes?: string | null
  tags?: string[]
  createdAt: string
}

interface TaskItem {
  id: string
  title: string
  description?: string | null
  dueDate?: string | null
  priority: string
  completed: boolean
  createdAt: string
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  status: string
  issueDate: string
  dueDate?: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  notes?: string | null
  items: InvoiceItem[]
  payment?: {
    id: string
    status: string
    amount: number
  } | null
}

interface Activity {
  id: string
  type: string
  title: string
  message?: string | null
  entityType?: string | null
  entityId?: string | null
  createdAt: string
}

interface CaseDetail {
  id: string
  title: string
  caseNumber?: string | null
  court?: string | null
  status: string
  feeAgreed: number
  description?: string | null
  createdAt: string
  updatedAt: string
client: {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  nationalId?: string | null
  address?: string | null
}
  payments: Payment[]
  appointments: Appointment[]
  documents: DocumentItem[]
  tasks: TaskItem[]
  invoices: Invoice[]
  activities: Activity[]
}

const STATUS_AR: Record<string, string> = {
  OPEN: 'نشطة',
  IN_PROGRESS: 'قيد المتابعة',
  CLOSED: 'مغلقة',
  ARCHIVED: 'مؤرشفة',
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge badge-green',
  IN_PROGRESS: 'badge badge-blue',
  CLOSED: 'badge badge-gray',
  ARCHIVED: 'badge badge-gray',
}

const STATUSES = [
  ['OPEN', 'نشطة'],
  ['IN_PROGRESS', 'قيد المتابعة'],
  ['CLOSED', 'مغلقة'],
  ['ARCHIVED', 'مؤرشفة'],
] as const

const METHOD_AR: Record<string, string> = {
  CASH: 'نقدًا',
  BANK_TRANSFER: 'تحويل بنكي',
  CHECK: 'شيك',
  ONLINE: 'إلكتروني',
}

const PMT_STATUS: Record<string, string> = {
  PAID: 'badge badge-green',
  PENDING: 'badge badge-amber',
  OVERDUE: 'badge badge-red',
  CANCELLED: 'badge badge-gray',
}

const PMT_AR: Record<string, string> = {
  PAID: 'مدفوع',
  PENDING: 'معلق',
  OVERDUE: 'متأخر',
  CANCELLED: 'ملغي',
}

const INVOICE_STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  UNPAID: 'غير مدفوعة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  CANCELLED: 'ملغاة',
}

const INVOICE_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge badge-gray',
  UNPAID: 'badge badge-amber',
  PAID: 'badge badge-green',
  OVERDUE: 'badge badge-red',
  CANCELLED: 'badge badge-gray',
}

const TASK_PRIORITY_AR: Record<string, string> = {
  URGENT: 'عاجلة',
  HIGH: 'عالية',
  MEDIUM: 'متوسطة',
  LOW: 'منخفضة',
}

const TASK_PRIORITY_BADGE: Record<string, string> = {
  URGENT: 'badge badge-red',
  HIGH: 'badge badge-red',
  MEDIUM: 'badge badge-amber',
  LOW: 'badge badge-gray',
}

const APPT_TYPE_AR: Record<string, string> = {
  MEETING: 'اجتماع',
  COURT_SESSION: 'جلسة محكمة',
  PHONE_CALL: 'مكالمة',
  DEADLINE: 'موعد نهائي',
  OTHER: 'أخرى',
}

const APPT_STATUS_AR: Record<string, string> = {
  SCHEDULED: 'مجدول',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغي',
}

const ACTIVITY_ICON: Record<string, string> = {
  CLIENT_CREATED: '👤',
  CASE_CREATED: '⚖️',
  APPOINTMENT_CREATED: '📅',
  PAYMENT_CREATED: '💰',
  DOCUMENT_UPLOADED: '📄',
  TASK_CREATED: '✅',
  INVOICE_CREATED: '🧾',
  USER_CREATED: '👥',
}

const DOCUMENT_TAGS = ['عقد', 'قضية', 'هوية', 'حكم', 'إثبات', 'لائحة', 'مالية']

const PMT_INIT = {
  amount: '',
  method: 'CASH',
  status: 'PAID',
  notes: '',
  paidAt: '',
}

const APPOINTMENT_INIT = {
  title: '',
  type: 'COURT_SESSION',
  startTime: '',
  endTime: '',
  location: '',
  description: '',
}

const TASK_INIT = {
  title: '',
  priority: 'MEDIUM',
  dueDate: '',
  description: '',
}

const INVOICE_INIT = {
  description: 'أتعاب قانونية',
  amount: '',
  tax: '0',
  discount: '0',
  dueDate: '',
  notes: '',
}

const DOCUMENT_INIT = {
  tag: 'قضية',
  notes: '',
}

function getApiMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback
}

function safeNumber(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function documentIcon(fileType?: string | null) {
  if (fileType === 'application/pdf') return '📄'
  if (fileType?.startsWith('image/')) return '🖼️'
  if (fileType?.includes('word')) return '📝'
  return '📁'
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [c, setC] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [documentOpen, setDocumentOpen] = useState(false)

  const [paymentForm, setPaymentForm] = useState(PMT_INIT)
  const [appointmentForm, setAppointmentForm] = useState(APPOINTMENT_INIT)
  const [taskForm, setTaskForm] = useState(TASK_INIT)
  const [invoiceForm, setInvoiceForm] = useState(INVOICE_INIT)
  const [documentForm, setDocumentForm] = useState(DOCUMENT_INIT)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)

  const documentInputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    if (!id || id === 'undefined') {
      setLoading(false)
      toast.error('رقم القضية غير موجود')
      return
    }

    try {
      setLoading(true)

      const response = await fetch(`/api/cases/${id}`)
      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        setC(data.data)
      } else {
        toast.error(getApiMessage(data, 'القضية غير موجودة'))
      }
    } catch {
      toast.error('تعذر تحميل بيانات القضية')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const totalPaid =
      c?.payments
        ?.filter((payment) => payment.status === 'PAID')
        .reduce((sum, payment) => sum + payment.amount, 0) ?? 0

    const invoicesTotal =
      c?.invoices
        ?.filter((invoice) => invoice.status !== 'CANCELLED')
        .reduce((sum, invoice) => sum + invoice.total, 0) ?? 0

    const unpaidInvoicesTotal =
      c?.invoices
        ?.filter(
          (invoice) =>
            invoice.status !== 'PAID' && invoice.status !== 'CANCELLED'
        )
        .reduce((sum, invoice) => sum + invoice.total, 0) ?? 0

    const remaining = Math.max(0, (c?.feeAgreed ?? 0) - totalPaid)

    const pct =
      (c?.feeAgreed ?? 0) > 0
        ? Math.min((totalPaid / (c?.feeAgreed ?? 1)) * 100, 100)
        : 0

    return {
      totalPaid,
      invoicesTotal,
      unpaidInvoicesTotal,
      remaining,
      pct,
    }
  }, [c])

  const upcomingAppointments = useMemo(() => {
    const now = Date.now()

    return (c?.appointments ?? [])
      .filter(
        (appointment) =>
          appointment.status !== 'CANCELLED' &&
          new Date(appointment.startTime).getTime() >= now
      )
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
      .slice(0, 5)
  }, [c])

  const overdueTasks = useMemo(() => {
    const now = Date.now()

    return (c?.tasks ?? []).filter(
      (task) =>
        !task.completed &&
        task.dueDate &&
        new Date(task.dueDate).getTime() < now
    ).length
  }, [c])

  async function updateStatus(status: string) {
    if (!id || id === 'undefined') {
      toast.error('رقم القضية غير موجود')
      return
    }

    if (c?.status === status) return

    const response = await fetch(`/api/cases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok && data.success) {
      toast.success('تم تحديث حالة القضية')
      load()
    } else {
      toast.error(getApiMessage(data, 'تعذر تحديث الحالة'))
    }
  }

  async function addPayment(event: FormEvent) {
    event.preventDefault()

    if (!paymentForm.amount) {
      toast.error('المبلغ مطلوب')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentForm,
          caseId: id,
          amount: safeNumber(paymentForm.amount),
          paidAt: paymentForm.paidAt || new Date().toISOString(),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        toast.success('تمت إضافة الدفعة')
        setPaymentOpen(false)
        setPaymentForm(PMT_INIT)
        load()
      } else {
        toast.error(getApiMessage(data, 'تعذر إضافة الدفعة'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function addAppointment(event: FormEvent) {
    event.preventDefault()

    if (!appointmentForm.title.trim()) {
      toast.error('عنوان الموعد مطلوب')
      return
    }

    if (!appointmentForm.startTime) {
      toast.error('وقت بداية الموعد مطلوب')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: appointmentForm.title.trim(),
          type: appointmentForm.type,
          startTime: appointmentForm.startTime,
          endTime: appointmentForm.endTime || undefined,
          location: appointmentForm.location || undefined,
          description: appointmentForm.description || undefined,
          clientId: c?.client.id,
          caseId: id,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        toast.success('تمت إضافة الموعد')
        setAppointmentOpen(false)
        setAppointmentForm(APPOINTMENT_INIT)
        load()
      } else {
        toast.error(getApiMessage(data, 'تعذر إضافة الموعد'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteAppointment(appointment: Appointment) {
    const confirmed = window.confirm(`هل تريد حذف الموعد: ${appointment.title}؟`)
    if (!confirmed) return

    const response = await fetch(`/api/appointments/${appointment.id}`, {
      method: 'DELETE',
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok && data.success) {
      toast.success('تم حذف الموعد')
      load()
    } else {
      toast.error(getApiMessage(data, 'تعذر حذف الموعد'))
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault()

    if (!taskForm.title.trim()) {
      toast.error('عنوان المهمة مطلوب')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          priority: taskForm.priority,
          dueDate: taskForm.dueDate || undefined,
          description: taskForm.description || undefined,
          clientId: c?.client.id,
          caseId: id,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        toast.success('تمت إضافة المهمة')
        setTaskOpen(false)
        setTaskForm(TASK_INIT)
        load()
      } else {
        toast.error(getApiMessage(data, 'تعذر إضافة المهمة'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(task: TaskItem) {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !task.completed }),
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok && data.success) {
      toast.success(task.completed ? 'تمت إعادة فتح المهمة' : 'تم إكمال المهمة')
      load()
    } else {
      toast.error(getApiMessage(data, 'تعذر تحديث المهمة'))
    }
  }

  async function deleteTask(task: TaskItem) {
    const confirmed = window.confirm(`هل تريد حذف المهمة: ${task.title}؟`)
    if (!confirmed) return

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'DELETE',
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok && data.success) {
      toast.success('تم حذف المهمة')
      load()
    } else {
      toast.error(getApiMessage(data, 'تعذر حذف المهمة'))
    }
  }

  async function createInvoice(event: FormEvent) {
    event.preventDefault()

    if (!invoiceForm.description.trim()) {
      toast.error('وصف البند مطلوب')
      return
    }

    if (!invoiceForm.amount) {
      toast.error('المبلغ مطلوب')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: c?.client.id,
          caseId: id,
          dueDate: invoiceForm.dueDate || undefined,
          tax: safeNumber(invoiceForm.tax),
          discount: safeNumber(invoiceForm.discount),
          notes: invoiceForm.notes || undefined,
          items: [
            {
              description: invoiceForm.description.trim(),
              quantity: 1,
              unitPrice: safeNumber(invoiceForm.amount),
            },
          ],
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        toast.success('تم إنشاء الفاتورة')
        setInvoiceOpen(false)
        setInvoiceForm(INVOICE_INIT)
        load()

        if (data.data?.id) {
          router.push(`/dashboard/invoices/${data.data.id}`)
        }
      } else {
        toast.error(getApiMessage(data, 'تعذر إنشاء الفاتورة'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteInvoice(invoice: Invoice) {
    if (invoice.payment) {
      toast.error('لا يمكن حذف فاتورة مرتبطة بدفعة. افتح الفاتورة وغيّر حالتها أولًا.')
      return
    }

    const confirmed = window.confirm(`هل تريد حذف الفاتورة ${invoice.invoiceNumber}؟`)
    if (!confirmed) return

    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'DELETE',
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok && data.success) {
      toast.success('تم حذف الفاتورة')
      load()
    } else {
      toast.error(getApiMessage(data, 'تعذر حذف الفاتورة'))
    }
  }

  async function uploadCaseDocument(file?: File | null) {
    if (!file) {
      toast.error('اختر ملفًا أولًا')
      return
    }

    if (!c) {
      toast.error('بيانات القضية غير جاهزة')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الملف يتجاوز 10 ميجابايت')
      return
    }

    try {
      setUploadingDocument(true)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('caseId', id)
      formData.append('clientId', c.client.id)
      formData.append(
        'tags',
        JSON.stringify(documentForm.tag ? [documentForm.tag] : ['قضية'])
      )

      if (documentForm.notes.trim()) {
        formData.append('notes', documentForm.notes.trim())
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        toast.success('تم رفع المستند وربطه بالقضية')
        setDocumentOpen(false)
        setDocumentForm(DOCUMENT_INIT)

        if (documentInputRef.current) {
          documentInputRef.current.value = ''
        }

        load()
      } else {
        toast.error(getApiMessage(data, 'تعذر رفع المستند'))
      }
    } catch {
      toast.error('حدث خطأ أثناء رفع المستند')
    } finally {
      setUploadingDocument(false)
    }
  }

  async function deleteDocument(doc: DocumentItem) {
    const confirmed = window.confirm(`هل تريد حذف المستند: ${doc.fileName}؟`)
    if (!confirmed) return

    const response = await fetch(`/api/documents/${doc.id}`, {
      method: 'DELETE',
    })

    const data = await response.json().catch(() => ({}))

    if (response.ok && data.success) {
      toast.success('تم حذف المستند')
      load()
    } else {
      toast.error(getApiMessage(data, 'تعذر حذف المستند'))
    }
  }

  async function confirmDeletePayment() {
    if (!deleteId) return

    try {
      setDeleteLoading(true)

      const response = await fetch(`/api/payments/${deleteId}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(getApiMessage(data, 'فشل حذف الدفعة'))
        return
      }

      toast.success('تم حذف الدفعة')
      setDeleteId(null)
      load()
    } catch {
      toast.error('حدث خطأ أثناء حذف الدفعة')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) return <PageLoader />

  if (!c) {
    return (
      <div className="space-y-5 stagger">
        <div className="card p-10 text-center">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            القضية غير موجودة
          </h1>

          <p className="mt-2 text-sm" style={{ color: 'var(--text-3)' }}>
            تعذر العثور على بيانات هذه القضية.
          </p>

          <button onClick={() => router.back()} className="btn btn-primary mt-5">
            رجوع
          </button>
        </div>
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

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                ملف القضية
              </span>

              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: '#fff',
                  color: 'var(--sidebar)',
                }}
              >
                {STATUS_AR[c.status] || c.status}
              </span>

              {c.caseNumber && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                  }}
                >
                  رقم القضية: {c.caseNumber}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-white">{c.title}</h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              {c.court || 'بدون محكمة محددة'} · أُضيفت {formatDate(c.createdAt)}
            </p>

            {c.description && (
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/75">
                {c.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
                borderColor: 'rgba(255,255,255,0.32)',
              }}
            >
              رجوع
            </button>

            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="btn"
              style={{
                background: 'rgba(245,200,66,0.18)',
                color: '#fff',
                borderColor: 'rgba(245,200,66,0.35)',
              }}
            >
              + دفعة
            </button>

            <button
              type="button"
              onClick={() => setInvoiceOpen(true)}
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            >
              + فاتورة
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'الأتعاب المتفق عليها',
            value: formatCurrency(c.feeAgreed || 0),
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: 'المحصّل',
            value: formatCurrency(totals.totalPaid),
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: 'المتبقي',
            value: formatCurrency(totals.remaining),
            color: totals.remaining > 0 ? '#dc2626' : 'var(--text-3)',
            bg: totals.remaining > 0 ? 'var(--red-soft)' : 'var(--card)',
          },
          {
            label: 'نسبة التحصيل',
            value: `${Math.round(totals.pct)}%`,
            color: totals.pct >= 80 ? 'var(--sidebar)' : '#92400e',
            bg: totals.pct >= 80 ? 'var(--green-soft)' : 'var(--amber-soft)',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5"
            style={{ background: item.bg, borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-black" style={{ color: item.color }}>
              {item.label}
            </p>

            <p className="mt-2 text-2xl font-black" style={{ color: item.color }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAppointmentOpen(true)} className="btn btn-ghost">
            + موعد
          </button>
          <button onClick={() => setTaskOpen(true)} className="btn btn-ghost">
            + مهمة
          </button>
          <button onClick={() => setDocumentOpen(true)} className="btn btn-ghost">
            + مستند
          </button>
          <button onClick={() => setPaymentOpen(true)} className="btn btn-ghost">
            + دفعة
          </button>
          <button onClick={() => setInvoiceOpen(true)} className="btn btn-ghost">
            + فاتورة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Sidebar */}
        <div className="space-y-5 xl:col-span-4">
          <div className="card p-5">
            <div className="mb-4">
              <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
                الموكل
              </p>
              <h2 className="mt-1 text-xl font-black" style={{ color: 'var(--text)' }}>
                {c.client.name}
              </h2>
            </div>

<Link
  href={`/dashboard/clients/${c.client.id}`}
  className="block rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
  style={{
    borderColor: 'var(--border)',
    background: 'var(--green-soft)',
  }}
>
  <div className="flex items-start justify-between gap-3">
    <div>
      <p className="text-xs font-black" style={{ color: 'var(--text-2)' }}>
        الموكل
      </p>

      <h3 className="mt-1 text-lg font-black" style={{ color: 'var(--sidebar)' }}>
        {c.client.name || 'غير مضاف'}
      </h3>
    </div>

    <span
      className="rounded-full px-3 py-1 text-xs font-black"
      style={{
        background: 'var(--card)',
        color: 'var(--sidebar)',
        border: '1px solid var(--border)',
      }}
    >
      فتح ملف الموكل
    </span>
  </div>

  <div
    className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2"
    style={{ borderColor: 'var(--border)' }}
  >
    <div>
      <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
        الهاتف
      </p>
      <p className="mt-1 truncate text-sm font-bold" style={{ color: 'var(--text)' }}>
        {c.client.phone || 'غير مضاف'}
      </p>
    </div>

    <div>
      <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
        البريد الإلكتروني
      </p>
      <p className="mt-1 truncate text-sm font-bold" style={{ color: 'var(--text)' }}>
        {c.client.email || 'غير مضاف'}
      </p>
    </div>

    <div>
      <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
        الرقم الوطني / الهوية
      </p>
      <p className="mt-1 truncate text-sm font-bold" style={{ color: 'var(--text)' }}>
       {c.client.nationalId || 'غير مضاف'}
      </p>
    </div>

    <div>
      <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
        العنوان
      </p>
      <p className="mt-1 line-clamp-2 break-words text-sm font-bold" style={{ color: 'var(--text)' }}>
        {c.client.address || 'غير مضاف'}
      </p>
    </div>
  </div>
</Link>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex justify-between text-xs font-black">
              <span style={{ color: 'var(--sidebar)' }}>
                {Math.round(totals.pct)}% محصّل
              </span>
              <span style={{ color: 'var(--text-3)' }}>نسبة التحصيل</span>
            </div>

            <div
              className="h-2.5 overflow-hidden rounded-full"
              style={{ background: 'var(--input-bg)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${totals.pct}%`,
                  background:
                    totals.pct >= 100
                      ? 'var(--sidebar)'
                      : totals.pct >= 60
                        ? '#f59e0b'
                        : '#dc2626',
                }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="الفواتير" value={formatCurrency(totals.invoicesTotal)} />
              <MiniMetric
                label="غير مدفوع"
                value={formatCurrency(totals.unpaidInvoicesTotal)}
                danger={totals.unpaidInvoicesTotal > 0}
              />
            </div>
          </div>

          <div className="card p-5">
            <p className="mb-3 text-xs font-black" style={{ color: 'var(--text-3)' }}>
              تغيير حالة القضية
            </p>

            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(([status, label]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateStatus(status)}
                  className="rounded-2xl px-3 py-2 text-xs font-black transition-all"
                  style={
                    c.status === status
                      ? {
                          background: 'var(--sidebar)',
                          color: '#fff',
                        }
                      : {
                          background: 'var(--green-soft)',
                          color: 'var(--text-2)',
                        }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Timeline activities={c.activities} />
        </div>

        {/* Main sections */}
        <div className="space-y-5 xl:col-span-8">
          <SectionCard
            title="المواعيد والجلسات"
            count={c.appointments.length}
            action={
              <button onClick={() => setAppointmentOpen(true)} className="btn btn-ghost">
                + موعد
              </button>
            }
          >
            {c.appointments.length === 0 ? (
              <EmptyLine text="لا توجد مواعيد مرتبطة بهذه القضية." />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {(upcomingAppointments.length
                  ? upcomingAppointments
                  : c.appointments.slice(0, 6)
                ).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--card)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="badge badge-blue">
                        {APPT_TYPE_AR[appointment.type] || appointment.type}
                      </span>

                      <div className="text-right">
                        <p className="font-black" style={{ color: 'var(--text)' }}>
                          {appointment.title}
                        </p>

                        <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                          {formatDate(appointment.startTime)} ·{' '}
                          {formatTime(appointment.startTime)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      style={{ color: 'var(--text-2)' }}
                    >
                      <span>{APPT_STATUS_AR[appointment.status] || appointment.status}</span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => deleteAppointment(appointment)}
                          className="rounded-xl px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                        >
                          حذف
                        </button>

                        <span>{appointment.location || 'بدون موقع'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="المهام"
            count={c.tasks.length}
            action={
              <button onClick={() => setTaskOpen(true)} className="btn btn-ghost">
                + مهمة
              </button>
            }
          >
            {c.tasks.length === 0 ? (
              <EmptyLine text="لا توجد مهام مرتبطة بهذه القضية." />
            ) : (
              <div className="space-y-2">
                {c.tasks.slice(0, 8).map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      task.completed ? 'opacity-60' : ''
                    }`}
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTask(task)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black"
                      style={{
                        borderColor: 'var(--sidebar)',
                        background: task.completed ? 'var(--sidebar)' : 'transparent',
                        color: task.completed ? '#fff' : 'transparent',
                      }}
                    >
                      ✓
                    </button>

                    <div className="min-w-0 flex-1 text-right">
                      <p className="font-black" style={{ color: 'var(--text)' }}>
                        {task.title}
                      </p>

                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {task.dueDate
                          ? `تاريخ الاستحقاق: ${formatDate(task.dueDate)}`
                          : 'بدون تاريخ'}
                      </p>
                    </div>

                    <span className={TASK_PRIORITY_BADGE[task.priority] || 'badge badge-gray'}>
                      {TASK_PRIORITY_AR[task.priority] || task.priority}
                    </span>

                    <button
                      type="button"
                      onClick={() => deleteTask(task)}
                      className="rounded-xl px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="الفواتير"
            count={c.invoices.length}
            action={
              <button onClick={() => setInvoiceOpen(true)} className="btn btn-ghost">
                + فاتورة
              </button>
            }
          >
            {c.invoices.length === 0 ? (
              <EmptyLine text="لا توجد فواتير مرتبطة بهذه القضية." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>رقم الفاتورة</th>
                      <th>الحالة</th>
                      <th>الإجمالي</th>
                      <th>الاستحقاق</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {c.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="font-mono font-bold">{invoice.invoiceNumber}</td>

                        <td>
                          <span
                            className={
                              INVOICE_STATUS_BADGE[invoice.status] || 'badge badge-gray'
                            }
                          >
                            {INVOICE_STATUS_AR[invoice.status] || invoice.status}
                          </span>
                        </td>

                        <td className="font-bold">{formatCurrency(invoice.total)}</td>

                        <td>{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</td>

                        <td>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/invoices/${invoice.id}`}
                              className="text-xs font-bold hover:underline"
                              style={{ color: 'var(--sidebar)' }}
                            >
                              فتح
                            </Link>

                            <button
                              type="button"
                              onClick={() => deleteInvoice(invoice)}
                              disabled={!!invoice.payment}
                              title={
                                invoice.payment
                                  ? 'لا يمكن حذف فاتورة مرتبطة بدفعة'
                                  : 'حذف الفاتورة'
                              }
                              className="rounded-xl px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="المدفوعات"
            count={c.payments.length}
            action={
              <button onClick={() => setPaymentOpen(true)} className="btn btn-ghost">
                + دفعة
              </button>
            }
          >
            {c.payments.length === 0 ? (
              <EmptyLine text="لا توجد دفعات مرتبطة بهذه القضية." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>المبلغ</th>
                      <th>الطريقة</th>
                      <th>الحالة</th>
                      <th>الفاتورة</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {c.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="text-sm">{formatDate(payment.paidAt)}</td>

                        <td className="font-bold">
                          {formatCurrency(payment.amount)}
                        </td>

                        <td style={{ color: 'var(--text-2)' }}>
                          {METHOD_AR[payment.method] || payment.method}
                        </td>

                        <td>
                          <span className={PMT_STATUS[payment.status] || 'badge badge-gray'}>
                            {PMT_AR[payment.status] || payment.status}
                          </span>
                        </td>

                        <td>
                          {payment.invoice ? (
                            <Link
                              href={`/dashboard/invoices/${payment.invoice.id}`}
                              className="text-xs font-bold hover:underline"
                              style={{ color: 'var(--sidebar)' }}
                            >
                              {payment.invoice.invoiceNumber}
                            </Link>
                          ) : (
                            '-'
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              if (payment.invoice) {
                                toast.error(
                                  'لا يمكن حذف دفعة مرتبطة بفاتورة. افتح الفاتورة وغيّر حالتها أولًا.'
                                )
                                return
                              }

                              setDeleteId(payment.id)
                            }}
                            title={
                              payment.invoice ? 'دفعة مرتبطة بفاتورة' : 'حذف الدفعة'
                            }
                            className={`text-sm transition-colors ${
                              payment.invoice
                                ? 'cursor-not-allowed text-gray-300'
                                : 'text-red-400 hover:text-red-600'
                            }`}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="المستندات"
            count={c.documents.length}
            action={
              <button onClick={() => setDocumentOpen(true)} className="btn btn-ghost">
                + مستند
              </button>
            }
          >
            {c.documents.length === 0 ? (
              <EmptyLine text="لا توجد مستندات مرتبطة بهذه القضية." />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {c.documents.slice(0, 8).map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl border p-4 transition-all hover:-translate-y-0.5"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--card)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-2xl">{documentIcon(doc.fileType)}</span>

                      <div className="min-w-0 text-right">
                        <p
                          className="truncate font-black"
                          style={{ color: 'var(--text)' }}
                        >
                          {doc.fileName}
                        </p>

                        <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                          {formatDate(doc.createdAt)}
                          {doc.fileSize ? ` · ${fileSizeLabel(doc.fileSize)}` : ''}
                        </p>
                      </div>
                    </div>

                    {!!doc.tags?.length && (
                      <div className="mt-3 flex flex-wrap justify-end gap-1">
                        {doc.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="badge badge-gray">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex justify-end gap-2">
                      <a
                        href={`/api/documents/${doc.id}/preview`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost text-xs"
                      >
                        معاينة
                      </a>

                      <button
                        type="button"
                        onClick={() => deleteDocument(doc)}
                        className="btn text-xs"
                        style={{
                          background: 'var(--red-soft)',
                          color: '#dc2626',
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        open={paymentOpen}
        onClose={() => {
          setPaymentOpen(false)
          setPaymentForm(PMT_INIT)
        }}
        title="إضافة دفعة"
      >
        <form onSubmit={addPayment} className="space-y-3">
          <FormField label="المبلغ" required>
            <input
              type="number"
              className="input"
              value={paymentForm.amount}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  amount: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="طريقة الدفع">
              <select
                className="input"
                value={paymentForm.method}
                onChange={(event) =>
                  setPaymentForm((previous) => ({
                    ...previous,
                    method: event.target.value,
                  }))
                }
              >
                <option value="CASH">نقدًا</option>
                <option value="BANK_TRANSFER">تحويل بنكي</option>
                <option value="CHECK">شيك</option>
                <option value="ONLINE">إلكتروني</option>
              </select>
            </FormField>

            <FormField label="الحالة">
              <select
                className="input"
                value={paymentForm.status}
                onChange={(event) =>
                  setPaymentForm((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))
                }
              >
                <option value="PAID">مدفوع</option>
                <option value="PENDING">معلق</option>
                <option value="OVERDUE">متأخر</option>
                <option value="CANCELLED">ملغي</option>
              </select>
            </FormField>
          </div>

          <FormField label="تاريخ الدفع">
            <input
              type="datetime-local"
              className="input"
              value={paymentForm.paidAt}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  paidAt: event.target.value,
                }))
              }
            />
          </FormField>

          <FormField label="ملاحظات">
            <textarea
              className="input"
              rows={3}
              value={paymentForm.notes}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPaymentOpen(false)}
              className="btn btn-ghost flex-1"
            >
              إلغاء
            </button>

            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'جاري الحفظ...' : 'حفظ الدفعة'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Appointment Modal */}
      <Modal
        open={appointmentOpen}
        onClose={() => {
          setAppointmentOpen(false)
          setAppointmentForm(APPOINTMENT_INIT)
        }}
        title="إضافة موعد"
      >
        <form onSubmit={addAppointment} className="space-y-3">
          <FormField label="عنوان الموعد" required>
            <input
              className="input"
              value={appointmentForm.title}
              onChange={(event) =>
                setAppointmentForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="النوع">
              <select
                className="input"
                value={appointmentForm.type}
                onChange={(event) =>
                  setAppointmentForm((previous) => ({
                    ...previous,
                    type: event.target.value,
                  }))
                }
              >
                <option value="COURT_SESSION">جلسة محكمة</option>
                <option value="MEETING">اجتماع</option>
                <option value="PHONE_CALL">مكالمة</option>
                <option value="DEADLINE">موعد نهائي</option>
                <option value="OTHER">أخرى</option>
              </select>
            </FormField>

            <FormField label="المكان">
              <input
                className="input"
                value={appointmentForm.location}
                onChange={(event) =>
                  setAppointmentForm((previous) => ({
                    ...previous,
                    location: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="وقت البداية" required>
              <input
                type="datetime-local"
                className="input"
                value={appointmentForm.startTime}
                onChange={(event) =>
                  setAppointmentForm((previous) => ({
                    ...previous,
                    startTime: event.target.value,
                  }))
                }
              />
            </FormField>

            <FormField label="وقت الانتهاء">
              <input
                type="datetime-local"
                className="input"
                value={appointmentForm.endTime}
                onChange={(event) =>
                  setAppointmentForm((previous) => ({
                    ...previous,
                    endTime: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <FormField label="الوصف">
            <textarea
              className="input"
              rows={3}
              value={appointmentForm.description}
              onChange={(event) =>
                setAppointmentForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAppointmentOpen(false)}
              className="btn btn-ghost flex-1"
            >
              إلغاء
            </button>

            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'جاري الحفظ...' : 'حفظ الموعد'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Task Modal */}
      <Modal
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false)
          setTaskForm(TASK_INIT)
        }}
        title="إضافة مهمة"
      >
        <form onSubmit={addTask} className="space-y-3">
          <FormField label="عنوان المهمة" required>
            <input
              className="input"
              value={taskForm.title}
              onChange={(event) =>
                setTaskForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="الأولوية">
              <select
                className="input"
                value={taskForm.priority}
                onChange={(event) =>
                  setTaskForm((previous) => ({
                    ...previous,
                    priority: event.target.value,
                  }))
                }
              >
                <option value="URGENT">عاجلة</option>
                <option value="HIGH">عالية</option>
                <option value="MEDIUM">متوسطة</option>
                <option value="LOW">منخفضة</option>
              </select>
            </FormField>

            <FormField label="تاريخ الاستحقاق">
              <input
                type="date"
                className="input"
                value={taskForm.dueDate}
                onChange={(event) =>
                  setTaskForm((previous) => ({
                    ...previous,
                    dueDate: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <FormField label="الوصف">
            <textarea
              className="input"
              rows={3}
              value={taskForm.description}
              onChange={(event) =>
                setTaskForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTaskOpen(false)}
              className="btn btn-ghost flex-1"
            >
              إلغاء
            </button>

            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'جاري الحفظ...' : 'حفظ المهمة'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice Modal */}
      <Modal
        open={invoiceOpen}
        onClose={() => {
          setInvoiceOpen(false)
          setInvoiceForm(INVOICE_INIT)
        }}
        title="إنشاء فاتورة"
      >
        <form onSubmit={createInvoice} className="space-y-3">
          <FormField label="وصف البند" required>
            <input
              className="input"
              value={invoiceForm.description}
              onChange={(event) =>
                setInvoiceForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="المبلغ" required>
              <input
                type="number"
                className="input"
                value={invoiceForm.amount}
                onChange={(event) =>
                  setInvoiceForm((previous) => ({
                    ...previous,
                    amount: event.target.value,
                  }))
                }
              />
            </FormField>

            <FormField label="الضريبة">
              <input
                type="number"
                className="input"
                value={invoiceForm.tax}
                onChange={(event) =>
                  setInvoiceForm((previous) => ({
                    ...previous,
                    tax: event.target.value,
                  }))
                }
              />
            </FormField>

            <FormField label="الخصم">
              <input
                type="number"
                className="input"
                value={invoiceForm.discount}
                onChange={(event) =>
                  setInvoiceForm((previous) => ({
                    ...previous,
                    discount: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <FormField label="تاريخ الاستحقاق">
            <input
              type="date"
              className="input"
              value={invoiceForm.dueDate}
              onChange={(event) =>
                setInvoiceForm((previous) => ({
                  ...previous,
                  dueDate: event.target.value,
                }))
              }
            />
          </FormField>

          <FormField label="ملاحظات">
            <textarea
              className="input"
              rows={3}
              value={invoiceForm.notes}
              onChange={(event) =>
                setInvoiceForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
            />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setInvoiceOpen(false)}
              className="btn btn-ghost flex-1"
            >
              إلغاء
            </button>

            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'جاري الإنشاء...' : 'إنشاء الفاتورة'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Document Modal */}
      <Modal
        open={documentOpen}
        onClose={() => {
          setDocumentOpen(false)
          setDocumentForm(DOCUMENT_INIT)
          if (documentInputRef.current) documentInputRef.current.value = ''
        }}
        title="رفع مستند للقضية"
      >
        <div className="space-y-3">
          <FormField label="تصنيف المستند">
            <select
              className="input"
              value={documentForm.tag}
              onChange={(event) =>
                setDocumentForm((previous) => ({
                  ...previous,
                  tag: event.target.value,
                }))
              }
            >
              {DOCUMENT_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="ملاحظات">
            <textarea
              className="input"
              rows={3}
              value={documentForm.notes}
              onChange={(event) =>
                setDocumentForm((previous) => ({
                  ...previous,
                  notes: event.target.value,
                }))
              }
            />
          </FormField>

          <input
            ref={documentInputRef}
            type="file"
            className="input"
            onChange={(event) => uploadCaseDocument(event.target.files?.[0])}
          />

          <div
            className="rounded-2xl border p-3 text-xs leading-6"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-3)',
              background: 'var(--green-soft)',
            }}
          >
            سيتم ربط المستند تلقائيًا بهذه القضية وبالموكل المرتبط بها. الحد الأقصى
            لحجم الملف 10MB.
          </div>

          {uploadingDocument && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
              <span className="spinner spinner-sm" />
              جاري رفع المستند...
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Payment Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => {
          if (!deleteLoading) setDeleteId(null)
        }}
        title="حذف الدفعة"
      >
        <div className="space-y-4">
          <p className="text-sm leading-7" style={{ color: 'var(--text-2)' }}>
            هل أنت متأكد من حذف هذه الدفعة؟ لا يمكن التراجع عن هذه العملية.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={deleteLoading}
              onClick={() => setDeleteId(null)}
              className="btn btn-ghost flex-1"
            >
              إلغاء
            </button>

            <button
              type="button"
              disabled={deleteLoading}
              onClick={confirmDeletePayment}
              className="btn flex-1"
              style={{ background: '#dc2626', color: '#fff' }}
            >
              {deleteLoading ? 'جاري الحذف...' : 'حذف'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function MiniMetric({
  label,
  value,
  danger,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      <p className="text-xs font-black" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>

      <p
        className="mt-1 text-sm font-black"
        style={{ color: danger ? '#dc2626' : 'var(--text)' }}
      >
        {value}
      </p>
    </div>
  )
}

function SectionCard({
  title,
  count,
  action,
  children,
}: {
  title: string
  count: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="card overflow-hidden p-0">
      <div
        className="flex items-center justify-between gap-4 border-b px-5 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h2 className="font-black" style={{ color: 'var(--text)' }}>
            {title}
          </h2>

          <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
            {count} عنصر
          </p>
        </div>

        {action}
      </div>

      <div className="p-5">{children}</div>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div
      className="rounded-2xl border border-dashed p-6 text-center text-sm font-bold"
      style={{
        borderColor: 'var(--border)',
        color: 'var(--text-3)',
      }}
    >
      {text}
    </div>
  )
}

function Timeline({ activities }: { activities: Activity[] }) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h2 className="font-black" style={{ color: 'var(--text)' }}>
          آخر النشاطات
        </h2>

        <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
          أحدث العمليات على هذه القضية
        </p>
      </div>

      {activities.length === 0 ? (
        <EmptyLine text="لا توجد نشاطات مسجلة." />
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 8).map((activity) => (
            <div
              key={activity.id}
              className="rounded-2xl border p-3"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--card)',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: 'var(--green-soft)' }}
                >
                  {ACTIVITY_ICON[activity.type] || '✨'}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-bold" style={{ color: 'var(--text)' }}>
                    {activity.title}
                  </p>

                  {activity.message && (
                    <p className="mt-1 text-xs leading-6" style={{ color: 'var(--text-3)' }}>
                      {activity.message}
                    </p>
                  )}

                  <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
                    {formatDate(activity.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}