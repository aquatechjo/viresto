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
  DRAFT: 'bg-slate-100 text-slate-700',
  UNPAID: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-zinc-100 text-zinc-600',
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
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
    setLoading(true)

    const res = await fetch(`/api/invoices/${id}`)

    if (res.status === 401) {
      window.location.href = '/login'
      return
    }

    if (!res.ok) {
      setInvoice(null)
      setLoading(false)
      return
    }

    const data = await res.json()
    setInvoice(data.data ?? null)
    setLoading(false)
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
    setEditItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }])
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
  const editTotal = roundMoney(editSubtotal + Number(editTax || 0) - Number(editDiscount || 0))

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
    setSaving(false)

    if (!res.ok) {
      alert(data.message || data.error || 'تعذر تعديل الفاتورة')
      return
    }

    setEditOpen(false)
    await load()
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

  if (!invoice) {
    return (
      <div className="card p-6 text-center">
        <h1 className="text-xl font-black">الفاتورة غير موجودة</h1>
        <button
          onClick={() => router.push('/dashboard/invoices')}
          className="btn btn-primary mt-4"
        >
          رجوع للفواتير
        </button>
      </div>
    )
  }

  const tenantName = invoice.tenant?.name || 'Viresto'
  const canEditFinancials = invoice.status !== 'PAID'


  if (!mounted) {
  return <PageLoader />
}


  return (
    <div className="space-y-6 print:space-y-4 print:bg-white print:text-black">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center print:hidden">
        <div>
          <button
            onClick={() => router.push('/dashboard/invoices')}
            className="mb-3 text-sm font-bold hover:underline"
            style={{ color: 'var(--muted)' }}
          >
            ← رجوع للفواتير
          </button>

          <h1 className="text-2xl font-black">فاتورة {formatInvoiceNumber(invoice.invoiceNumber)}</h1>

          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            تفاصيل الفاتورة والبنود والمدفوعات المرتبطة
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={openEditModal} className="btn btn-primary">
            تعديل الفاتورة
          </button>

          <button onClick={printInvoice} className="btn btn-secondary">
            🖨️ طباعة
          </button>

          <button
            onClick={downloadInvoicePDF}
            disabled={pdfLoading}
            className="btn btn-primary"
          >
            {pdfLoading ? 'جارٍ إنشاء PDF...' : '⬇️ تحميل PDF'}
          </button>

          <button onClick={sendInvoiceWhatsApp} className="btn btn-secondary">
            واتساب
          </button>

          <button
            onClick={deleteInvoice}
            className="rounded-xl px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
          >
            حذف
          </button>
        </div>
      </div>

      <div ref={invoiceRef} className="rounded-[28px] border border-slate-200 bg-white p-7 text-black shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="mb-6 block">
          <div className="mb-6 flex items-start justify-between rounded-3xl bg-[#12382d] p-6 text-white">
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
              <p className="mt-1 text-sm text-white/80">{invoice.tenant?.email || 'نظام إدارة مكاتب المحاماة'}</p>
              <p className="mt-1 text-sm text-white/80">{invoice.tenant?.phone || ''}</p>
              <p className="mt-1 text-sm text-white/80">{invoice.tenant?.address || ''}</p>
            </div>

            <div className="text-left">
              <h2 className="text-3xl font-black">فاتورة</h2>
              <p className="mt-1 text-sm">رقم الفاتورة: {formatInvoiceNumber(invoice.invoiceNumber)}</p>
              <p className="mt-1 text-sm">تاريخ الإصدار: {formatDate(invoice.issueDate)}</p>
              <p className="mt-1 text-sm">
                تاريخ الاستحقاق: {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="flex flex-col justify-between gap-4 p-6 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
                رقم الفاتورة
              </p>
              <h2 className="mt-1 text-3xl font-black">{formatInvoiceNumber(invoice.invoiceNumber)}</h2>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[invoice.status]}`}>
                  {statusLabels[invoice.status]}
                </span>

                {invoice.payment && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    مرتبطة بدفعة
                  </span>
                )}
              </div>
            </div>

            <div className="print:hidden">
              <p className="mb-2 text-sm font-bold">تغيير الحالة</p>
              <select
                value={invoice.status}
                onChange={(e) => updateStatus(e.target.value as InvoiceStatus)}
                className="input min-w-[170px]"
              >
                <option value="DRAFT">مسودة</option>
                <option value="UNPAID">غير مدفوعة</option>
                <option value="PAID">مدفوعة</option>
                <option value="OVERDUE">متأخرة</option>
                <option value="CANCELLED">ملغاة</option>
              </select>
            </div>
          </div>

          <div className="grid border-t md:grid-cols-3">
            <div className="border-b p-5 md:border-b-0 md:border-l">
              <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
                الموكل
              </p>
              <p className="mt-1 font-black">{invoice.client?.name || '-'}</p>
              <p className="mt-1 text-sm">{invoice.client?.phone || '-'}</p>
              <p className="mt-1 text-sm">{invoice.client?.email || '-'}</p>
            </div>

            <div className="border-b p-5 md:border-b-0 md:border-l">
              <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
                القضية
              </p>
              <p className="mt-1 font-black">{invoice.case ? invoice.case.title : 'بدون قضية'}</p>
              <p className="mt-1 text-sm">{invoice.case?.caseNumber || '-'}</p>
            </div>

            <div className="p-5">
              <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
                التواريخ
              </p>
              <p className="mt-1 text-sm">تاريخ الإصدار: {formatDate(invoice.issueDate)}</p>
              <p className="mt-1 text-sm">
                تاريخ الاستحقاق: {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
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
              <div className="flex justify-between">
                <span>المجموع الفرعي</span>
                <strong>{formatCurrency(invoice.subtotal)}</strong>
              </div>

              <div className="flex justify-between">
                <span>الضريبة</span>
                <strong>{formatCurrency(invoice.tax)}</strong>
              </div>

              <div className="flex justify-between">
                <span>الخصم</span>
                <strong>{formatCurrency(invoice.discount)}</strong>
              </div>

              <div className="flex justify-between border-t pt-3 text-xl font-black">
                <span>الإجمالي النهائي</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {invoice.payment && (
          <div className="card p-5">
            <h2 className="text-xl font-black">الدفعة المرتبطة</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
                  المبلغ
                </p>
                <p className="mt-1 font-black">{formatCurrency(invoice.payment.amount)}</p>
              </div>

              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
                  الحالة
                </p>
                <p className="mt-1 font-black">{invoice.payment.status}</p>
              </div>

              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
                  تاريخ الدفع
                </p>
                <p className="mt-1 font-black">
                  {invoice.payment.paidAt ? formatDate(invoice.payment.paidAt) : '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        {invoice.notes && (
          <div className="card p-5">
            <h2 className="text-xl font-black">ملاحظات</h2>
            <p className="mt-3 leading-8">{invoice.notes}</p>
          </div>
        )}
      </div>

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
                <h2 className="text-xl font-black">تعديل الفاتورة</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
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
              <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
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
                <h3 className="font-black">البنود</h3>
                <button
                  type="button"
                  onClick={addEditItem}
                  className="btn btn-secondary"
                  disabled={!canEditFinancials}
                >
                  + إضافة بند
                </button>
              </div>

              <div className="space-y-3">
                {editItems.map((item, index) => (
                  <div key={index} className="grid gap-3 rounded-2xl border p-3 md:grid-cols-[1fr_120px_140px_90px]">
                    <input
                      value={item.description}
                      onChange={(e) => updateEditItem(index, 'description', e.target.value)}
                      placeholder="وصف البند"
                      className="input"
                      disabled={!canEditFinancials}
                    />

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateEditItem(index, 'quantity', e.target.value)}
                      placeholder="الكمية"
                      className="input"
                      disabled={!canEditFinancials}
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateEditItem(index, 'unitPrice', e.target.value)}
                      placeholder="سعر الوحدة"
                      className="input"
                      disabled={!canEditFinancials}
                    />

                    <button
                      type="button"
                      onClick={() => removeEditItem(index)}
                      className="rounded-xl px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
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
              <div className="w-full max-w-sm space-y-2 rounded-2xl border p-4">
                <div className="flex justify-between text-sm">
                  <span>المجموع الفرعي</span>
                  <strong>{formatCurrency(editSubtotal)}</strong>
                </div>
                <div className="flex justify-between text-sm">
                  <span>الضريبة</span>
                  <strong>{formatCurrency(Number(editTax || 0))}</strong>
                </div>
                <div className="flex justify-between text-sm">
                  <span>الخصم</span>
                  <strong>{formatCurrency(Number(editDiscount || 0))}</strong>
                </div>
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
                className="btn btn-secondary"
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
