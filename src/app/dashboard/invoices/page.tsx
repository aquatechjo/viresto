'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import AppLoader from '@/components/ui/AppLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useLocale } from '@/lib/useLocale'
import SubscriptionReadOnlyBanner from '@/components/billing/SubscriptionReadOnlyBanner'
import { useTenantWriteAccess } from '@/hooks/useTenantWriteAccess'
import type { Locale } from '@/lib/i18n'
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
  archivedAt?: string | null
}

interface CaseOption {
  id: string
  title: string
  caseNumber?: string | null
  clientId: string
  client?: {
    id?: string
    name?: string
    archivedAt?: string | null
  } | null
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
    archivedAt?: string | null
  }
  case?: {
    id: string
    title: string
    caseNumber?: string | null
    client?: {
      id?: string
      name?: string
      archivedAt?: string | null
    } | null
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


const COPY = {
  ar: {
    hero: {
      badge: 'إدارة الفواتير',
      title: 'الفواتير',
      subtitle:
        'إنشاء وإدارة فواتير الموكلين والقضايا، متابعة الحالات المالية، وطباعة أو إرسال الفواتير بسهولة.',
    },
    actions: {
      create: '+ إنشاء فاتورة',
      refresh: 'تحديث',
      search: 'بحث',
      clear: 'مسح',
      clearFilters: 'مسح الفلاتر',
      view: 'عرض',
      print: '🖨️ طباعة',
      whatsapp: 'واتساب',
      delete: 'حذف',
      addItem: '+ إضافة بند',
      saveInvoice: 'حفظ الفاتورة',
      saving: 'جارٍ الحفظ...',
      close: 'إغلاق',
    },
    stats: {
      totalInvoices: 'عدد الفواتير',
      allInvoices: 'كل الفواتير',
      totalAmount: 'إجمالي الفواتير',
      totalValue: 'القيمة الكلية',
      paid: 'المدفوع',
      invoice: (count: number) => `${count} فاتورة`,
      unpaid: 'غير المحصل',
      unpaidHint: 'غير مدفوعة/متأخرة',
      overdue: 'المتأخرة',
      overdueHint: 'تحتاج متابعة',
      archivedClients: 'موكلون مؤرشفون',
      archivedHint: 'فواتير سجلات مؤرشفة',
    },
    filters: {
      searchPlaceholder: 'بحث برقم الفاتورة أو الموكل أو القضية...',
      statusAria: 'فلترة الفواتير حسب الحالة',
      allStatuses: 'كل الحالات',
      archivedClient: 'موكل مؤرشف',
    },
    empty: {
      title: 'لا توجد فواتير',
      first: 'ابدأ بإنشاء أول فاتورة لموكل أو قضية',
      filtered: 'لا توجد نتائج مطابقة للفلاتر الحالية',
    },
    list: {
      title: 'قائمة الفواتير',
      count: (count: number) => `${count} فاتورة ضمن النتائج الحالية`,
      archivedOnly: 'فواتير موكلين مؤرشفين',
      overdueCount: (count: number) => `${count} فاتورة متأخرة`,
      noOverdue: 'لا توجد فواتير متأخرة',
      archivedRecord: 'سجل مؤرشف',
      archivedClient: 'موكل مؤرشف',
      paidPayment: 'دفعة مدفوعة',
      pendingPayment: 'دفعة معلّقة',
    },
    table: {
      invoiceNumber: 'رقم الفاتورة',
      client: 'الموكل',
      case: 'القضية',
      total: 'الإجمالي',
      status: 'الحالة',
      issueDate: 'الإصدار',
      dueDate: 'الاستحقاق',
      actions: 'إجراءات',
    },
    statuses: {
      DRAFT: 'مسودة',
      UNPAID: 'غير مدفوعة',
      PAID: 'مدفوعة',
      OVERDUE: 'متأخرة',
      CANCELLED: 'ملغاة',
    } as Record<InvoiceStatus, string>,
    modal: {
      title: 'إنشاء فاتورة جديدة',
      subtitle: 'أضف بيانات الفاتورة والبنود المالية',
      client: 'الموكل',
      chooseClient: 'اختر الموكل',
      case: 'القضية',
      noCase: 'بدون قضية',
      archivedWarning: 'سيتم إنشاء الفاتورة لموكل مؤرشف. يمكن التحصيل والتعديل، لكن لا يمكن حذف الفاتورة لاحقًا لحماية السجل المالي.',
      dueDate: 'تاريخ الاستحقاق',
      notes: 'ملاحظات',
      notesPlaceholder: 'مثال: الدفعة الأولى من الأتعاب',
      items: 'بنود الفاتورة',
      itemDescription: 'وصف البند',
      quantity: 'الكمية',
      unitPrice: 'سعر الوحدة',
      tax: 'الضريبة',
      discount: 'الخصم',
      finalTotal: 'الإجمالي النهائي',
    },
    messages: {
      chooseClient: 'اختار الموكل',
      archivedCreateBlocked: 'يمكن إنشاء فاتورة لموكل مؤرشف، لكن لا يمكن حذفها لاحقًا لحماية السجل المالي.',
      addOneItem: 'أضف بند واحد على الأقل',
      createError: 'حدث خطأ أثناء إنشاء الفاتورة',
      archivedStatusBlocked: 'يمكن تعديل حالة فاتورة الموكل المؤرشف، لكن لا يمكن حذفها لحماية السجل المالي.',
      paidNeedsCase: 'لا يمكن تعليم الفاتورة كمدفوعة لأنها غير مرتبطة بقضية',
      paidLinkedPaymentConfirm: 'سيتم تسجيل دفعة مرتبطة بالقضية عند تعليم الفاتورة كمدفوعة. هل تريد المتابعة؟',
      statusUpdateError: 'تعذر تحديث حالة الفاتورة',
      archivedDeleteBlocked: 'لا يمكن حذف فاتورة مرتبطة بموكل مؤرشف',
      linkedPaymentDeleteBlocked: 'لا يمكن حذف فاتورة مرتبطة بدفعة. غيّر حالة الفاتورة أو احذف الدفعة المرتبطة أولًا.',
      confirmDelete: 'هل أنت متأكد من حذف هذه الفاتورة؟',
      deleteError: 'تعذر حذف الفاتورة',
      noPhone: 'لا يوجد رقم هاتف محفوظ لهذا الموكل',
      deleteTitleArchived: 'لا يمكن حذف فاتورة مرتبطة بموكل مؤرشف',
      deleteTitlePayment: 'لا يمكن حذف فاتورة مرتبطة بدفعة',
      deleteTitle: 'حذف الفاتورة',
      changeStatusAria: (invoiceNumber: string) => `تغيير حالة الفاتورة ${invoiceNumber}`,
    },
  },
  en: {
    hero: {
      badge: 'Invoice management',
      title: 'Invoices',
      subtitle:
        'Create and manage client and case invoices, track financial statuses, and print or send invoices easily.',
    },
    actions: {
      create: '+ Create invoice',
      refresh: 'Refresh',
      search: 'Search',
      clear: 'Clear',
      clearFilters: 'Clear filters',
      view: 'View',
      print: '🖨️ Print',
      whatsapp: 'WhatsApp',
      delete: 'Delete',
      addItem: '+ Add item',
      saveInvoice: 'Save invoice',
      saving: 'Saving...',
      close: 'Close',
    },
    stats: {
      totalInvoices: 'Invoice count',
      allInvoices: 'All invoices',
      totalAmount: 'Total invoices',
      totalValue: 'Total value',
      paid: 'Paid',
      invoice: (count: number) => `${count} invoice${count === 1 ? '' : 's'}`,
      unpaid: 'Uncollected',
      unpaidHint: 'Unpaid/overdue',
      overdue: 'Overdue',
      overdueHint: 'Needs follow-up',
      archivedClients: 'Archived clients',
      archivedHint: 'Archived-record invoices',
    },
    filters: {
      searchPlaceholder: 'Search by invoice number, client, or case...',
      statusAria: 'Filter invoices by status',
      allStatuses: 'All statuses',
      archivedClient: 'Archived client',
    },
    empty: {
      title: 'No invoices',
      first: 'Create the first invoice for a client or case',
      filtered: 'No invoices match the current filters',
    },
    list: {
      title: 'Invoice list',
      count: (count: number) => `${count} invoice${count === 1 ? '' : 's'} in the current results`,
      archivedOnly: 'Invoices for archived clients',
      overdueCount: (count: number) => `${count} overdue invoice${count === 1 ? '' : 's'}`,
      noOverdue: 'No overdue invoices',
      archivedRecord: 'Archived record',
      archivedClient: 'Archived client',
      paidPayment: 'Paid payment',
      pendingPayment: 'Pending payment',
    },
    table: {
      invoiceNumber: 'Invoice number',
      client: 'Client',
      case: 'Case',
      total: 'Total',
      status: 'Status',
      issueDate: 'Issue date',
      dueDate: 'Due date',
      actions: 'Actions',
    },
    statuses: {
      DRAFT: 'Draft',
      UNPAID: 'Unpaid',
      PAID: 'Paid',
      OVERDUE: 'Overdue',
      CANCELLED: 'Cancelled',
    } as Record<InvoiceStatus, string>,
    modal: {
      title: 'Create new invoice',
      subtitle: 'Add invoice details and financial items',
      client: 'Client',
      chooseClient: 'Choose client',
      case: 'Case',
      noCase: 'No case',
      archivedWarning: 'This invoice will be created for an archived client. Collection and editing are allowed, but deletion is blocked to protect the financial record.',
      dueDate: 'Due date',
      notes: 'Notes',
      notesPlaceholder: 'Example: first legal-fee installment',
      items: 'Invoice items',
      itemDescription: 'Item description',
      quantity: 'Quantity',
      unitPrice: 'Unit price',
      tax: 'Tax',
      discount: 'Discount',
      finalTotal: 'Final total',
    },
    messages: {
      chooseClient: 'Choose a client',
      archivedCreateBlocked: 'You can create an invoice for an archived client, but it cannot be deleted later to protect the financial record.',
      addOneItem: 'Add at least one item',
      createError: 'An error occurred while creating the invoice',
      archivedStatusBlocked: 'You can update the status of an archived-client invoice, but it cannot be deleted to protect the financial record.',
      paidNeedsCase: 'The invoice cannot be marked as paid because it is not linked to a case',
      paidLinkedPaymentConfirm: 'This invoice is paid and linked to a payment. The linked payment status will be updated according to the new status. Continue?',
      statusUpdateError: 'Could not update invoice status',
      archivedDeleteBlocked: 'Cannot delete an invoice linked to an archived client',
      linkedPaymentDeleteBlocked: 'Cannot delete an invoice linked to a payment. Change the invoice status or delete the linked payment first.',
      confirmDelete: 'Are you sure you want to delete this invoice?',
      deleteError: 'Could not delete invoice',
      noPhone: 'No phone number is saved for this client',
      deleteTitleArchived: 'Cannot delete an invoice linked to an archived client',
      deleteTitlePayment: 'Cannot delete an invoice linked to a payment',
      deleteTitle: 'Delete invoice',
      changeStatusAria: (invoiceNumber: string) => `Change invoice status ${invoiceNumber}`,
    },
  },
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
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.clients)) return data.clients
  if (Array.isArray(data?.cases)) return data.cases
  if (Array.isArray(data?.invoices)) return data.invoices
  if (Array.isArray(data?.data?.items)) return data.data.items
  if (Array.isArray(data?.data?.clients)) return data.data.clients
  if (Array.isArray(data?.data?.cases)) return data.data.cases
  if (Array.isArray(data?.data?.invoices)) return data.data.invoices

  return []
}

function getMessage(data: any, fallback: string) {
  return data?.message || data?.error || data?.data?.message || fallback
}

function isArchivedInvoice(invoice: Invoice) {
  return Boolean(invoice.client?.archivedAt || invoice.case?.client?.archivedAt)
}


function money(value: number, locale: Locale) {
  if (!Number.isFinite(value) || value === 0) {
    return locale === 'ar' ? '0 د.أ' : 'JOD 0.00'
  }

  if (locale === 'ar') return formatCurrency(value)

  return `JOD ${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function getBlockFallback(locale: Locale) {
  return locale === 'en'
    ? 'The subscription has ended. This page is available in read-only mode until renewal.'
    : 'انتهى الاشتراك. هذه الصفحة متاحة للقراءة فقط إلى حين التجديد.'
}

export default function InvoicesPage() {
  const router = useRouter()
  const localeState = useLocale() as { locale?: Locale }
  const locale = localeState?.locale === 'en' ? 'en' : 'ar'
  const isRtl = locale === 'ar'
  const writeAccess = useTenantWriteAccess(locale)
  const copy = COPY[locale]

  const fieldStyle = {
    textAlign: isRtl ? 'right' : 'left',
    direction: isRtl ? 'rtl' : 'ltr',
  } as CSSProperties

  const numberFieldStyle = {
    textAlign: 'left',
    direction: 'ltr',
  } as CSSProperties

  const statusOptions: Array<{ value: '' | InvoiceStatus; label: string }> = [
    { value: '', label: copy.filters.allStatuses },
    { value: 'DRAFT', label: copy.statuses.DRAFT },
    { value: 'UNPAID', label: copy.statuses.UNPAID },
    { value: 'PAID', label: copy.statuses.PAID },
    { value: 'OVERDUE', label: copy.statuses.OVERDUE },
    { value: 'CANCELLED', label: copy.statuses.CANCELLED },
  ]

  const formatMoney = (value: number) => money(value, locale)

  function confirmToast(message: string) {
    return new Promise<boolean>((resolve) => {
      let settled = false

      const toastId = toast(message, {
        duration: 10000,
        action: {
          label: locale === 'ar' ? 'تأكيد' : 'Confirm',
          onClick: () => {
            if (settled) return
            settled = true
            toast.dismiss(toastId)
            resolve(true)
          },
        },
        onDismiss: () => {
          if (settled) return
          settled = true
          resolve(false)
        },
        onAutoClose: () => {
          if (settled) return
          settled = true
          resolve(false)
        },
      })
    })
  }

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [cases, setCases] = useState<CaseOption[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'' | InvoiceStatus>('')
  const [archivedOnly, setArchivedOnly] = useState(false)

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

  const selectedClient = useMemo(() => {
    return clients.find((client) => client.id === clientId)
  }, [clients, clientId])

  const selectedCase = useMemo(() => {
    return cases.find((item) => item.id === caseId)
  }, [cases, caseId])

  const selectedClientArchived = Boolean(selectedClient?.archivedAt)
  const selectedCaseArchived = Boolean(selectedCase?.client?.archivedAt)
  const selectedArchivedContext = selectedClientArchived || selectedCaseArchived

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0)
    }, 0)
  }, [items])

  const total = Math.max(subtotal + Number(tax || 0) - Number(discount || 0), 0)

  const visibleInvoices = useMemo(() => {
    if (!archivedOnly) return invoices

    return invoices.filter(isArchivedInvoice)
  }, [invoices, archivedOnly])

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
    const archivedCount = invoices.filter(isArchivedInvoice).length

    return {
      totalAmount,
      paidAmount,
      unpaidAmount,
      overdueCount,
      paidCount,
      archivedCount,
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
        fetch('/api/clients?limit=100&includeArchivedClients=true', { cache: 'no-store' }),
        fetch('/api/cases?limit=100&includeArchivedClients=true', { cache: 'no-store' }),
      ])

      if (
        invoiceRes.status === 401 ||
        clientRes.status === 401 ||
        caseRes.status === 401
      ) {
        window.location.href = '/login'
        return
      }

      const invoiceData = invoiceRes.ok ? await invoiceRes.json().catch(() => ({})) : {}
      const clientData = clientRes.ok ? await clientRes.json().catch(() => ({})) : {}
      const caseData = caseRes.ok ? await caseRes.json().catch(() => ({})) : {}

      if (!invoiceRes.ok) console.error('Invoices request failed:', invoiceRes.status)
      if (!clientRes.ok) console.error('Clients request failed:', clientRes.status)
      if (!caseRes.ok) console.error('Cases request failed:', caseRes.status)

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

    if (!writeAccess.canWrite) {
      toast.error(writeAccess.message || getBlockFallback(locale))
      return
    }

    if (!clientId) {
      toast.error(copy.messages.chooseClient)
      return
    }

    const cleanItems = items.filter((item) => item.description.trim())

    if (cleanItems.length === 0) {
      toast.error(copy.messages.addOneItem)
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
        toast.error(getMessage(data, copy.messages.createError))
        return
      }

      toast.success(locale === 'ar' ? 'تم إنشاء الفاتورة' : 'Invoice created')
      setOpen(false)
      resetForm()
      await load()
    } catch {
      toast.error(copy.messages.createError)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(invoice: Invoice, nextStatus: InvoiceStatus) {
    if (invoice.status === nextStatus) return

    if (!writeAccess.canWrite) {
      toast.error(writeAccess.message || getBlockFallback(locale))
      return
    }

    if (nextStatus === 'PAID' && !invoice.case) {
      toast.error(copy.messages.paidNeedsCase)
      return
    }

    if (invoice.payment && invoice.status === 'PAID' && nextStatus !== 'PAID') {
      const confirmed = await confirmToast(copy.messages.paidLinkedPaymentConfirm)

      if (!confirmed) return
    }

    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast.error(getMessage(data, copy.messages.statusUpdateError))
      return
    }

    toast.success(locale === 'ar' ? 'تم تحديث حالة الفاتورة' : 'Invoice status updated')
    await load()
  }

  async function deleteInvoice(invoice: Invoice) {
    if (!writeAccess.canWrite) {
      toast.error(writeAccess.message || getBlockFallback(locale))
      return
    }

    const archivedInvoice = isArchivedInvoice(invoice)

    if (archivedInvoice) {
      toast.error(copy.messages.archivedDeleteBlocked)
      return
    }

    if (invoice.payment) {
      toast.error(copy.messages.linkedPaymentDeleteBlocked)
      return
    }

    const confirmed = await confirmToast(copy.messages.confirmDelete)
    if (!confirmed) return

    const response = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'DELETE',
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast.error(getMessage(data, copy.messages.deleteError))
      return
    }

    toast.success(locale === 'ar' ? 'تم حذف الفاتورة' : 'Invoice deleted')
    await load()
  }

  function printInvoice(invoice: Invoice) {
    printInvoiceDocument(invoice)
  }

  function sendInvoiceWhatsApp(invoice: Invoice) {
    const phone = normalizeWhatsAppPhone(invoice.client?.phone)

    if (!phone) {
      toast.error(copy.messages.noPhone)
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

  function clearFilters() {
    setQ('')
    setStatus('')
    setArchivedOnly(false)
    setTimeout(load, 0)
  }

  if (!mounted || loading) {
    return <AppLoader fullScreen={false} />
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-5 stagger">
      <SubscriptionReadOnlyBanner
        visible={!writeAccess.canWrite}
        message={writeAccess.message}
        isRtl={isRtl}
      />
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

        <div className="relative z-10 flex min-h-[126px] flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              {copy.hero.badge}
            </div>

            <h1 className="text-2xl font-black text-white">{copy.hero.title}</h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              {copy.hero.subtitle}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-center xl:self-auto">
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={!writeAccess.canWrite}
              title={!writeAccess.canWrite ? writeAccess.message || getBlockFallback(locale) : copy.actions.create}
              className="btn disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: '#fff',
                color: 'var(--sidebar)',
                borderColor: 'rgba(255,255,255,0.32)',
              }}
            >
              {copy.actions.create}
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
              {copy.actions.refresh}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          {
            label: copy.stats.totalInvoices,
            value: stats.totalCount,
            hint: copy.stats.allInvoices,
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: copy.stats.totalAmount,
            value: formatMoney(stats.totalAmount),
            hint: copy.stats.totalValue,
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: copy.stats.paid,
            value: formatMoney(stats.paidAmount),
            hint: copy.stats.invoice(stats.paidCount),
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: copy.stats.unpaid,
            value: formatMoney(stats.unpaidAmount),
            hint: copy.stats.unpaidHint,
            color: stats.unpaidAmount > 0 ? '#92400e' : 'var(--text-3)',
            bg: stats.unpaidAmount > 0 ? 'var(--amber-soft)' : 'var(--card)',
          },
          {
            label: copy.stats.overdue,
            value: stats.overdueCount,
            hint: copy.stats.overdueHint,
            color: stats.overdueCount > 0 ? '#dc2626' : 'var(--text)',
            bg: stats.overdueCount > 0 ? 'var(--red-soft)' : 'var(--card)',
          },
          {
            label: copy.stats.archivedClients,
            value: stats.archivedCount,
            hint: copy.stats.archivedHint,
            color: stats.archivedCount > 0 ? '#b45309' : 'var(--text)',
            bg: stats.archivedCount > 0 ? 'rgba(180, 83, 9, 0.14)' : 'var(--card)',
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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_.8fr_auto_auto_auto]">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={copy.filters.searchPlaceholder}
            dir={isRtl ? 'rtl' : 'ltr'}
            style={fieldStyle}
            className="input"
          />

          <select
            aria-label={copy.filters.statusAria}
            dir={isRtl ? 'rtl' : 'ltr'}
            style={fieldStyle}
            value={status}
            onChange={(event) => setStatus(event.target.value as '' | InvoiceStatus)}
            className="input"
          >
            {statusOptions.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button type="button" onClick={load} className="btn btn-primary whitespace-nowrap">
            {copy.actions.search}
          </button>

          <button
            type="button"
            onClick={() => setArchivedOnly((previous) => !previous)}
            className="btn whitespace-nowrap"
            style={
              archivedOnly
                ? {
                    background: '#b45309',
                    color: '#fff',
                    borderColor: 'rgba(180, 83, 9, 0.25)',
                  }
                : {
                    background: '#fff7ed',
                    color: '#b45309',
                    borderColor: 'rgba(180, 83, 9, 0.18)',
                  }
            }
          >
            {copy.filters.archivedClient}
          </button>

          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-ghost whitespace-nowrap"
          >
            {copy.actions.clear}
          </button>
        </div>
      </div>

      {/* Content */}
      {visibleInvoices.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="🧾"
            title={copy.empty.title}
            sub={
              invoices.length === 0
                ? copy.empty.first
                : copy.empty.filtered
            }
            action={
              invoices.length === 0 ? (
                <button
                  onClick={() => setOpen(true)}
                  disabled={!writeAccess.canWrite}
                  title={!writeAccess.canWrite ? writeAccess.message || getBlockFallback(locale) : copy.actions.create}
                  className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copy.actions.create}
                </button>
              ) : (
                <button onClick={clearFilters} className="btn btn-ghost">
                  {copy.actions.clearFilters}
                </button>
              )
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
                {copy.list.title}
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {copy.list.count(visibleInvoices.length)}
              </p>
            </div>

            {archivedOnly ? (
              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: '#fff7ed',
                  color: '#b45309',
                  border: '1px solid rgba(180, 83, 9, 0.18)',
                }}
              >
                {copy.list.archivedOnly}
              </span>
            ) : stats.overdueCount > 0 ? (
              <span className="badge badge-red">
                {copy.list.overdueCount(stats.overdueCount)}
              </span>
            ) : (
              <span className="badge badge-green">{copy.list.noOverdue}</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{copy.table.invoiceNumber}</th>
                  <th>{copy.table.client}</th>
                  <th>{copy.table.case}</th>
                  <th>{copy.table.total}</th>
                  <th>{copy.table.status}</th>
                  <th>{copy.table.issueDate}</th>
                  <th>{copy.table.dueDate}</th>
                  <th>{copy.table.actions}</th>
                </tr>
              </thead>

              <tbody>
                {visibleInvoices.map((invoice) => {
                  const archivedInvoice = isArchivedInvoice(invoice)

                  return (
                    <tr
                      key={invoice.id}
                      onClick={() => openInvoice(invoice)}
                      className="cursor-pointer"
                    >
                      <td>
                        <p className="font-black" style={{ color: 'var(--text)' }}>
                          {formatInvoiceNumber(invoice.invoiceNumber)}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {invoice.payment && (
                            <span
                              className="text-[11px] font-bold"
                              style={{
                                color:
                                  invoice.payment.status === 'PAID'
                                    ? 'var(--sidebar)'
                                    : '#92400e',
                              }}
                            >
                              {invoice.payment.status === 'PAID'
                                ? copy.list.paidPayment
                                : copy.list.pendingPayment}
                            </span>
                          )}

                          {archivedInvoice && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-black"
                              style={{
                                background: '#fff7ed',
                                color: '#b45309',
                                border: '1px solid rgba(180, 83, 9, 0.18)',
                              }}
                            >
                              {copy.list.archivedRecord}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="flex flex-col gap-1">
                          <p className="font-bold" style={{ color: 'var(--text)' }}>
                            {invoice.client?.name || '-'}
                          </p>

                          {invoice.client?.phone && (
                            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                              {invoice.client.phone}
                            </p>
                          )}

                          {archivedInvoice && (
                            <span
                              className="inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-black"
                              style={{
                                background: '#fff7ed',
                                color: '#b45309',
                                border: '1px solid rgba(180, 83, 9, 0.18)',
                              }}
                            >
                              {copy.list.archivedClient}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        {invoice.case ? (
                          <div>
                            <p className="font-bold" style={{ color: 'var(--text)' }}>
                              {invoice.case.title}
                            </p>

                            {invoice.case.caseNumber && (
                              <p
                                className="mt-1 font-mono text-xs"
                                style={{ color: 'var(--text-3)' }}
                              >
                                {invoice.case.caseNumber}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>-</span>
                        )}
                      </td>

                      <td className="font-black" style={{ color: 'var(--sidebar)' }}>
                        {formatMoney(invoice.total)}
                      </td>

                      <td>
                        <span className={statusClasses[invoice.status]}>
                          {copy.statuses[invoice.status]}
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
                            {copy.actions.view}
                          </button>

                          <select
                            aria-label={copy.messages.changeStatusAria(invoice.invoiceNumber)}
                            dir={isRtl ? 'rtl' : 'ltr'}
                            style={fieldStyle}
                            value={invoice.status}
                            disabled={!writeAccess.canWrite}
                            title={!writeAccess.canWrite ? writeAccess.message || getBlockFallback(locale) : copy.messages.changeStatusAria(invoice.invoiceNumber)}
                            onChange={(event) =>
                              updateStatus(invoice, event.target.value as InvoiceStatus)
                            }
                            className="input h-9 min-w-[130px] text-xs disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="DRAFT">{copy.statuses.DRAFT}</option>
                            <option value="UNPAID">{copy.statuses.UNPAID}</option>
                            <option value="PAID">{copy.statuses.PAID}</option>
                            <option value="OVERDUE">{copy.statuses.OVERDUE}</option>
                            <option value="CANCELLED">{copy.statuses.CANCELLED}</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => printInvoice(invoice)}
                            className="rounded-xl border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black/5"
                          >
                            {copy.actions.print}
                          </button>

                          <button
                            type="button"
                            onClick={() => sendInvoiceWhatsApp(invoice)}
                            className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
                          >
                            {copy.actions.whatsapp}
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteInvoice(invoice)}
                            disabled={!writeAccess.canWrite || !!invoice.payment || archivedInvoice}
                            title={
                              !writeAccess.canWrite
                                ? writeAccess.message || getBlockFallback(locale)
                                : archivedInvoice
                                ? copy.messages.deleteTitleArchived
                                : invoice.payment
                                  ? copy.messages.deleteTitlePayment
                                  : copy.messages.deleteTitle
                            }
                            className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {copy.actions.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
            dir={isRtl ? 'rtl' : 'ltr'}
            className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-6 text-start"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black" style={{ color: 'var(--text)' }}>
                  {copy.modal.title}
                </h2>

                <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
                  {copy.modal.subtitle}
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
                <span className="text-sm font-bold">{copy.modal.client}</span>

                <select
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value)
                    setCaseId('')
                  }}
                  className="input"
                  dir={isRtl ? 'rtl' : 'ltr'}
                  style={fieldStyle}
                  required
                >
                  <option value="">{copy.modal.chooseClient}</option>

                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">{copy.modal.case}</span>

                <select
                  value={caseId}
                  onChange={(event) => setCaseId(event.target.value)}
                  className="input"
                  dir={isRtl ? 'rtl' : 'ltr'}
                  style={fieldStyle}
                  disabled={!clientId}
                >
                  <option value="">{copy.modal.noCase}</option>

                  {filteredCases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.caseNumber ? ` - ${item.caseNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {selectedArchivedContext && (
                <div
                  className="md:col-span-2 rounded-2xl border p-3 text-xs font-bold"
                  style={{
                    background: '#fff7ed',
                    color: '#b45309',
                    borderColor: 'rgba(180, 83, 9, 0.22)',
                  }}
                >
                  {copy.modal.archivedWarning}
                </div>
              )}

              <label className="space-y-2">
                <span className="text-sm font-bold">{copy.modal.dueDate}</span>

                <input
                  type="date"
                  value={dueDate}
                  dir="ltr"
                  style={numberFieldStyle}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="input"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">{copy.modal.notes}</span>

                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={copy.modal.notesPlaceholder}
                  dir={isRtl ? 'rtl' : 'ltr'}
                  style={fieldStyle}
                  className="input"
                />
              </label>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black" style={{ color: 'var(--text)' }}>
                  {copy.modal.items}
                </h3>

                <button type="button" onClick={addItem} disabled={!writeAccess.canWrite} className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-60">
                  {copy.actions.addItem}
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
                      placeholder={copy.modal.itemDescription}
                      dir={isRtl ? 'rtl' : 'ltr'}
                      style={fieldStyle}
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
                      placeholder={copy.modal.quantity}
                      dir="ltr"
                      style={numberFieldStyle}
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
                      placeholder={copy.modal.unitPrice}
                      dir="ltr"
                      style={numberFieldStyle}
                      className="input"
                    />

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={!writeAccess.canWrite || items.length === 1}
                      className="rounded-xl px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {copy.actions.delete}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-bold">{copy.modal.tax}</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tax}
                  dir="ltr"
                  style={numberFieldStyle}
                  onChange={(event) => setTax(Number(event.target.value || 0))}
                  className="input"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold">{copy.modal.discount}</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  dir="ltr"
                  style={numberFieldStyle}
                  onChange={(event) => setDiscount(Number(event.target.value || 0))}
                  className="input"
                />
              </label>

              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: 'var(--border)' }}
              >
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                  {copy.modal.finalTotal}
                </p>

                <p className="mt-1 text-2xl font-black" style={{ color: 'var(--sidebar)' }}>
                  {formatMoney(total)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="btn btn-ghost">
                {copy.actions.clear}
              </button>

              <button
                type="submit"
                disabled={saving || !writeAccess.canWrite}
                title={!writeAccess.canWrite ? writeAccess.message || getBlockFallback(locale) : copy.actions.saveInvoice}
                className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? copy.actions.saving : copy.actions.saveInvoice}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}