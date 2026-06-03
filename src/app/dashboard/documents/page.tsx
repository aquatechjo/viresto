'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/ui/EmptyState'
import PageLoader from '@/components/ui/PageLoader'
import DocumentPreviewModal from '@/components/documents/DocumentPreviewModal'
import { fileSizeLabel, relativeTime } from '@/lib/utils'
import {
  getApiMessage,
  isPlanLimitResponse,
  planLimitMessage,
} from '@/lib/plan-ui'

interface Doc {
  id: string
  fileName: string
  fileType: string
  fileUrl: string
  fileSize?: number
  createdAt: string
  client?: { name: string }
  case?: { title: string }
  aiSummary?: string | null
  aiKeyPoints?: string[] | null
  aiParties?: string[] | null
  aiDates?: string[] | null
  aiAmounts?: string[] | null
  aiAnalyzedAt?: string | null
  tags?: string[]
}

interface ClientItem {
  id: string
  name: string
}

interface CaseItem {
  id: string
  title: string
}

type Filter = 'all' | 'pdf' | 'image' | 'doc'
type UploadStatus = 'idle' | 'uploading'

const FILE_ICON: Record<string, { label: string; color: string }> = {
  'application/pdf': { label: 'PDF', color: '#ef4444' },
  'image/jpeg': { label: 'JPG', color: '#ec4899' },
  'image/png': { label: 'PNG', color: '#8b5cf6' },
  'image/webp': { label: 'IMG', color: '#8b5cf6' },
  'application/msword': { label: 'DOC', color: '#2563eb' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    label: 'DOCX',
    color: '#2563eb',
  },
}

const FILTERS: [Filter, string][] = [
  ['all', 'الكل'],
  ['pdf', 'PDF'],
  ['image', 'صور'],
  ['doc', 'Word'],
]

const AVAILABLE_TAGS = ['عقد', 'قضية', 'هوية', 'حكم', 'إثبات', 'لائحة', 'مالية']

function getIcon(type: string) {
  return FILE_ICON[type] ?? { label: 'FILE', color: '#6b7280' }
}

function isImage(type: string) {
  return type.startsWith('image/')
}

function isWord(type: string) {
  return type.includes('word')
}

function PlanLimitBanner({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">وصلت إلى حد الخطة الحالية</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/billing" className="btn btn-primary">
            عرض الاشتراك
          </Link>

          <button type="button" onClick={onClose} className="btn">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [cases, setCases] = useState<CaseItem[]>([])
  const [clients, setClients] = useState<ClientItem[]>([])

  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [caseId, setCaseId] = useState('')
  const [clientId, setClientId] = useState('')
  const [uploadTag, setUploadTag] = useState('')

  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [planLimit, setPlanLimit] = useState('')
  const [preview, setPreview] = useState<Doc | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const [documentsRes, casesRes, clientsRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/cases?limit=100'),
        fetch('/api/clients?limit=100'),
      ])

      const safeJson = async (response: Response) => {
        if (!response.ok) return { data: [] }

        try {
          return await response.json()
        } catch {
          return { data: [] }
        }
      }

      const [documentsData, casesData, clientsData] = await Promise.all([
        safeJson(documentsRes),
        safeJson(casesRes),
        safeJson(clientsRes),
      ])

      setDocs(Array.isArray(documentsData.data) ? documentsData.data : [])
      setCases(
        Array.isArray(casesData.data?.data)
          ? casesData.data.data
          : Array.isArray(casesData.data)
            ? casesData.data
            : []
      )
      setClients(
        Array.isArray(clientsData.data?.data)
          ? clientsData.data.data
          : Array.isArray(clientsData.data)
            ? clientsData.data
            : []
      )
    } catch {
      toast.error('فشل تحميل المستندات')
      setDocs([])
      setCases([])
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalDocs = docs.length
  const pdfCount = docs.filter((doc) => doc.fileType === 'application/pdf').length
  const imageCount = docs.filter((doc) => isImage(doc.fileType)).length
  const wordCount = docs.filter((doc) => isWord(doc.fileType)).length

  const totalSize = useMemo(
    () => docs.reduce((sum, doc) => sum + (doc.fileSize ?? 0), 0),
    [docs]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return docs.filter((doc) => {
      const matchesSearch =
        !q ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.client?.name?.toLowerCase().includes(q) ||
        doc.case?.title?.toLowerCase().includes(q)

      const matchesTag = !selectedTag || doc.tags?.includes(selectedTag)

      const matchesFilter =
        filter === 'all' ||
        (filter === 'pdf' && doc.fileType === 'application/pdf') ||
        (filter === 'image' && isImage(doc.fileType)) ||
        (filter === 'doc' && isWord(doc.fileType))

      return matchesSearch && matchesFilter && matchesTag
    })
  }, [docs, filter, search, selectedTag])

  function clearFilters() {
    setSearch('')
    setFilter('all')
    setSelectedTag('')
  }

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الملف يتجاوز 10 ميجابايت')
      return
    }

    try {
      setUploadStatus('uploading')
      setPlanLimit('')

      const formData = new FormData()
      formData.append('file', file)

      if (caseId) formData.append('caseId', caseId)
      if (clientId) formData.append('clientId', clientId)
      formData.append('tags', JSON.stringify(uploadTag ? [uploadTag] : []))

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        if (isPlanLimitResponse(data)) {
          setPlanLimit(
            planLimitMessage(
              data,
              'وصلت إلى حد المستندات أو مساحة التخزين في خطتك الحالية.'
            )
          )
          return
        }

        toast.error(getApiMessage(data, 'فشل رفع الملف'))
        return
      }

      toast.success('تم رفع الملف')
      load()
    } catch {
      toast.error('حدث خطأ أثناء رفع الملف')
    } finally {
      setUploadStatus('idle')
    }
  }

  async function openPreview(doc: Doc) {
    try {
      const response = await fetch(`/api/documents/${doc.id}`)
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(getApiMessage(data, 'فشل فتح المستند'))
        return
      }

      setPreview({ ...doc, fileUrl: data.data?.url ?? doc.fileUrl })
    } catch {
      toast.error('حدث خطأ أثناء فتح المستند')
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا المستند؟')
    if (!confirmed) return

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(getApiMessage(data, 'فشل حذف الملف'))
        return
      }

      setDocs((previous) => previous.filter((doc) => doc.id !== id))
      toast.success('تم حذف الملف')
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    }
  }

  async function handleSummarize(id: string) {
    try {
      setPlanLimit('')
      const toastId = toast.loading('جاري تلخيص المستند...')

      const response = await fetch(`/api/documents/${id}/summarize`, {
        method: 'POST',
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      toast.dismiss(toastId)

      if (!response.ok || !data?.success) {
        if (isPlanLimitResponse(data)) {
          setPlanLimit(
            planLimitMessage(
              data,
              'ميزة تلخيص المستندات بالذكاء الاصطناعي غير متاحة في خطتك الحالية.'
            )
          )
          return
        }

        toast.error(getApiMessage(data, 'تعذر تلخيص المستند'))
        return
      }

      toast.success('تم تلخيص المستند بنجاح')
      load()
    } catch {
      toast.error('حدث خطأ أثناء التلخيص')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 stagger">
      {planLimit && (
        <PlanLimitBanner
          message={planLimit}
          onClose={() => setPlanLimit('')}
        />
      )}

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

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              إدارة الأرشيف القانوني
            </div>

            <h1 className="text-2xl font-black text-white">المستندات</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              نظّم ملفات المكتب، واربط كل مستند بالموكل أو القضية، مع إمكانية المعاينة
              والتصنيف والتلخيص الذكي من مكان واحد.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn shrink-0"
            style={{
              background: '#fff',
              color: 'var(--sidebar)',
              borderColor: 'rgba(255,255,255,0.32)',
            }}
          >
            + رفع مستند
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'كل المستندات',
            value: totalDocs,
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: 'ملفات PDF',
            value: pdfCount,
            color: '#dc2626',
            bg: 'var(--red-soft)',
          },
          {
            label: 'الصور',
            value: imageCount,
            color: '#7c3aed',
            bg: 'var(--card)',
          },
          {
            label: 'ملفات Word',
            value: wordCount,
            color: '#2563eb',
            bg: 'var(--green-soft)',
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

            <p className="mt-2 text-3xl font-black" style={{ color: item.color }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
            {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_.8fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم الملف، الموكل، أو القضية..."
            className="input"
          />

          <select
            aria-label="فلترة حسب التصنيف"
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            className="input"
          >
            <option value="">جميع التصنيفات</option>

            {AVAILABLE_TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-ghost whitespace-nowrap"
          >
            تصفية
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={
                filter === key
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

          {(search || filter !== 'all' || selectedTag) && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={{
                background: 'var(--card)',
                color: 'var(--text-2)',
                border: '1px solid var(--border)',
              }}
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>


      {/* Upload Area */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)

            const file = event.dataTransfer.files[0]
            if (file) upload(file)
          }}
          onClick={() => fileInputRef.current?.click()}
          className="card flex min-h-[160px] cursor-pointer flex-col items-center justify-center p-6 text-center transition-all"
          style={{
            border: `2px dashed ${dragging ? 'var(--sidebar)' : 'var(--border-dark)'}`,
            background: dragging ? 'var(--green-soft)' : 'var(--card)',
          }}
        >
          <input
            aria-label="رفع ملف"
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) upload(file)
              event.currentTarget.value = ''
            }}
          />

          {uploadStatus === 'uploading' ? (
            <div className="flex items-center gap-2">
              <span className="spinner" />
              <span style={{ color: 'var(--text-2)' }}>جاري رفع الملف...</span>
            </div>
          ) : (
            <>
              <span className="text-4xl">{dragging ? '📂' : '📁'}</span>

              <p className="mt-4 text-base font-black" style={{ color: 'var(--text)' }}>
                اسحب الملف هنا أو اضغط للاختيار
              </p>

              <p className="mt-2 text-sm" style={{ color: 'var(--text-3)' }}>
                PDF, Word, صور — بحد أقصى 10MB
              </p>
            </>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4">
            <h3 className="font-black" style={{ color: 'var(--text)' }}>
              بيانات الربط والتصنيف
            </h3>

            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
              اختيارية، لكنها تساعد في تنظيم الأرشيف والبحث لاحقًا.
            </p>
          </div>

          <div className="space-y-3">
            <select
              aria-label="اختيار قضية"
              value={caseId}
              onChange={(event) => setCaseId(event.target.value)}
              className="input"
            >
              <option value="">بدون قضية</option>

              {cases.map((caseItem) => (
                <option key={caseItem.id} value={caseItem.id}>
                  {caseItem.title}
                </option>
              ))}
            </select>

            <select
              aria-label="اختيار موكل"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="input"
            >
              <option value="">بدون موكل</option>

              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            <div>
              <p className="mb-2 text-xs font-black" style={{ color: 'var(--text-3)' }}>
                تصنيف المستند
              </p>

              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map((tag) => {
                  const active = uploadTag === tag

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setUploadTag(active ? '' : tag)
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-bold transition-all"
                      style={
                        active
                          ? { background: 'var(--sidebar)', color: '#fff' }
                          : {
                              background: 'var(--green-soft)',
                              color: 'var(--text-2)',
                            }
                      }
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            <div
              className="rounded-2xl border p-3 text-xs font-bold"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-3)',
              }}
            >
              إجمالي حجم الملفات: {fileSizeLabel(totalSize)}
            </div>
          </div>
        </div>
      </div>
      {/* Content */}
      {filtered.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="📄"
            title="لا توجد مستندات"
            sub={
              docs.length === 0
                ? 'ارفع أول مستند لبدء تنظيم أرشيف المكتب.'
                : 'لا توجد مستندات مطابقة للفلاتر الحالية.'
            }
            action={
              docs.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-primary"
                >
                  + رفع مستند
                </button>
              ) : (
                <button type="button" onClick={clearFilters} className="btn btn-ghost">
                  مسح الفلاتر
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => {
            const icon = getIcon(doc.fileType)

            return (
              <div
                key={doc.id}
                className="card group flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white"
                      style={{ background: icon.color }}
                    >
                      {icon.label}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-black" style={{ color: 'var(--text)' }}>
                        {doc.fileName}
                      </p>

                      <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                        {fileSizeLabel(doc.fileSize)} · {relativeTime(doc.createdAt)}
                      </p>
                    </div>
                  </div>

                  {!!doc.tags?.length && (
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black"
                      style={{
                        background: 'var(--green-soft)',
                        color: 'var(--sidebar)',
                      }}
                    >
                      {doc.tags[0]}
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {doc.client?.name && (
                    <p className="truncate text-xs font-bold" style={{ color: 'var(--text-2)' }}>
                      👤 الموكل: {doc.client.name}
                    </p>
                  )}

                  {doc.case?.title && (
                    <p className="truncate text-xs font-bold" style={{ color: 'var(--text-2)' }}>
                      ⚖️ القضية: {doc.case.title}
                    </p>
                  )}

                  {doc.aiAnalyzedAt && (
                    <p className="text-xs font-bold" style={{ color: 'var(--sidebar)' }}>
                      ✨ تم تحليله بالذكاء الاصطناعي
                    </p>
                  )}
                </div>

                <div
                  className="mt-5 flex flex-wrap gap-2 border-t pt-4"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <button
                    type="button"
                    onClick={() => openPreview(doc)}
                    className="btn btn-ghost flex-1"
                    style={{ minWidth: 90 }}
                  >
                    معاينة
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSummarize(doc.id)}
                    className="btn flex-1"
                    style={{
                      minWidth: 90,
                      background: '#7c3aed',
                      color: '#fff',
                    }}
                  >
                    تلخيص AI
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    className="btn flex-1"
                    style={{
                      minWidth: 90,
                      background: '#dc2626',
                      color: '#fff',
                    }}
                  >
                    حذف
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <DocumentPreviewModal
          open={!!preview}
          onClose={() => setPreview(null)}
          documentId={preview.id}
          fileUrl={`/api/documents/${preview.id}/preview`}
          fileType={preview.fileType}
          fileName={preview.fileName}
          aiSummary={preview.aiSummary}
          aiKeyPoints={preview.aiKeyPoints}
          aiParties={preview.aiParties}
          aiDates={preview.aiDates}
          aiAmounts={preview.aiAmounts}
        />
      )}
    </div>
  )
}