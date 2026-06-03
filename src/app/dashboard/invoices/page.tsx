'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'

import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  buildInvoiceWhatsAppMessage,
  formatInvoiceNumber,
  normalizeWhatsAppPhone,
  printInvoiceDocument,
} from '@/lib/invoice-print'

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
  DRAFT: 'badge badge-gray',
  UNPAID: 'badge badge-amber',
  PAID: 'badge badge-green',
  OVERDUE: 'badge badge-red',
  CANCELLED: 'badge badge-gray',
}

const STATUS_OPTIONS: Array<{ value: '' | InvoiceStatus; label: string }> = [
  { value: '', label: 'كل الحالات' },
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'UNPAID', label: 'غير مدفوعة' },
  { value: 'PAID', label: 'مدفوعة' },
  { value: 'OVERDUE', label: 'متأخرة' },
  { value: 'CANCELLED', label: 'ملغاة' },
]

function safeList(data: any) {
  return Array.isArray(data?.data) ? data.data : data?.data?.items ?? []
}

function getMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback
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
  const [status, setStatus] = useState<'' | InvoiceStatus>('')

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
    return cases.filter((item) => item.clientId === clientId)
  }, [cases, clientId])

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0)
    }, 0)
  }, [items])

  const total = Math.max(subtotal + Number(tax || 0) - Number(discount || 0), 0)

  const stats = useMemo(() => {
    const totalAmount = invoices.reduce((sum, invoice) => {
      return sum + Number(invoice.total || 0)
    }, 0)

    const paidAmount = invoices
      .filter((invoice) => invoice.status === 'PAID')
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)

    const unpaidAmount = invoices
      .filter((invoice) => ['UNPAID', 'OVERDUE'].includes(invoice.status))
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)

    const overdueCount = invoices.filter((invoice) => invoice.status === 'OVERDUE').length
    const paidCount = invoices.filter((invoice) => invoice.status === 'PAID').length

    return {
      totalAmount,
      paidAmount,
      unpaidAmount,
      overdueCount,
      paidCount,
      totalCount: invoices.length,
    }
  }, [invoices])

  async function load() {
    setLoading(true)

    try {
      const params = new URLSearchParams()

      if (q.trim()) params.set('q', q.trim())
      if (status) params.set('status', status)

      const [invoiceRes, clientRes, caseRes] = await Promise.all([
        fetch(`/api/invoices?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/clients?limit=100', { cache: 'no-store' }),
        fetch('/api/cases?limit=100', { cache: 'no-store' }),
      ])

      if (
        invoiceRes.status === 401 ||
        clientRes.status === 401 ||
        caseRes.status === 401
      ) {
        window.location.href = '/login'
        return
      }

      if (!invoiceRes.ok || !clientRes.ok || !caseRes.ok) {
        setInvoices([])
        setClients([])
        setCases([])
        return
      }

      const invoiceData = await invoiceRes.json().catch(() => ({}))
      const clientData = await clientRes.json().catch(() => ({}))
      const caseData = await caseRes.json().catch(() => ({}))

      setInvoices(safeList(invoiceData))
      setClients(safeList(clientData))
      setCases(safeList(caseData))
    } catch (error) {
      console.error('Invoices load failed:', error)
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

  function closeModal() {
    if (saving) return
    setOpen(false)
    resetForm()
  }

  function updateItem(index: number, key: keyof InvoiceItem, value: string) {
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: key === 'description' ? value : Number(value || 0),
            }
          : item
      )
    )
  }

  function addItem() {
    setItems((previous) => [
      ...previous,
      { description: '', quantity: 1, unitPrice: 0 },
    ])
  }

  function removeItem(index: number) {
    setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index))
  }

  async function createInvoice(event: FormEvent) {
    event.preventDefault()

    if (!clientId) {
      alert('اختار الموكل')
      return
    }

    const cleanItems = items.filter((item) => item.description.trim())

    if (cleanItems.length === 0) {
      alert('أضف بند واحد على الأقل')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/invoices', {
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

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        alert(getMessage(data, 'حدث خطأ أثناء إنشاء الفاتورة'))
        return
      }

      setOpen(false)
      resetForm()
      await load()
    } catch {
      alert('حدث خطأ أثناء إنشاء الفاتورة')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(invoice: Invoice, nextStatus: InvoiceStatus) {
    if (invoice.status === nextStatus) return

    if (nextStatus === 'PAID' && !invoice.case) {
      alert('لا يمكن تعليم الفاتورة كمدفوعة لأنها غير مرتبطة بقضية')
      return
    }

    if (invoice.payment && invoice.status === 'PAID' && nextStatus !== 'PAID') {
      const confirmed = confirm(
        'هذه الفاتورة مدفوعة ومرتبطة بدفعة. سيتم تحديث حالة الدفعة المرتبطة حسب الحالة الجديدة. هل تريد المتابعة؟'
      )

      if (!confirmed) return
    }

    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      alert(getMessage(data, 'تعذر تحديث حالة الفاتورة'))
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

    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'DELETE',
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      alert(getMessage(data, 'تعذر حذف الفاتورة'))
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

  function openInvoice(invoice: Invoice) {
    if (!invoice.id) return
    router.push(`/dashboard/invoices/${invoice.id}`)
  }

  if (!mounted || loading) {
    return <PageLoader />
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
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              إدارة الفواتير
            </div>

            <h1 className="text-2xl font-black text-white">الفواتير</h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              إنشاء وإدارة فواتير الموكلين والقضايا، متابعة الحالات المالية، وطباعة أو إرسال الفواتير بسهولة.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
                borderColor: 'rgba(255,255,255,0.32)',
              }}
            >
              + إنشاء فاتورة
            </button>

            <button
              type="button"
              onClick={load}
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            >
              تحديث
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'عدد الفواتير',
            value: stats.totalCount,
            hint: 'كل الفواتير',
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: 'إجمالي الفواتير',
            value: formatCurrency(stats.totalAmount),
            hint: 'القيمة الكلية',
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: 'المدفوع',
            value: formatCurrency(stats.paidAmount),
            hint: `${stats.paidCount} فاتورة`,
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: 'غير المحصل',
            value: formatCurrency(stats.unpaidAmount),
            hint: 'غير مدفوعة/متأخرة',
            color: stats.unpaidAmount > 0 ? '#92400e' : 'var(--text-3)',
            bg: stats.unpaidAmount > 0 ? 'var(--amber-soft)' : 'var(--card)',
          },
          {
            label: 'المتأخرة',
            value: stats.overdueCount,
            hint: 'تحتاج متابعة',
            color: stats.overdueCount > 0 ? '#dc2626' : 'var(--text)',
            bg: stats.overdueCount > 0 ? 'var(--red-soft)' : 'var(--card)',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5"
            style={{
              background: item.bg,
              borderColor: 'var(--border)',
            }}
          >
            <p className="text-xs font-black" style={{ color: item.color }}>
              {item.label}
            </p>

            <p className="mt-2 text-2xl font-black" style={{ color: item.color }}>
              {item.value}
            </p>

            <p className="mt-1 text-xs font-bold" style={{ color: 'var(--text-3)' }}>
              {item.hint}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_.8fr_auto_auto]">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="بحث برقم الفاتورة أو الموكل أو القضية..."
            className="input"
          />

          <select
            aria-label="فلترة الفواتير حسب الحالة"
            value={status}
            onChange={(event) => setStatus(event.target.value as '' | InvoiceStatus)}
            className="input"
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button type="button" onClick={load} className="btn btn-primary whitespace-nowrap">
            بحث
          </button>

          <button
            type="button"
            onClick={() => {
              setQ('')
              setStatus('')
              setTimeout(load, 0)
            }}
            className="btn btn-ghost whitespace-nowrap"
          >
            مسح
          </button>
        </div>
      </div>

      {/* Content */}
      {invoices.length === 0 ? (
        <div className="card p-8">
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
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div
            className="flex flex-col gap-2 border-b px-5 py-4 md:flex-row md:items-center md:justify-between"
            style={{ borderColor: 'var(--border)' }}
          >
            <div>
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                قائمة الفواتير
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {invoices.length} فاتورة ضمن النتائج الحالية
              </p>
            </div>

            {stats.overdueCount > 0 ? (
              <span className="badge badge-red">
                {stats.overdueCount} فاتورة متأخرة
              </span>
            ) : (
              <span className="badge badge-green">لا توجد فواتير متأخرة</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>الموكل</th>
                  <th>القضية</th>
                  <th>الإجمالي</th>
                  <th>الحالة</th>
                  <th>الإصدار</th>
                  <th>الاستحقاق</th>
                  <th>إجراءات</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => openInvoice(invoice)}
                    className="cursor-pointer"
                  >
                    <td>
                      <p className="font-black" style={{ color: 'var(--text)' }}>
                        {formatInvoiceNumber(invoice.invoiceNumber)}
                      </p>

                      {invoice.payment && (
                        <p
                          className="mt-1 text-[11px] font-bold"
                          style={{
                            color:
                              invoice.payment.status === 'PAID'
                                ? 'var(--sidebar)'
                                : '#92400e',
                          }}
                        >
                          {invoice.payment.status === 'PAID'
                            ? 'دفعة مدفوعة'
                            : 'دفعة معلّقة'}
                        </p>
                      )}
                    </td>

                    <td>
                      <p className="font-bold" style={{ color: 'var(--text)' }}>
                        {invoice.client?.name || '-'}
                      </p>

                      {invoice.client?.phone && (
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                          {invoice.client.phone}
                        </p>
                      )}
                    </td>

                    <td>
                      {invoice.case ? (
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text)' }}>
                            {invoice.case.title}
                          </p>

                          {invoice.case.caseNumber && (
                            <p className="mt-1 font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                              {invoice.case.caseNumber}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-3)' }}>-</span>
                      )}
                    </td>

                    <td className="font-black" style={{ color: 'var(--sidebar)' }}>
                      {formatCurrency(invoice.total)}
                    </td>

                    <td>
                      <span className={statusClasses[invoice.status]}>
                        {statusLabels[invoice.status]}
                      </span>
                    </td>

                    <td>{formatDate(invoice.issueDate)}</td>

                    <td>{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</td>

                    <td>
                      <div
                        className="flex flex-wrap gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openInvoice(invoice)}
                          className="rounded-xl px-3 py-2 text-xs font-bold transition hover:bg-black/5"
                        >
                          عرض
                        </button>

                        <select
                          aria-label={`تغيير حالة الفاتورة ${invoice.invoiceNumber}`}
                          value={invoice.status}
                          onChange={(event) =>
                            updateStatus(invoice, event.target.value as InvoiceStatus)
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
                        >
                          🖨️ طباعة
                        </button>

                        <button
                          type="button"
                          onClick={() => sendInvoiceWhatsApp(invoice)}
                          className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
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
                          className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
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

      {/* Create Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <form
            onSubmit={createInvoice}
            onClick={(event) => event.stopPropagation()}
            className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black" style={{ color: 'var(--text)' }}>
                  إنشاء فاتورة جديدة
                </h2>

                <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
                  أضف بيانات الفاتورة والبنود المالية
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
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
                  onChange={(event) => {
                    setClientId(event.target.value)
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
                  onChange={(event) => setCaseId(event.target.value)}
                  className="input"
                  disabled={!clientId}
                >
                  <option value="">بدون قضية</option>

                  {filteredCases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.caseNumber ? ` - ${item.caseNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">تاريخ الاستحقاق</span>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="input"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">ملاحظات</span>

                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="مثال: الدفعة الأولى من الأتعاب"
                  className="input"
                />
              </label>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black" style={{ color: 'var(--text)' }}>
                  بنود الفاتورة
                </h3>

                <button type="button" onClick={addItem} className="btn btn-ghost">
                  + إضافة بند
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border p-3 md:grid-cols-[1fr_120px_150px_80px]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <input
                      value={item.description}
                      onChange={(event) =>
                        updateItem(index, 'description', event.target.value)
                      }
                      placeholder="وصف البند"
                      className="input"
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, 'quantity', event.target.value)
                      }
                      placeholder="الكمية"
                      className="input"
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(index, 'unitPrice', event.target.value)
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
                  onChange={(event) => setTax(Number(event.target.value || 0))}
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
                  onChange={(event) => setDiscount(Number(event.target.value || 0))}
                  className="input"
                />
              </label>

              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: 'var(--border)' }}
              >
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  الإجمالي النهائي
                </p>

                <p className="mt-1 text-2xl font-black" style={{ color: 'var(--sidebar)' }}>
                  {formatCurrency(total)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="btn btn-ghost">
                إلغاء
              </button>

              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}