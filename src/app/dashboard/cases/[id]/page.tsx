'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'جارية',
  CLOSED: 'مغلقة',
  ARCHIVED: 'مؤرشفة',
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'badge badge-green',
  IN_PROGRESS: 'badge badge-blue',
  CLOSED: 'badge badge-gray',
  ARCHIVED: 'badge badge-gray',
}

const METHOD_AR: Record<string, string> = {
  CASH: 'نقداً',
  BANK_TRANSFER: 'تحويل',
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
  LOW: 'منخفضة',
  MEDIUM: 'متوسطة',
  HIGH: 'عالية',
}

const TASK_PRIORITY_BADGE: Record<string, string> = {
  LOW: 'badge badge-gray',
  MEDIUM: 'badge badge-blue',
  HIGH: 'badge badge-red',
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

const STATUSES = [
  ['OPEN', 'مفتوحة'],
  ['IN_PROGRESS', 'جارية'],
  ['CLOSED', 'مغلقة'],
  ['ARCHIVED', 'مؤرشفة'],
]

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

const DOCUMENT_TAGS = ['عقد', 'قضية', 'هوية', 'حكم', 'إثبات', 'لائحة', 'مالية']

const DOCUMENT_INIT = {
  tag: 'قضية',
  notes: '',
}

function getApiMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback
}

function safeNumber(value: string) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
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
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const documentInputRef = useRef<HTMLInputElement | null>(null)

  const [paymentForm, setPaymentForm] = useState(PMT_INIT)
  const [appointmentForm, setAppointmentForm] = useState(APPOINTMENT_INIT)
  const [taskForm, setTaskForm] = useState(TASK_INIT)
  const [invoiceForm, setInvoiceForm] = useState(INVOICE_INIT)
  const [documentForm, setDocumentForm] = useState(DOCUMENT_INIT)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = useCallback(async () => {
    if (!id || id === 'undefined') {
      setLoading(false)
      toast.error('رقم القضية غير موجود')
      return
    }

    try {
      const r = await fetch(`/api/cases/${id}`)
      const d = await r.json().catch(() => ({}))

      if (r.ok && d.success) {
        setC(d.data)
      } else {
        toast.error(getApiMessage(d, 'القضية غير موجودة'))
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
    const totalPaid = c?.payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0) ?? 0

    const invoicesTotal = c?.invoices
      .filter((invoice) => invoice.status !== 'CANCELLED')
      .reduce((sum, invoice) => sum + invoice.total, 0) ?? 0

    const unpaidInvoicesTotal = c?.invoices
      .filter((invoice) => invoice.status !== 'PAID' && invoice.status !== 'CANCELLED')
      .reduce((sum, invoice) => sum + invoice.total, 0) ?? 0

    const remaining = Math.max(0, (c?.feeAgreed ?? 0) - totalPaid)
    const pct = (c?.feeAgreed ?? 0) > 0
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
      .filter((a) => a.status !== 'CANCELLED' && new Date(a.startTime).getTime() >= now)
      .slice(0, 5)
  }, [c])

  const overdueTasks = useMemo(() => {
    const now = Date.now()
    return (c?.tasks ?? []).filter(
      (t) => !t.completed && t.dueDate && new Date(t.dueDate).getTime() < now
    ).length
  }, [c])

  async function updateStatus(status: string) {
    if (!id || id === 'undefined') return toast.error('رقم القضية غير موجود')
    if (c?.status === status) return

    const r = await fetch(`/api/cases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })

    const d = await r.json().catch(() => ({}))

    if (r.ok && d.success) {
      toast.success('تم تحديث حالة القضية')
      load()
    } else {
      toast.error(getApiMessage(d, 'تعذر تحديث الحالة'))
    }
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentForm.amount) return toast.error('المبلغ مطلوب')

    try {
      setSaving(true)
      const r = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentForm,
          caseId: id,
          amount: safeNumber(paymentForm.amount),
          paidAt: paymentForm.paidAt || new Date().toISOString(),
        }),
      })

      const d = await r.json().catch(() => ({}))

      if (r.ok && d.success) {
        toast.success('تمت إضافة الدفعة')
        setPaymentOpen(false)
        setPaymentForm(PMT_INIT)
        load()
      } else {
        toast.error(getApiMessage(d, 'تعذر إضافة الدفعة'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function addAppointment(e: React.FormEvent) {
    e.preventDefault()
    if (!appointmentForm.title.trim()) return toast.error('عنوان الموعد مطلوب')
    if (!appointmentForm.startTime) return toast.error('وقت بداية الموعد مطلوب')

    try {
      setSaving(true)
      const r = await fetch('/api/appointments', {
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

      const d = await r.json().catch(() => ({}))

      if (r.ok && d.success) {
        toast.success('تمت إضافة الموعد')
        setAppointmentOpen(false)
        setAppointmentForm(APPOINTMENT_INIT)
        load()
      } else {
        toast.error(getApiMessage(d, 'تعذر إضافة الموعد'))
      }
    } finally {
      setSaving(false)
    }
  }


  async function deleteAppointment(appointment: Appointment) {
    if (!confirm(`هل تريد حذف الموعد: ${appointment.title}؟`)) return

    const r = await fetch(`/api/appointments/${appointment.id}`, {
      method: 'DELETE',
    })

    const d = await r.json().catch(() => ({}))

    if (r.ok && d.success) {
      toast.success('تم حذف الموعد')
      load()
    } else {
      toast.error(getApiMessage(d, 'تعذر حذف الموعد'))
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskForm.title.trim()) return toast.error('عنوان المهمة مطلوب')

    try {
      setSaving(true)
      const r = await fetch('/api/tasks', {
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

      const d = await r.json().catch(() => ({}))

      if (r.ok && d.success) {
        toast.success('تمت إضافة المهمة')
        setTaskOpen(false)
        setTaskForm(TASK_INIT)
        load()
      } else {
        toast.error(getApiMessage(d, 'تعذر إضافة المهمة'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!invoiceForm.description.trim()) return toast.error('وصف البند مطلوب')
    if (!invoiceForm.amount) return toast.error('المبلغ مطلوب')

    try {
      setSaving(true)
      const r = await fetch('/api/invoices', {
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

      const d = await r.json().catch(() => ({}))

      if (r.ok && d.success) {
        toast.success('تم إنشاء الفاتورة')
        setInvoiceOpen(false)
        setInvoiceForm(INVOICE_INIT)
        load()
        if (d.data?.id) router.push(`/dashboard/invoices/${d.data.id}`)
      } else {
        toast.error(getApiMessage(d, 'تعذر إنشاء الفاتورة'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function uploadCaseDocument(file?: File | null) {
    if (!file) return toast.error('اختر ملفًا أولًا')
    if (!c) return toast.error('بيانات القضية غير جاهزة')

    if (file.size > 10 * 1024 * 1024) {
      return toast.error('حجم الملف يتجاوز 10 ميجابايت')
    }

    try {
      setUploadingDocument(true)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('caseId', id)
      fd.append('clientId', c.client.id)
      fd.append('tags', JSON.stringify(documentForm.tag ? [documentForm.tag] : ['قضية']))
      if (documentForm.notes.trim()) fd.append('notes', documentForm.notes.trim())

      const r = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      })

      const d = await r.json().catch(() => ({}))

      if (r.ok && d.success) {
        toast.success('تم رفع المستند وربطه بالقضية')
        setDocumentOpen(false)
        setDocumentForm(DOCUMENT_INIT)
        if (documentInputRef.current) documentInputRef.current.value = ''
        load()
      } else {
        toast.error(getApiMessage(d, 'تعذر رفع المستند'))
      }
    } catch {
      toast.error('حدث خطأ أثناء رفع المستند')
    } finally {
      setUploadingDocument(false)
    }
  }

  async function deleteDocument(doc: DocumentItem) {
    if (!confirm(`هل تريد حذف المستند: ${doc.fileName}؟`)) return

    const r = await fetch(`/api/documents/${doc.id}`, {
      method: 'DELETE',
    })

    const d = await r.json().catch(() => ({}))

    if (r.ok && d.success) {
      toast.success('تم حذف المستند')
      load()
    } else {
      toast.error(getApiMessage(d, 'تعذر حذف المستند'))
    }
  }

  async function toggleTask(task: TaskItem) {
    const r = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !task.completed }),
    })

    const d = await r.json().catch(() => ({}))

    if (r.ok && d.success) {
      toast.success(task.completed ? 'تمت إعادة فتح المهمة' : 'تم إكمال المهمة')
      load()
    } else {
      toast.error(getApiMessage(d, 'تعذر تحديث المهمة'))
    }
  }

  async function deleteTask(task: TaskItem) {
    if (!confirm(`هل تريد حذف المهمة: ${task.title}؟`)) return

    const r = await fetch(`/api/tasks/${task.id}`, {
      method: 'DELETE',
    })

    const d = await r.json().catch(() => ({}))

    if (r.ok && d.success) {
      toast.success('تم حذف المهمة')
      load()
    } else {
      toast.error(getApiMessage(d, 'تعذر حذف المهمة'))
    }
  }

  async function confirmDeletePayment() {
    if (!deleteId) return

    try {
      setDeleteLoading(true)
      const r = await fetch(`/api/payments/${deleteId}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))

      if (!r.ok) {
        toast.error(getApiMessage(d, 'فشل حذف الدفعة'))
        return
      }

      toast.success('تم حذف الدفعة')
      setDeleteId(null)
      load()
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setDeleteLoading(false)
    }
  }


  async function deleteInvoice(invoice: Invoice) {
    if (invoice.payment) {
      toast.error('لا يمكن حذف فاتورة مرتبطة بدفعة. افتح الفاتورة وغيّر حالتها أولًا.')
      return
    }

    if (!confirm(`هل تريد حذف الفاتورة ${invoice.invoiceNumber}؟`)) return

    const r = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'DELETE',
    })

    const d = await r.json().catch(() => ({}))

    if (r.ok && d.success) {
      toast.success('تم حذف الفاتورة')
      load()
    } else {
      toast.error(getApiMessage(d, 'تعذر حذف الفاتورة'))
    }
  }

  if (loading) return <PageLoader />

  if (!c) {
    return (
      <div className="py-16 text-center">
        <button onClick={() => router.back()} className="btn btn-ghost">
          رجوع
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 stagger">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => router.back()}
          className="btn btn-ghost"
          style={{ fontSize: '.8rem', padding: '.3rem .8rem' }}
        >
          ← رجوع
        </button>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPaymentOpen(true)} className="btn btn-primary text-xs">
            + دفعة
          </button>
          <button onClick={() => setInvoiceOpen(true)} className="btn btn-ghost text-xs">
            + فاتورة
          </button>
          <button onClick={() => setAppointmentOpen(true)} className="btn btn-ghost text-xs">
            + موعد
          </button>
          <button onClick={() => setTaskOpen(true)} className="btn btn-ghost text-xs">
            + مهمة
          </button>
          <button onClick={() => setDocumentOpen(true)} className="btn btn-ghost text-xs">
            رفع مستند
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div
          className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={STATUS_BADGE[c.status] || 'badge badge-gray'}>
              {STATUS_AR[c.status] || c.status}
            </span>
            {c.caseNumber && (
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--input-bg)', color: 'var(--text-2)' }}>
                رقم القضية: {c.caseNumber}
              </span>
            )}
          </div>

          <div className="text-right">
            <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
              {c.title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
              {c.court || 'بدون محكمة محددة'} · أُضيفت {formatDate(c.createdAt)}
            </p>
            {c.description && (
              <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: 'var(--text-2)' }}>
                {c.description}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-6">
          <Metric label="الأتعاب" value={formatCurrency(c.feeAgreed || 0)} />
          <Metric label="المحصّل" value={formatCurrency(totals.totalPaid)} strong />
          <Metric label="المتبقي" value={formatCurrency(totals.remaining)} danger={totals.remaining > 0} />
          <Metric label="الفواتير" value={formatCurrency(totals.invoicesTotal)} />
          <Metric label="غير مدفوع" value={formatCurrency(totals.unpaidInvoicesTotal)} danger={totals.unpaidInvoicesTotal > 0} />
          <Metric label="مهام متأخرة" value={String(overdueTasks)} danger={overdueTasks > 0} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-4">
          <div className="card p-4">
            <p className="mb-3 text-xs font-bold" style={{ color: 'var(--text-3)' }}>
              الموكل
            </p>
            <Link href={`/dashboard/clients/${c.client.id}`} className="block rounded-2xl p-3 transition-all hover:scale-[1.01]" style={{ background: 'var(--input-bg)' }}>
              <p className="font-black" style={{ color: 'var(--text)' }}>{c.client.name}</p>
              {c.client.phone && <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>{c.client.phone}</p>}
              {c.client.email && <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>{c.client.email}</p>}
              {c.client.address && <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>{c.client.address}</p>}
            </Link>
          </div>

          <div className="card p-4">
            <div className="mb-2 flex justify-between text-xs font-bold">
              <span style={{ color: 'var(--text-3)' }}>{Math.round(totals.pct)}% محصّل</span>
              <span style={{ color: 'var(--text-2)' }}>نسبة التحصيل</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--input-bg)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${totals.pct}%`,
                  background: totals.pct >= 100 ? 'var(--sidebar)' : totals.pct > 50 ? '#f59e0b' : '#dc2626',
                }}
              />
            </div>
          </div>

          <div className="card p-4">
            <p className="mb-2 text-xs font-bold" style={{ color: 'var(--text-3)' }}>
              تغيير حالة القضية
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-all ${c.status === s ? 'text-white' : ''}`}
                  style={
                    c.status === s
                      ? { background: 'var(--sidebar)' }
                      : { background: 'var(--input-bg)', color: 'var(--text-2)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Timeline activities={c.activities} />
        </div>

        <div className="space-y-5 xl:col-span-8">
          <SectionCard
            title="المواعيد والجلسات"
            count={c.appointments.length}
            action={<button onClick={() => setAppointmentOpen(true)} className="btn btn-ghost text-xs">+ موعد</button>}
          >
            {c.appointments.length === 0 ? (
              <EmptyLine text="لا توجد مواعيد مرتبطة بهذه القضية" />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {(upcomingAppointments.length ? upcomingAppointments : c.appointments.slice(0, 6)).map((a) => (
                  <div key={a.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--input-bg)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="badge badge-blue">{APPT_TYPE_AR[a.type] || a.type}</span>
                      <div className="text-right">
                        <p className="font-bold" style={{ color: 'var(--text)' }}>{a.title}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                          {formatDate(a.startTime)} · {formatTime(a.startTime)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                      <span>{APPT_STATUS_AR[a.status] || a.status}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => deleteAppointment(a)}
                          className="rounded-xl px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                        >
                          حذف
                        </button>
                        <span>{a.location || 'بدون موقع'}</span>
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
            action={<button onClick={() => setTaskOpen(true)} className="btn btn-ghost text-xs">+ مهمة</button>}
          >
            {c.tasks.length === 0 ? (
              <EmptyLine text="لا توجد مهام مرتبطة بهذه القضية" />
            ) : (
              <div className="space-y-2">
                {c.tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${task.completed ? 'opacity-60' : ''}`} style={{ borderColor: 'var(--border)' }}>
                    <button
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
                      <p className="font-bold" style={{ color: 'var(--text)' }}>{task.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {task.dueDate ? `تاريخ الاستحقاق: ${formatDate(task.dueDate)}` : 'بدون تاريخ'}
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
            action={<button onClick={() => setInvoiceOpen(true)} className="btn btn-ghost text-xs">+ فاتورة</button>}
          >
            {c.invoices.length === 0 ? (
              <EmptyLine text="لا توجد فواتير مرتبطة بهذه القضية" />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>رقم الفاتورة</th><th>الحالة</th><th>الإجمالي</th><th>الاستحقاق</th><th></th></tr>
                  </thead>
                  <tbody>
                    {c.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="font-mono font-bold">{invoice.invoiceNumber}</td>
                        <td><span className={INVOICE_STATUS_BADGE[invoice.status] || 'badge badge-gray'}>{INVOICE_STATUS_AR[invoice.status] || invoice.status}</span></td>
                        <td className="font-bold">{formatCurrency(invoice.total)}</td>
                        <td>{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link href={`/dashboard/invoices/${invoice.id}`} className="text-xs font-bold hover:underline">
                              فتح
                            </Link>
                            <button
                              type="button"
                              onClick={() => deleteInvoice(invoice)}
                              disabled={!!invoice.payment}
                              title={invoice.payment ? 'لا يمكن حذف فاتورة مرتبطة بدفعة' : 'حذف الفاتورة'}
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
            action={<button onClick={() => setPaymentOpen(true)} className="btn btn-ghost text-xs">+ دفعة</button>}
          >
            {c.payments.length === 0 ? (
              <EmptyLine text="لا توجد دفعات مرتبطة بهذه القضية" />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>الفاتورة</th><th></th></tr></thead>
                  <tbody>
                    {c.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="text-sm">{formatDate(p.paidAt)}</td>
                        <td className="font-bold">{formatCurrency(p.amount)}</td>
                        <td style={{ color: 'var(--text-2)' }}>{METHOD_AR[p.method] || p.method}</td>
                        <td><span className={PMT_STATUS[p.status] || 'badge badge-gray'}>{PMT_AR[p.status] || p.status}</span></td>
                        <td>{p.invoice ? <Link href={`/dashboard/invoices/${p.invoice.id}`} className="text-xs font-bold hover:underline">{p.invoice.invoiceNumber}</Link> : '-'}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              if (p.invoice) {
                                toast.error('لا يمكن حذف دفعة مرتبطة بفاتورة. افتح الفاتورة وغيّر حالتها أولًا.')
                                return
                              }

                              setDeleteId(p.id)
                            }}
                            title={p.invoice ? 'دفعة مرتبطة بفاتورة' : 'حذف الدفعة'}
                            className={`text-sm transition-colors ${p.invoice ? 'cursor-not-allowed text-gray-300' : 'text-red-400 hover:text-red-600'}`}
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
            action={<button onClick={() => setDocumentOpen(true)} className="btn btn-ghost text-xs">+ مستند</button>}
          >
            {c.documents.length === 0 ? (
              <EmptyLine text="لا توجد مستندات مرتبطة بهذه القضية" />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {c.documents.slice(0, 8).map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl border p-3 transition-all hover:scale-[1.01]"
                    style={{ borderColor: 'var(--border)', background: 'var(--input-bg)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-lg">📄</span>
                      <div className="min-w-0 text-right">
                        <p className="truncate font-bold" style={{ color: 'var(--text)' }}>{doc.fileName}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                          {formatDate(doc.createdAt)} {doc.fileSize ? `· ${fileSizeLabel(doc.fileSize)}` : ''}
                        </p>
                      </div>
                    </div>

                    {doc.tags && doc.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap justify-end gap-1">
                        {doc.tags.slice(0, 3).map((tag) => <span key={tag} className="badge badge-gray">{tag}</span>)}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-end gap-2">
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl px-3 py-1.5 text-xs font-bold hover:bg-black/5"
                        >
                          فتح
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc)}
                        className="rounded-xl px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
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

      <Modal open={documentOpen} onClose={() => { setDocumentOpen(false); setDocumentForm(DOCUMENT_INIT); if (documentInputRef.current) documentInputRef.current.value = '' }} title="رفع مستند للقضية" size="md">
        <div className="space-y-3">
          <div className="rounded-2xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--input-bg)', color: 'var(--text-2)' }}>
            سيتم ربط المستند تلقائيًا بهذه القضية وبالموكل: <strong style={{ color: 'var(--text)' }}>{c.client.name}</strong>
          </div>

          <FormField label="الملف" required>
            <input
              ref={documentInputRef}
              type="file"
              className="input"
              accept="application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
          </FormField>

          <FormField label="تصنيف المستند">
            <select value={documentForm.tag} onChange={(e) => setDocumentForm((p) => ({ ...p, tag: e.target.value }))} className="input">
              {DOCUMENT_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </FormField>

          <FormField label="ملاحظات">
            <textarea value={documentForm.notes} onChange={(e) => setDocumentForm((p) => ({ ...p, notes: e.target.value }))} className="input min-h-24" />
          </FormField>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setDocumentOpen(false)} className="btn btn-ghost flex-1">إلغاء</button>
            <button
              type="button"
              disabled={uploadingDocument}
              onClick={() => uploadCaseDocument(documentInputRef.current?.files?.[0])}
              className="btn btn-primary flex-1"
            >
              {uploadingDocument ? <span className="spinner spinner-sm" /> : 'رفع المستند'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={paymentOpen} onClose={() => { setPaymentOpen(false); setPaymentForm(PMT_INIT) }} title="إضافة دفعة" size="sm">
        <form onSubmit={addPayment} className="space-y-3">
          <FormField label="المبلغ (د.أ)" required>
            <input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))} className="input" min="1" step="0.01" autoFocus />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="طريقة الدفع">
              <select value={paymentForm.method} onChange={(e) => setPaymentForm((p) => ({ ...p, method: e.target.value }))} className="input">
                {Object.entries(METHOD_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
            <FormField label="الحالة">
              <select value={paymentForm.status} onChange={(e) => setPaymentForm((p) => ({ ...p, status: e.target.value }))} className="input">
                {Object.entries(PMT_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="التاريخ"><input type="date" value={paymentForm.paidAt} onChange={(e) => setPaymentForm((p) => ({ ...p, paidAt: e.target.value }))} className="input" /></FormField>
          <FormField label="ملاحظات"><input value={paymentForm.notes} onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))} className="input" /></FormField>
          <ModalActions saving={saving} onCancel={() => setPaymentOpen(false)} />
        </form>
      </Modal>

      <Modal open={appointmentOpen} onClose={() => { setAppointmentOpen(false); setAppointmentForm(APPOINTMENT_INIT) }} title="إضافة موعد للقضية" size="md">
        <form onSubmit={addAppointment} className="space-y-3">
          <FormField label="عنوان الموعد" required><input value={appointmentForm.title} onChange={(e) => setAppointmentForm((p) => ({ ...p, title: e.target.value }))} className="input" autoFocus /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="النوع"><select value={appointmentForm.type} onChange={(e) => setAppointmentForm((p) => ({ ...p, type: e.target.value }))} className="input">{Object.entries(APPT_TYPE_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
            <FormField label="الموقع"><input value={appointmentForm.location} onChange={(e) => setAppointmentForm((p) => ({ ...p, location: e.target.value }))} className="input" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="البداية" required><input type="datetime-local" value={appointmentForm.startTime} onChange={(e) => setAppointmentForm((p) => ({ ...p, startTime: e.target.value }))} className="input" /></FormField>
            <FormField label="النهاية"><input type="datetime-local" value={appointmentForm.endTime} onChange={(e) => setAppointmentForm((p) => ({ ...p, endTime: e.target.value }))} className="input" /></FormField>
          </div>
          <FormField label="ملاحظات"><textarea value={appointmentForm.description} onChange={(e) => setAppointmentForm((p) => ({ ...p, description: e.target.value }))} className="input min-h-24" /></FormField>
          <ModalActions saving={saving} onCancel={() => setAppointmentOpen(false)} />
        </form>
      </Modal>

      <Modal open={taskOpen} onClose={() => { setTaskOpen(false); setTaskForm(TASK_INIT) }} title="إضافة مهمة للقضية" size="sm">
        <form onSubmit={addTask} className="space-y-3">
          <FormField label="عنوان المهمة" required><input value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} className="input" autoFocus /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="الأولوية"><select value={taskForm.priority} onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))} className="input">{Object.entries(TASK_PRIORITY_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormField>
            <FormField label="تاريخ الاستحقاق"><input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))} className="input" /></FormField>
          </div>
          <FormField label="وصف مختصر"><textarea value={taskForm.description} onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))} className="input min-h-24" /></FormField>
          <ModalActions saving={saving} onCancel={() => setTaskOpen(false)} />
        </form>
      </Modal>

      <Modal open={invoiceOpen} onClose={() => { setInvoiceOpen(false); setInvoiceForm(INVOICE_INIT) }} title="إنشاء فاتورة للقضية" size="md">
        <form onSubmit={createInvoice} className="space-y-3">
          <FormField label="وصف البند" required><input value={invoiceForm.description} onChange={(e) => setInvoiceForm((p) => ({ ...p, description: e.target.value }))} className="input" autoFocus /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="المبلغ" required><input type="number" min="0" step="0.01" value={invoiceForm.amount} onChange={(e) => setInvoiceForm((p) => ({ ...p, amount: e.target.value }))} className="input" /></FormField>
            <FormField label="تاريخ الاستحقاق"><input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((p) => ({ ...p, dueDate: e.target.value }))} className="input" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="الضريبة"><input type="number" min="0" step="0.01" value={invoiceForm.tax} onChange={(e) => setInvoiceForm((p) => ({ ...p, tax: e.target.value }))} className="input" /></FormField>
            <FormField label="الخصم"><input type="number" min="0" step="0.01" value={invoiceForm.discount} onChange={(e) => setInvoiceForm((p) => ({ ...p, discount: e.target.value }))} className="input" /></FormField>
          </div>
          <FormField label="ملاحظات"><textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm((p) => ({ ...p, notes: e.target.value }))} className="input min-h-24" /></FormField>
          <ModalActions saving={saving} onCancel={() => setInvoiceOpen(false)} />
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="تأكيد حذف الدفعة" size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            هل أنت متأكد من حذف هذه الدفعة؟ لا يمكن حذف الدفعات المرتبطة بفواتير من هنا.
          </p>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setDeleteId(null)} className="btn btn-ghost flex-1">إلغاء</button>
            <button type="button" onClick={confirmDeletePayment} disabled={deleteLoading} className="btn flex-1 bg-red-600 text-white hover:bg-red-700">
              {deleteLoading ? 'جاري الحذف...' : 'حذف'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Metric({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--input-bg)' }}>
      <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-base font-black" style={{ color: danger ? '#dc2626' : strong ? 'var(--sidebar)' : 'var(--text)' }}>{value}</p>
    </div>
  )
}

function SectionCard({ title, count, action, children }: { title: string; count: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        {action}
        <div className="flex items-center gap-2 text-right">
          <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'var(--input-bg)', color: 'var(--text-2)' }}>{count}</span>
          <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{title}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>{text}</p>
}

function Timeline({ activities }: { activities: Activity[] }) {
  return (
    <div className="card p-4">
      <p className="mb-3 text-sm font-bold" style={{ color: 'var(--text)' }}>سجل النشاط</p>
      {activities.length === 0 ? (
        <EmptyLine text="لا يوجد نشاط مسجل لهذه القضية" />
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 10).map((activity) => (
            <div key={activity.id} className="relative pr-5">
              <span className="absolute right-0 top-1.5 h-2.5 w-2.5 rounded-full" style={{ background: 'var(--sidebar)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{activity.title}</p>
              {activity.message && <p className="mt-0.5 text-xs" style={{ color: 'var(--text-2)' }}>{activity.message}</p>}
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>{formatDate(activity.createdAt)} · {formatTime(activity.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">إلغاء</button>
      <button type="submit" disabled={saving} className="btn btn-primary flex-1">
        {saving ? <span className="spinner spinner-sm" /> : 'حفظ'}
      </button>
    </div>
  )
}
