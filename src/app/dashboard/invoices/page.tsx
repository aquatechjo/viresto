'use client'

import { useEffect, useMemo, useState } from 'react'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  buildInvoiceWhatsAppMessage,
  formatInvoiceNumber,
  normalizeWhatsAppPhone,
  printInvoiceDocument,
} from '@/lib/invoice-print'
import { useRouter } from 'next/navigation'

type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'

interface ClientOption {
  id: string
  name: string
}

interface CaseOption {
  id: string
  title: string
  caseNumber?: string | null
  clientId: string
}

interface InvoiceItem {
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

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [cases, setCases] = useState<CaseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)


  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')

  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [caseId, setCaseId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tax, setTax] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ])

  const filteredCases = useMemo(() => {
    if (!clientId) return []
    return cases.filter((c) => c.clientId === clientId)
  }, [cases, clientId])

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0)
    }, 0)
  }, [items])

  const total = Math.max(subtotal + Number(tax || 0) - Number(discount || 0), 0)

  async function load() {
    setLoading(true)

    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status) params.set('status', status)

      const [invoiceRes, clientRes, caseRes] = await Promise.all([
        fetch(`/api/invoices?${params.toString()}`),
        fetch('/api/clients'),
        fetch('/api/cases'),
      ])

      if (
        invoiceRes.status === 401 ||
        clientRes.status === 401 ||
        caseRes.status === 401
      ) {
        window.location.href = '/login'
        return
      }

      if (!mounted || loading) {
  return <PageLoader />
}

      if (!invoiceRes.ok || !clientRes.ok || !caseRes.ok) {
        setInvoices([])
        setClients([])
        setCases([])
        return
      }

      const invoiceData = await invoiceRes.json()
      const clientData = await clientRes.json()
      const caseData = await caseRes.json()

      setInvoices(invoiceData.data ?? [])

      const clientList = Array.isArray(clientData.data)
        ? clientData.data
        : clientData.data?.items ?? []

      const caseList = Array.isArray(caseData.data)
        ? caseData.data
        : caseData.data?.items ?? []

      setClients(clientList)
      setCases(caseList)
    } catch (error) {
      console.error(error)
      setInvoices([])
      setClients([])
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
  setMounted(true)
}, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetForm() {
    setClientId('')
    setCaseId('')
    setDueDate('')
    setTax(0)
    setDiscount(0)
    setNotes('')
    setItems([{ description: '', quantity: 1, unitPrice: 0 }])
  }

  function updateItem(index: number, key: keyof InvoiceItem, value: string) {
    setItems((prev) =>
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

  function addItem() {
    setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault()

    if (!clientId) {
      alert('اختار الموكل')
      return
    }

    const cleanItems = items.filter((item) => item.description.trim())

    if (cleanItems.length === 0) {
      alert('أضف بند واحد على الأقل')
      return
    }

    setSaving(true)

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        caseId: caseId || null,
        dueDate: dueDate || null,
        tax,
        discount,
        notes,
        items: cleanItems,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      alert(data.message || data.error || 'حدث خطأ أثناء إنشاء الفاتورة')
      return
    }

    setOpen(false)
    resetForm()
    await load()
  }

async function updateStatus(invoice: Invoice, nextStatus: InvoiceStatus) {
  if (invoice.status === nextStatus) return

  if (nextStatus === 'PAID' && !invoice.case) {
    alert('لا يمكن تعليم الفاتورة كمدفوعة لأنها غير مرتبطة بقضية')
    return
  }

  if (invoice.payment && invoice.status === 'PAID' && nextStatus !== 'PAID') {
    const ok = confirm(
      'هذه الفاتورة مدفوعة ومرتبطة بدفعة. سيتم تحديث حالة الدفعة المرتبطة حسب الحالة الجديدة. هل تريد المتابعة؟'
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

async function deleteInvoice(invoice: Invoice) {
  if (invoice.payment) {
    alert('لا يمكن حذف فاتورة مرتبطة بدفعة. غيّر حالة الفاتورة أو احذف الدفعة المرتبطة أولًا.')
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

  await load()
}

function printInvoice(invoice: Invoice) {
  printInvoiceDocument(invoice)
}

function sendInvoiceWhatsApp(invoice: Invoice) {
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




  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black">الفواتير</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            إنشاء وإدارة فواتير الموكلين والقضايا
          </p>
        </div>

        <button onClick={() => setOpen(true)} className="btn btn-primary">
          + إنشاء فاتورة
        </button>
      </div>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_120px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث برقم الفاتورة أو الموكل أو القضية..."
            className="input"
          />

          <select
            aria-label="فلترة الفواتير حسب الحالة"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input"
          >
            <option value="">كل الحالات</option>
            <option value="DRAFT">مسودة</option>
            <option value="UNPAID">غير مدفوعة</option>
            <option value="PAID">مدفوعة</option>
            <option value="OVERDUE">متأخرة</option>
            <option value="CANCELLED">ملغاة</option>
          </select>

          <button onClick={load} className="btn btn-secondary">
            بحث
          </button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="لا توجد فواتير"
          sub="ابدأ بإنشاء أول فاتورة لموكل أو قضية"
          action={
            <button onClick={() => setOpen(true)} className="btn btn-primary">
              + إنشاء فاتورة
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>الموكل</th>
                  <th>القضية</th>
                  <th>الإجمالي</th>
                  <th>الحالة</th>
                  <th>تاريخ الإصدار</th>
                  <th>تاريخ الاستحقاق</th>
                  <th>إجراءات</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr
  key={invoice.id}
  onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
  className="cursor-pointer"
>
                    <td className="font-black text-[13px]">{formatInvoiceNumber(invoice.invoiceNumber)}</td>
                    <td>{invoice.client?.name || '-'}</td>
                    <td>
                      {invoice.case
                        ? `${invoice.case.title}${
                            invoice.case.caseNumber
                              ? ` - ${invoice.case.caseNumber}`
                              : ''
                          }`
                        : '-'}
                    </td>
                    <td className="font-bold">
                      {formatCurrency(invoice.total)}
                    </td>
<td>
  <span
    className={`rounded-full px-3 py-1 text-xs font-bold ${
      statusClasses[invoice.status]
    }`}
  >
    {statusLabels[invoice.status]}
  </span>

{invoice.payment && (
  <div
    className={`mt-1 text-[11px] font-bold ${
      invoice.payment.status === 'PAID'
        ? 'text-emerald-700'
        : 'text-amber-700'
    }`}
  >
    {invoice.payment.status === 'PAID'
      ? 'دفعة مدفوعة'
      : 'دفعة معلّقة'}
  </div>
)}
</td>
                    <td>{formatDate(invoice.issueDate)}</td>
                    <td>{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</td>
<td>
  <div
    className="flex flex-wrap gap-2"
    onClick={(e) => e.stopPropagation()}
  >

    <button
  type="button"
  onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
  className="rounded-xl px-3 py-2 text-xs font-bold transition hover:bg-black/5"
  title="عرض التفاصيل"
>
  عرض
</button>


<select
  aria-label={`تغيير حالة الفاتورة ${invoice.invoiceNumber}`}
  value={invoice.status}
onChange={(e) =>
  updateStatus(invoice, e.target.value as InvoiceStatus)
}
  className="input h-9 min-w-[130px] text-xs"
>
                          <option value="DRAFT">مسودة</option>
                          <option value="UNPAID">غير مدفوعة</option>
                          <option value="PAID">مدفوعة</option>
                          <option value="OVERDUE">متأخرة</option>
                          <option value="CANCELLED">ملغاة</option>
                        </select>

                        

                        <button
                          type="button"
                          onClick={() => printInvoice(invoice)}
                          className="rounded-xl border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black/5"
                          title="طباعة الفاتورة بتصميم احترافي"
                        >
                          🖨️ طباعة
                        </button>

                        <button
                          type="button"
                          onClick={() => sendInvoiceWhatsApp(invoice)}
                          className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
                          title="إرسال تفاصيل الفاتورة عبر واتساب"
                        >
                          واتساب
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteInvoice(invoice)}
                          disabled={!!invoice.payment}
                          title={
                            invoice.payment
                              ? 'لا يمكن حذف فاتورة مرتبطة بدفعة'
                              : 'حذف الفاتورة'
                          }
                          className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
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
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={createInvoice}
            onClick={(e) => e.stopPropagation()}
            className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">إنشاء فاتورة جديدة</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                  أضف بيانات الفاتورة والبنود المالية
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm hover:bg-black/5"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-bold">الموكل</span>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value)
                    setCaseId('')
                  }}
                  className="input"
                  required
                >
                  <option value="">اختر الموكل</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">القضية</span>
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="input"
                  disabled={!clientId}
                >
                  <option value="">بدون قضية</option>
                  {filteredCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                      {c.caseNumber ? ` - ${c.caseNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">تاريخ الاستحقاق</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">ملاحظات</span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: الدفعة الأولى من الأتعاب"
                  className="input"
                />
              </label>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black">بنود الفاتورة</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="btn btn-secondary"
                >
                  + إضافة بند
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border p-3 md:grid-cols-[1fr_120px_150px_80px]"
                  >
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, 'description', e.target.value)
                      }
                      placeholder="وصف البند"
                      className="input"
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, 'quantity', e.target.value)
                      }
                      placeholder="الكمية"
                      className="input"
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(index, 'unitPrice', e.target.value)
                      }
                      placeholder="سعر الوحدة"
                      className="input"
                    />

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="rounded-xl px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-bold">الضريبة</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax}
                  onChange={(e) => setTax(Number(e.target.value || 0))}
                  className="input"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">الخصم</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value || 0))}
                  className="input"
                />
              </label>

              <div className="rounded-2xl border p-4">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  الإجمالي النهائي
                </p>
                <p className="mt-1 text-2xl font-black">
                  {formatCurrency(total)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-secondary"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}