'use client'

import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import PageLoader from '@/components/ui/PageLoader'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  buildInvoiceWhatsAppMessage,
  formatInvoiceNumber,
  normalizeWhatsAppPhone,
  printInvoiceDocument,
  safeInvoiceFilename,
} from '@/lib/invoice-print'

type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'

type EditItem = {
  description: string
  quantity: number
  unitPrice: number
}

interface Invoice {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: string
  dueDate?: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  notes?: string | null
  client: {
    id: string
    name: string
    phone?: string | null
    email?: string | null
  }
  case?: {
    id: string
    title: string
    caseNumber?: string | null
  } | null
  items: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  payment?: {
    id: string
    amount: number
    status: string
    paidAt?: string | null
  } | null
  tenant?: {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    logoUrl?: string | null
  } | null
}

const statusLabels: Record<InvoiceStatus, string> = {
  DRAFT: 'مسودة',
  UNPAID: 'غير مدفوعة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  CANCELLED: 'ملغاة',
}

const statusClasses: Record<InvoiceStatus, string> = {
  DRAFT: 'badge badge-gray',
  UNPAID: 'badge badge-amber',
  PAID: 'badge badge-green',
  OVERDUE: 'badge badge-red',
  CANCELLED: 'badge badge-gray',
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function paymentStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    PAID: 'مدفوعة',
    PENDING: 'معلّقة',
    OVERDUE: 'متأخرة',
    CANCELLED: 'ملغاة',
  }

  return status ? map[status] ?? status : '-'
}

export default function InvoiceDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [editDueDate, setEditDueDate] = useState('')
  const [editTax, setEditTax] = useState(0)
  const [editDiscount, setEditDiscount] = useState(0)
  const [editNotes, setEditNotes] = useState('')
  const [editItems, setEditItems] = useState<EditItem[]>([])

  const invoiceRef = useRef<HTMLDivElement | null>(null)

  async function load() {
    if (!id || id === 'undefined' || id === 'null') {
      setInvoice(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const res = await fetch(`/api/invoices/${id}`, {
        cache: 'no-store',
      })

      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error('Invoice load failed:', {
          id,
          status: res.status,
          data,
        })

        setInvoice(null)
        return
      }

      setInvoice(data.data?.invoice ?? data.data ?? data.invoice ?? null)
    } catch (error) {
      console.error('Invoice load error:', error)
      setInvoice(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function openEditModal() {
    if (!invoice) return

    if (invoice.status === 'PAID') {
      alert('لا يمكن تعديل البيانات المالية لفاتورة مدفوعة. غيّر الحالة أولًا إذا احتجت تعديلها.')
      return
    }

    setEditDueDate(toDateInput(invoice.dueDate))
    setEditTax(invoice.tax || 0)
    setEditDiscount(invoice.discount || 0)
    setEditNotes(invoice.notes || '')
    setEditItems(
      invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    )
    setEditOpen(true)
  }

  function updateEditItem(index: number, key: keyof EditItem, value: string) {
    setEditItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]: key === 'description' ? value : Number(value || 0),
            }
          : item
      )
    )
  }

  function addEditItem() {
    setEditItems((prev) => [
      ...prev,
      {
        description: '',
        quantity: 1,
        unitPrice: 0,
      },
    ])
  }

  function removeEditItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index))
  }

  const editSubtotal = roundMoney(
    editItems.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0)
      const unitPrice = Number(item.unitPrice || 0)
      return sum + quantity * unitPrice
    }, 0)
  )

  const editTotal = roundMoney(
    editSubtotal + Number(editTax || 0) - Number(editDiscount || 0)
  )

  async function submitEdit(e: FormEvent) {
    e.preventDefault()
    if (!invoice) return

    const cleanItems = editItems
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
      }))
      .filter((item) => item.description)

    if (cleanItems.length === 0) {
      alert('أضف بند واحد على الأقل')
      return
    }

    if (cleanItems.some((item) => item.quantity <= 0 || item.unitPrice < 0)) {
      alert('تأكد أن الكمية أكبر من صفر وأن سعر الوحدة غير سالب')
      return
    }

    if (Number(editTax || 0) < 0 || Number(editDiscount || 0) < 0) {
      alert('الضريبة والخصم لا يمكن أن تكون قيمهم سالبة')
      return
    }

    if (editTotal < 0) {
      alert('الخصم لا يمكن أن يكون أكبر من المجموع والضريبة')
      return
    }

    try {
      setSaving(true)

      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: editDueDate || null,
          tax: Number(editTax || 0),
          discount: Number(editDiscount || 0),
          notes: editNotes,
          items: cleanItems,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        alert(data.message || data.error || 'تعذر تعديل الفاتورة')
        return
      }

      setEditOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(nextStatus: InvoiceStatus) {
    if (!invoice || invoice.status === nextStatus) return

    if (nextStatus === 'PAID' && !invoice.case) {
      alert('لا يمكن تعليم الفاتورة كمدفوعة لأنها غير مرتبطة بقضية. اربطها بقضية أولًا حتى يتم إنشاء دفعة صحيحة.')
      return
    }

    if (invoice.payment && invoice.status === 'PAID' && nextStatus !== 'PAID') {
      const ok = confirm(
        'هذه الفاتورة مدفوعة ومرتبطة بدفعة. تغيير الحالة سيحدّث حالة الدفعة المرتبطة حسب الحالة الجديدة. هل تريد المتابعة؟'
      )

      if (!ok) return
    }

    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      alert(data.message || data.error || 'تعذر تحديث حالة الفاتورة')
      return
    }

    await load()
  }

  async function deleteInvoice() {
    if (!invoice) return

    if (invoice.payment) {
      alert('لا يمكن حذف هذه الفاتورة لأنها مرتبطة بدفعة. عالج الدفعة المرتبطة أولًا ثم حاول مرة أخرى.')
      return
    }

    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return

    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'DELETE',
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      alert(data.message || data.error || 'تعذر حذف الفاتورة')
      return
    }

    router.push('/dashboard/invoices')
  }

  function sendInvoiceWhatsApp() {
    if (!invoice) return

    const phone = normalizeWhatsAppPhone(invoice.client?.phone)

    if (!phone) {
      alert('لا يوجد رقم هاتف محفوظ لهذا الموكل')
      return
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(buildInvoiceWhatsAppMessage(invoice))}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  async function downloadInvoicePDF() {
    if (!invoiceRef.current || !invoice) return

    try {
      setPdfLoading(true)

      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const usableWidth = pageWidth - margin * 2
      const imgWidth = usableWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = margin

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
      heightLeft -= pageHeight - margin * 2

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
        heightLeft -= pageHeight - margin * 2
      }

      pdf.save(`${safeInvoiceFilename(invoice.invoiceNumber)}.pdf`)
    } catch (error) {
      console.error(error)
      alert('تعذر إنشاء ملف PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  function printInvoice() {
    if (!invoice) return
    printInvoiceDocument(invoice)
  }

  if (!mounted || loading) {
    return <PageLoader />
  }

  if (!invoice) {
    return (
      <div className="space-y-5 stagger">
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 18px 50px rgba(45, 74, 62, 0.18)',
          }}
        >
          <h1 className="text-2xl font-black text-white">الفاتورة غير موجودة</h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
            تعذر العثور على الفاتورة المطلوبة، أو أنها حُذفت، أو أن الرابط غير صحيح.
          </p>
        </div>

        <div className="card p-8 text-center">
          <button
            onClick={() => router.push('/dashboard/invoices')}
            className="btn btn-primary"
          >
            رجوع للفواتير
          </button>
        </div>
      </div>
    )
  }

  const tenantName = invoice.tenant?.name || 'Viresto'
  const canEditFinancials = invoice.status !== 'PAID'

  return (
    <div className="space-y-5 stagger print:space-y-4 print:bg-white print:text-black">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6 print:hidden"
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
          <div>
            <button
              onClick={() => router.push('/dashboard/invoices')}
              className="mb-3 rounded-full px-3 py-1 text-xs font-black text-white/80 transition hover:bg-white/10"
            >
              ← رجوع للفواتير
            </button>

            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              تفاصيل الفاتورة
            </div>

            <h1 className="text-2xl font-black text-white">
              فاتورة {formatInvoiceNumber(invoice.invoiceNumber)}
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              عرض بيانات الفاتورة، البنود، الموكل، القضية، الدفعة المرتبطة، وإجراءات الطباعة والإرسال.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#fff',
                }}
              >
                الحالة: {statusLabels[invoice.status]}
              </span>

              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: 'rgba(245,200,66,0.18)',
                  color: '#fff',
                }}
              >
                الإجمالي: {formatCurrency(invoice.total)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={openEditModal}
              className="btn"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
                borderColor: 'rgba(255,255,255,0.32)',
              }}
            >
              تعديل
            </button>

            <button
              onClick={printInvoice}
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            >
              طباعة
            </button>

            <button
              onClick={downloadInvoicePDF}
              disabled={pdfLoading}
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            >
              {pdfLoading ? 'جاري إنشاء PDF...' : 'PDF'}
            </button>

            <button
              onClick={sendInvoiceWhatsApp}
              className="btn"
              style={{
                background: 'rgba(34,197,94,0.18)',
                color: '#fff',
                borderColor: 'rgba(34,197,94,0.32)',
              }}
            >
              واتساب
            </button>

            <button
              onClick={deleteInvoice}
              className="btn"
              style={{
                background: 'rgba(239,68,68,0.18)',
                color: '#fff',
                borderColor: 'rgba(239,68,68,0.32)',
              }}
            >
              حذف
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <InfoCard
          label="إجمالي الفاتورة"
          value={formatCurrency(invoice.total)}
          hint="المبلغ النهائي"
          tone="green"
        />

        <InfoCard
          label="المجموع الفرعي"
          value={formatCurrency(invoice.subtotal)}
          hint="قبل الضريبة والخصم"
        />

        <InfoCard
          label="الضريبة"
          value={formatCurrency(invoice.tax)}
          hint="قيمة الضريبة"
          tone="amber"
        />

        <InfoCard
          label="الخصم"
          value={formatCurrency(invoice.discount)}
          hint="إجمالي الخصم"
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 print:block">
        {/* Sidebar */}
        <div className="space-y-5 xl:col-span-4 print:hidden">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black" style={{ color: 'var(--text)' }}>
                  حالة الفاتورة
                </h2>

                <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                  غيّر حالة الفاتورة حسب التحصيل
                </p>
              </div>

              <span className={statusClasses[invoice.status]}>
                {statusLabels[invoice.status]}
              </span>
            </div>

            <select
              value={invoice.status}
              onChange={(e) => updateStatus(e.target.value as InvoiceStatus)}
              className="input"
              aria-label="تغيير حالة الفاتورة"
            >
              <option value="DRAFT">مسودة</option>
              <option value="UNPAID">غير مدفوعة</option>
              <option value="PAID">مدفوعة</option>
              <option value="OVERDUE">متأخرة</option>
              <option value="CANCELLED">ملغاة</option>
            </select>

            {invoice.payment && (
              <div
                className="mt-4 rounded-2xl border p-4 text-sm font-bold"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--green-soft)',
                  color: 'var(--sidebar)',
                }}
              >
                هذه الفاتورة مرتبطة بدفعة.
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-black" style={{ color: 'var(--text)' }}>
              بيانات الموكل
            </h2>

            <div className="mt-4 space-y-3">
              <MiniLine label="الاسم" value={invoice.client?.name} />
              <MiniLine label="الهاتف" value={invoice.client?.phone} />
              <MiniLine label="البريد" value={invoice.client?.email} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-black" style={{ color: 'var(--text)' }}>
              بيانات القضية
            </h2>

            <div className="mt-4 space-y-3">
              <MiniLine label="القضية" value={invoice.case?.title || 'بدون قضية'} />
              <MiniLine label="رقم القضية" value={invoice.case?.caseNumber} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-black" style={{ color: 'var(--text)' }}>
              التواريخ
            </h2>

            <div className="mt-4 space-y-3">
              <MiniLine label="تاريخ الإصدار" value={formatDate(invoice.issueDate)} />
              <MiniLine
                label="تاريخ الاستحقاق"
                value={invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
              />
            </div>
          </div>
        </div>

        {/* Invoice Printable Area */}
        <div className="space-y-5 xl:col-span-8 print:block">
          <div
            ref={invoiceRef}
            className="rounded-[28px] border bg-white p-6 text-black shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Print Header */}
            <div className="mb-6 rounded-3xl bg-[#12382d] p-6 text-white print:rounded-none">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                <div>
                  {invoice.tenant?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={invoice.tenant.logoUrl}
                      alt={tenantName}
                      className="mb-3 h-14 w-auto rounded-2xl bg-white/10 object-contain p-2"
                    />
                  ) : null}

                  <h1 className="text-3xl font-black">{tenantName}</h1>
                  <p className="mt-1 text-sm text-white/80">
                    {invoice.tenant?.email || 'نظام إدارة مكاتب المحاماة'}
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    {invoice.tenant?.phone || ''}
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    {invoice.tenant?.address || ''}
                  </p>
                </div>

                <div className="text-left">
                  <h2 className="text-3xl font-black">فاتورة</h2>
                  <p className="mt-1 text-sm">
                    رقم الفاتورة: {formatInvoiceNumber(invoice.invoiceNumber)}
                  </p>
                  <p className="mt-1 text-sm">
                    تاريخ الإصدار: {formatDate(invoice.issueDate)}
                  </p>
                  <p className="mt-1 text-sm">
                    تاريخ الاستحقاق:{' '}
                    {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Invoice Meta */}
            <div
              className="mb-5 overflow-hidden rounded-3xl border"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="grid md:grid-cols-3">
                <div className="border-b p-5 md:border-b-0 md:border-l">
                  <p className="text-sm font-bold text-slate-500">الموكل</p>
                  <p className="mt-1 font-black">{invoice.client?.name || '-'}</p>
                  <p className="mt-1 text-sm">{invoice.client?.phone || '-'}</p>
                  <p className="mt-1 text-sm">{invoice.client?.email || '-'}</p>
                </div>

                <div className="border-b p-5 md:border-b-0 md:border-l">
                  <p className="text-sm font-bold text-slate-500">القضية</p>
                  <p className="mt-1 font-black">
                    {invoice.case ? invoice.case.title : 'بدون قضية'}
                  </p>
                  <p className="mt-1 text-sm">{invoice.case?.caseNumber || '-'}</p>
                </div>

                <div className="p-5">
                  <p className="text-sm font-bold text-slate-500">الحالة</p>
                  <p className="mt-1 font-black">{statusLabels[invoice.status]}</p>
                  <p className="mt-1 text-sm">
                    {invoice.payment
                      ? `دفعة: ${paymentStatusLabel(invoice.payment.status)}`
                      : 'لا توجد دفعة مرتبطة'}
                  </p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div
              className="overflow-hidden rounded-3xl border"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="border-b p-5">
                <h2 className="text-xl font-black">بنود الفاتورة</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الوصف</th>
                      <th>الكمية</th>
                      <th>سعر الوحدة</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td className="font-bold">{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td className="font-bold">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t p-5">
                <div className="w-full max-w-sm space-y-3">
                  <MoneyLine label="المجموع الفرعي" value={invoice.subtotal} />
                  <MoneyLine label="الضريبة" value={invoice.tax} />
                  <MoneyLine label="الخصم" value={invoice.discount} />

                  <div className="flex justify-between border-t pt-3 text-xl font-black">
                    <span>الإجمالي النهائي</span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {invoice.payment && (
              <div
                className="mt-5 rounded-3xl border p-5"
                style={{ borderColor: 'var(--border)' }}
              >
                <h2 className="text-xl font-black">الدفعة المرتبطة</h2>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm font-bold text-slate-500">المبلغ</p>
                    <p className="mt-1 font-black">
                      {formatCurrency(invoice.payment.amount)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-500">الحالة</p>
                    <p className="mt-1 font-black">
                      {paymentStatusLabel(invoice.payment.status)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-500">تاريخ الدفع</p>
                    <p className="mt-1 font-black">
                      {invoice.payment.paidAt
                        ? formatDate(invoice.payment.paidAt)
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {invoice.notes && (
              <div
                className="mt-5 rounded-3xl border p-5"
                style={{ borderColor: 'var(--border)' }}
              >
                <h2 className="text-xl font-black">ملاحظات</h2>
                <p className="mt-3 leading-8">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
          onClick={() => setEditOpen(false)}
        >
          <form
            onSubmit={submitEdit}
            onClick={(e) => e.stopPropagation()}
            className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black" style={{ color: 'var(--text)' }}>
                  تعديل الفاتورة
                </h2>

                <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
                  تعديل التواريخ والبنود والضريبة والخصم. لا يمكن تعديل فاتورة مدفوعة.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-bold hover:bg-black/5"
              >
                ✕
              </button>
            </div>

            {!canEditFinancials && (
              <div
                className="mb-4 rounded-2xl border p-4 text-sm font-bold"
                style={{
                  borderColor: '#fbbf24',
                  background: 'var(--amber-soft)',
                  color: '#92400e',
                }}
              >
                هذه الفاتورة مدفوعة، لذلك تم منع تعديل البيانات المالية لحماية السجلات.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-bold">تاريخ الاستحقاق</span>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="input"
                  disabled={!canEditFinancials}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">الضريبة</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editTax}
                  onChange={(e) => setEditTax(Number(e.target.value || 0))}
                  className="input"
                  disabled={!canEditFinancials}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">الخصم</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(Number(e.target.value || 0))}
                  className="input"
                  disabled={!canEditFinancials}
                />
              </label>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-black" style={{ color: 'var(--text)' }}>
                  البنود
                </h3>

                <button
                  type="button"
                  onClick={addEditItem}
                  className="btn btn-ghost"
                  disabled={!canEditFinancials}
                >
                  + إضافة بند
                </button>
              </div>

              <div className="space-y-3">
                {editItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border p-3 md:grid-cols-[1fr_120px_140px_90px]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateEditItem(index, 'description', e.target.value)
                      }
                      placeholder="وصف البند"
                      className="input"
                      disabled={!canEditFinancials}
                    />

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        updateEditItem(index, 'quantity', e.target.value)
                      }
                      placeholder="الكمية"
                      className="input"
                      disabled={!canEditFinancials}
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateEditItem(index, 'unitPrice', e.target.value)
                      }
                      placeholder="سعر الوحدة"
                      className="input"
                      disabled={!canEditFinancials}
                    />

                    <button
                      type="button"
                      onClick={() => removeEditItem(index)}
                      className="rounded-xl px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                      disabled={!canEditFinancials || editItems.length === 1}
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-bold">ملاحظات</span>

              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
                className="input min-h-28"
                disabled={!canEditFinancials}
              />
            </label>

            <div className="mt-5 flex justify-end">
              <div
                className="w-full max-w-sm space-y-2 rounded-2xl border p-4"
                style={{ borderColor: 'var(--border)' }}
              >
                <MoneyLine label="المجموع الفرعي" value={editSubtotal} />
                <MoneyLine label="الضريبة" value={Number(editTax || 0)} />
                <MoneyLine label="الخصم" value={Number(editDiscount || 0)} />

                <div className="flex justify-between border-t pt-2 text-lg font-black">
                  <span>الإجمالي</span>
                  <span>{formatCurrency(editTotal)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="btn btn-ghost"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={saving || !canEditFinancials}
                className="btn btn-primary"
              >
                {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function InfoCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string | number
  hint: string
  tone?: 'green' | 'amber' | 'red'
}) {
  const style =
    tone === 'green'
      ? {
          background: 'var(--green-soft)',
          color: 'var(--sidebar)',
        }
      : tone === 'amber'
        ? {
            background: 'var(--amber-soft)',
            color: '#92400e',
          }
        : tone === 'red'
          ? {
              background: 'var(--red-soft)',
              color: '#dc2626',
            }
          : {
              background: 'var(--card)',
              color: 'var(--text)',
            }

  return (
    <div
      className="card p-5"
      style={{
        background: style.background,
        borderColor: 'var(--border)',
      }}
    >
      <p className="text-xs font-black" style={{ color: style.color }}>
        {label}
      </p>

      <p className="mt-2 text-2xl font-black" style={{ color: style.color }}>
        {value}
      </p>

      <p className="mt-1 text-xs font-bold" style={{ color: 'var(--text-3)' }}>
        {hint}
      </p>
    </div>
  )
}

function MiniLine({
  label,
  value,
}: {
  label: string
  value?: string | null
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
        className="mt-1 break-words text-sm font-bold"
        style={{ color: value ? 'var(--text)' : 'var(--text-3)' }}
      >
        {value || 'غير محدد'}
      </p>
    </div>
  )
}

function MoneyLine({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
    </div>
  )
}