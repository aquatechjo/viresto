'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/ui/EmptyState'
import { fileSizeLabel, relativeTime } from '@/lib/utils'
import DocumentPreviewModal from '@/components/documents/DocumentPreviewModal'
import { getApiMessage, isPlanLimitResponse, planLimitMessage } from '@/lib/plan-ui'

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

type Filter = 'all' | 'pdf' | 'image' | 'doc'

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

function getIcon(t: string) {
  return FILE_ICON[t] ?? { label: 'FILE', color: '#6b7280' }
}

function PlanLimitBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">وصلت إلى حد الخطة الحالية</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/billing" className="btn btn-primary">عرض الاشتراك</Link>
          <button type="button" onClick={onClose} className="btn">إغلاق</button>
        </div>
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [dragging, setDrag] = useState(false)
  const [uploading, setUpl] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const [cases, setCases] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [caseId, setCaseId] = useState('')
  const [clientId, setClientId] = useState('')
  const [preview, setPreview] = useState<null | Doc>(null)
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [uploadTag, setUploadTag] = useState('')
  const [planLimit, setPlanLimit] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/documents')
    const d = await r.json().catch(() => ({}))
    setDocs(d.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch('/api/cases')
      .then((r) => r.json())
      .then((d) => setCases(d.data?.data ?? []))

    fetch('/api/clients')
      .then((r) => r.json())
      .then((d) => setClients(d.data?.data ?? []))
  }, [load])

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id))
        toast.success('تم حذف الملف')
      } else {
        toast.error(getApiMessage(data, 'فشل حذف الملف'))
      }
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء الحذف')
    }
  }

  const availableTags = ['عقد', 'قضية', 'هوية', 'حكم', 'إثبات', 'لائحة', 'مالية']

  const filtered = docs.filter((d) => {
    const q = search.trim().toLowerCase()

    const matchesSearch =
      !q ||
      d.fileName.toLowerCase().includes(q) ||
      d.client?.name?.toLowerCase().includes(q) ||
      d.case?.title?.toLowerCase().includes(q)

    const matchesTags =
      selectedTags.length === 0 || selectedTags.some((tag) => d.tags?.includes(tag))

    const matchesFilter =
      filter === 'all' ||
      (filter === 'pdf' && d.fileType === 'application/pdf') ||
      (filter === 'image' && d.fileType.startsWith('image/')) ||
      (filter === 'doc' && d.fileType.includes('word'))

    return matchesSearch && matchesFilter && matchesTags
  })

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      return toast.error('حجم الملف يتجاوز 10 ميجابايت')
    }

    setUpl(true)
    setPlanLimit('')

    try {
      const fd = new FormData()
      fd.append('file', file)
      if (caseId) fd.append('caseId', caseId)
      if (clientId) fd.append('clientId', clientId)
      fd.append('tags', JSON.stringify(uploadTag ? [uploadTag] : []))

      const r = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      })

      const d = await r.json().catch(() => ({}))

      if (!r.ok || !d.success) {
        if (isPlanLimitResponse(d)) {
          setPlanLimit(planLimitMessage(d, 'وصلت إلى حد المستندات أو مساحة التخزين في خطتك الحالية.'))
          return
        }

        return toast.error(getApiMessage(d, 'فشل رفع الملف'))
      }

      toast.success('تم رفع الملف')
      load()
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setUpl(false)
    }
  }

  const handleSummarize = async (id: string) => {
    try {
      setPlanLimit('')
      const toastId = toast.loading('جاري تلخيص المستند...')

      const res = await fetch(`/api/documents/${id}/summarize`, {
        method: 'POST',
      })

      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      toast.dismiss(toastId)

      if (!res.ok || !data?.success) {
        if (isPlanLimitResponse(data)) {
          setPlanLimit(planLimitMessage(data, 'ميزة تلخيص المستندات بالذكاء الاصطناعي غير متاحة في خطتك الحالية.'))
          return
        }

        toast.error(getApiMessage(data, 'تعذر تلخيص المستند'))
        return
      }

      toast.success('تم تلخيص المستند بنجاح')
      load()
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء التلخيص')
    }
  }

  return (
    <div className="space-y-4 stagger">
      {planLimit && <PlanLimitBanner message={planLimit} onClose={() => setPlanLimit('')} />}

      <div className="grid md:grid-cols-2 gap-3">
        <select
          aria-label="اختيار قضية"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="input"
        >
          <option value="">اختر قضية (اختياري)</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <select
          aria-label="اختيار موكل"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="input"
        >
          <option value="">اختر موكل (اختياري)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="card p-4">
        <p className="mb-3 text-sm font-bold" style={{ color: 'var(--text)' }}>
          تصنيف المستند
        </p>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const active = uploadTag === tag
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setUploadTag(active ? '' : tag)}
                className="rounded-full px-4 py-2 text-xs font-bold transition-all"
                style={
                  active
                    ? { background: 'var(--sidebar)', color: '#fff' }
                    : {
                        background: 'var(--card)',
                        color: 'var(--text-2)',
                        border: '1px solid var(--border)',
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
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          const f = e.dataTransfer.files[0]
          if (f) upload(f)
        }}
        onClick={() => ref.current?.click()}
        className="card p-10 flex flex-col items-center justify-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? 'var(--sidebar)' : 'var(--border-dark)'}`,
          background: dragging ? 'var(--green-soft)' : 'var(--card)',
        }}
      >
        <input
          aria-label="رفع ملف"
          ref={ref}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />

        {uploading ? (
          <div className="flex items-center gap-2">
            <span className="spinner" />
            <span style={{ color: 'var(--text-2)' }}>جاري الرفع...</span>
          </div>
        ) : (
          <>
            <span className="text-4xl mb-3">{dragging ? '📂' : '📁'}</span>
            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              اسحب الملفات هنا أو اضغط للاختيار
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              PDF, Word, صور — بحد أقصى 10MB
            </p>
          </>
        )}
      </div>

      <div className="card p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الملف، الموكل، أو القضية..."
          className="input w-full text-right"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {[
          ['all', 'الكل'],
          ['pdf', 'PDFs'],
          ['image', 'صور'],
          ['doc', 'عقود'],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k as Filter)}
            className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
            style={
              filter === k
                ? { background: 'var(--sidebar)', color: '#fff' }
                : {
                    background: 'var(--card)',
                    color: 'var(--text-2)',
                    border: '1px solid var(--border)',
                  }
            }
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📄" title="لا توجد مستندات" sub="ارفع أول مستنداتك" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((doc) => {
            const ic = getIcon(doc.fileType)
            return (
              <div key={doc.id} className="card p-5 flex flex-col items-center hover:shadow-lg transition-all">
                {!!doc.tags?.length && (
                  <span
                    className="mb-3 rounded-full px-3 py-1 text-[11px] font-bold"
                    style={{
                      background: 'var(--green-soft)',
                      color: 'var(--sidebar)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {doc.tags[0]}
                  </span>
                )}
                <div className="w-12 h-14 rounded-xl flex items-center justify-center font-black text-xs text-white mb-3" style={{ background: ic.color }}>
                  {ic.label}
                </div>

                <p className="text-xs font-bold text-center truncate w-full" style={{ color: 'var(--text)' }}>
                  {doc.fileName}
                </p>

                {doc.case?.title && <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>القضية: {doc.case.title}</p>}
                {doc.client?.name && <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>الموكل: {doc.client.name}</p>}

                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                  {fileSizeLabel(doc.fileSize)} · {relativeTime(doc.createdAt)}
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const r = await fetch(`/api/documents/${doc.id}`)
                        const d = await r.json().catch(() => ({}))

                        if (!r.ok) {
                          toast.error(getApiMessage(d, 'فشل فتح المستند'))
                          return
                        }

                        setPreview({ ...doc, fileUrl: d.data.url })
                      } catch {
                        toast.error('حدث خطأ أثناء فتح المستند')
                      }
                    }}
                    className="rounded-xl bg-green-700 px-3 py-2 text-xs text-white"
                  >
                    معاينة
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(doc.id)
                    }}
                    className="rounded-xl bg-red-500 px-3 py-2 text-xs text-white"
                  >
                    حذف
                  </button>

                  <button
                    onClick={() => handleSummarize(doc.id)}
                    className="rounded-xl bg-purple-600 px-3 py-2 text-xs text-white"
                  >
                    تلخيص AI
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DocumentPreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        fileUrl={preview?.fileUrl || ''}
        fileType={preview?.fileType || ''}
        fileName={preview?.fileName || ''}
        aiSummary={preview?.aiSummary}
        aiKeyPoints={preview?.aiKeyPoints}
        aiParties={preview?.aiParties}
        aiDates={preview?.aiDates}
        aiAmounts={preview?.aiAmounts}
      />
    </div>
  )
}
