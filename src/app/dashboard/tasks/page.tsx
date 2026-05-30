'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import EmptyState from '@/components/ui/EmptyState'
import PageLoader from '@/components/ui/PageLoader'
import { formatDate } from '@/lib/utils'

interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string
  priority: string
  completed: boolean
  client?: { name: string }
  case?: { title: string }
}

const PB: Record<string, string> = {
  HIGH: 'badge badge-red',
  MEDIUM: 'badge badge-amber',
  LOW: 'badge badge-gray',
}

const PA: Record<string, string> = {
  HIGH: 'عالية',
  MEDIUM: 'متوسطة',
  LOW: 'منخفضة',
}

const INIT = {
  title: '',
  description: '',
  dueDate: '',
  priority: 'MEDIUM',
  clientId: '',
  caseId: '',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setL] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(INIT)
  const [saving, setSv] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [clientFilter, setClientFilter] = useState('all')
  const [caseFilter, setCaseFilter] = useState('all')
  const load = useCallback(async () => {
  setL(true)

  const [tasksRes, clientsRes, casesRes] = await Promise.all([
    fetch('/api/tasks'),
    fetch('/api/clients?limit=100'),
    fetch('/api/cases?limit=100'),
  ])

  const tasksData = await tasksRes.json()
  const clientsData = await clientsRes.json()
  const casesData = await casesRes.json()

  setTasks(tasksData.data ?? [])
  setClients(clientsData.data?.data ?? [])
  setCases(casesData.data?.data ?? [])

  setL(false)
}, [])

  useEffect(() => {
    load()
  }, [load])

const filtered = tasks.filter((t) => {
  const matchesStatus =
    filter === 'all' ||
    (filter === 'pending' && !t.completed) ||
    (filter === 'done' && t.completed)

  const matchesSearch =
    !search ||
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())

  const matchesPriority =
    priorityFilter === 'all' || t.priority === priorityFilter


const matchesClient =
  clientFilter === 'all' || t.client?.name === clientFilter

const matchesCase =
  caseFilter === 'all' || t.case?.title === caseFilter
return (
  matchesStatus &&
  matchesSearch &&
  matchesPriority &&
  matchesClient &&
  matchesCase
)})

  const now = new Date()
  const total = tasks.length
  const done = tasks.filter((t) => t.completed).length
  const pend = total - done
  const overdue = tasks.filter(
    (t) => !t.completed && t.dueDate && new Date(t.dueDate) < now
  ).length

  async function toggle(id: string, completed: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })

    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, completed } : t)))
    toast.success(completed ? 'تم إنجاز المهمة' : 'تم إعادة المهمة')
  }

  async function del(id: string) {
    setDeleteId(id)
  }

  async function confirmDelete() {
    if (!deleteId) return

    try {
      setDeleteLoading(true)

      const r = await fetch(`/api/tasks/${deleteId}`, {
        method: 'DELETE',
      })

      const d = await r.json()

      if (!r.ok) {
        toast.error(d.message ?? 'فشل حذف المهمة')
        return
      }

      toast.success('تم حذف المهمة')
      setDeleteId(null)
      load()
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()

    if (!form.title.trim()) {
      toast.error('العنوان مطلوب')
      return
    }

    setSv(true)

    const r = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        clientId: form.clientId || undefined,
        caseId: form.caseId || undefined,
      }),
    })

    const d = await r.json()

    if (d.success) {
      toast.success('تمت إضافة المهمة')
      setOpen(false)
      setForm(INIT)
      load()
    } else {
      toast.error(d.message)
    }

    setSv(false)
  }

  const isOverdue = (t: Task) =>
    !t.completed && !!t.dueDate && new Date(t.dueDate) < now

  const isSoon = (t: Task) => {
    if (isOverdue(t) || !t.dueDate) return false
    return new Date(t.dueDate).getTime() - now.getTime() < 3 * 86400000
  }

  return (
    <div className="space-y-4 stagger">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: 'الكل', v: total, c: 'var(--text)' },
          { l: 'معلقة', v: pend, c: 'var(--sidebar)' },
          { l: 'منتهية', v: done, c: '#6b7280' },
          { l: 'متأخرة', v: overdue, c: '#dc2626' },
        ].map((s) => (
          <div key={s.l} className="card p-4 text-center hover:scale-[1.02] transition-all duration-200">
            <p
              className="text-xs font-bold mb-0.5"
              style={{ color: s.c + '99' }}
            >
              {s.l}
            </p>
            <p className="text-2xl font-black" style={{ color: s.c }}>
              {s.v}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(true)} className="btn btn-primary">
          + مهمة جديدة
        </button>

        <div className="flex flex-wrap gap-2">
  <input
    aria-label="البحث في المهام"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="ابحث عن مهمة..."
    className="input w-56"
  />

  <select
    aria-label="فلترة حسب الأولوية"
    value={priorityFilter}
    onChange={(e) => setPriorityFilter(e.target.value)}
    className="input w-40"
  >
    <option value="all">كل الأولويات</option>
    <option value="LOW">منخفضة</option>
    <option value="MEDIUM">متوسطة</option>
    <option value="HIGH">عالية</option>
    <option value="URGENT">عاجلة</option>
  </select>

  <select
  aria-label="فلترة حسب الموكل"
  value={clientFilter}
  onChange={(e) => setClientFilter(e.target.value)}
  className="input w-44"
>
  <option value="all">كل الموكلين</option>
  {clients.map((c) => (
    <option key={c.id} value={c.name}>
      {c.name}
    </option>
  ))}
</select>

<select
  aria-label="فلترة حسب القضية"
  value={caseFilter}
  onChange={(e) => setCaseFilter(e.target.value)}
  className="input w-44"
>
  <option value="all">كل القضايا</option>
  {cases.map((c) => (
    <option key={c.id} value={c.title}>
      {c.title}
    </option>
  ))}
</select>
</div>

        <div className="flex gap-1 mr-2">
          {(
            [
              ['all', 'الكل'],
              ['pending', 'معلقة'],
              ['done', 'منتهية'],
            ] as ['all' | 'pending' | 'done', string][]
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={
                filter === k
                  ? { background: 'var(--sidebar)', color: '#fff' }
                  : { color: 'var(--text-2)' }
              }
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="✅"
          title="لا توجد مهام"
          sub="أضف أول مهمة الآن"
          action={
            <button onClick={() => setOpen(true)} className="btn btn-primary">
              + إضافة
            </button>
          }
        />
      ) : (
<div className="space-y-3">
  {filtered.map((t) => (
    <div
      key={t.id}
      className={`card group p-4 flex items-start gap-3 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-lg ${
        t.completed ? 'opacity-60' : ''
      }`}
    >
      <button
        aria-label="تغيير حالة المهمة"
        onClick={() => toggle(t.id, !t.completed)}
        className="mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all text-xs font-bold"
        style={{
          borderColor: 'var(--sidebar)',
          background: t.completed ? 'var(--sidebar)' : 'transparent',
          color: t.completed ? '#fff' : 'transparent',
        }}
      >
        ✓
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`font-bold text-sm leading-6 ${
                t.completed ? 'line-through' : ''
              }`}
              style={{ color: 'var(--text)' }}
            >
              {t.title}
            </p>

            {t.description && (
              <p
                className="mt-1 text-xs line-clamp-2"
                style={{ color: 'var(--text-3)' }}
              >
                {t.description}
              </p>
            )}
          </div>

          <span className={`${PB[t.priority]} shrink-0`}>
            {PA[t.priority]}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {t.dueDate && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                isOverdue(t)
                  ? 'bg-red-50 text-red-600'
                  : isSoon(t)
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-50 text-slate-500'
              }`}
            >
              📅{' '}
              {formatDate(t.dueDate, {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          )}

          {t.client && (
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
              👤 {t.client.name}
            </span>
          )}

          {t.case && (
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
              ⚖️ {t.case.title}
            </span>
          )}

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              t.completed
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-blue-50 text-blue-600'
            }`}
          >
            {t.completed ? 'منتهية' : 'معلقة'}
          </span>
        </div>
      </div>

      <button
        aria-label="حذف المهمة"
        onClick={() => del(t.id)}
        className="opacity-60 group-hover:opacity-100 text-red-400 hover:text-red-600 text-sm shrink-0 transition-all"
      >
        🗑
      </button>
    </div>
  ))}
</div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          setForm(INIT)
        }}
        title="إضافة مهمة جديدة"
        size="sm"
      >
        <form onSubmit={handleAdd} className="space-y-3">
          <FormField label="عنوان المهمة" required>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
              className="input"
              autoFocus
            />
          </FormField>

          <FormField label="الوصف">
            <textarea
            aria-label="الوصف"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              className="input"
              rows={2}
              style={{ resize: 'none' }}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="الأولوية">
              <select
              aria-label="الأولوية"
                value={form.priority}
                onChange={(e) =>
                  setForm((p) => ({ ...p, priority: e.target.value }))
                }
                className="input"
              >
                {Object.entries(PA).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="الموعد النهائي">
              <input
              aria-label="الموعد النهائي"
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dueDate: e.target.value }))
                }
                className="input"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
  <FormField label="الموكل">
    <select
    aria-label="الموكل"
      value={form.clientId}
      onChange={(e) =>
        setForm((p) => ({ ...p, clientId: e.target.value }))
      }
      className="input"
    >
      <option value="">بدون موكل</option>

      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  </FormField>

  <FormField label="القضية">
    <select
    aria-label="القضية"
      value={form.caseId}
      onChange={(e) =>
        setForm((p) => ({ ...p, caseId: e.target.value }))
      }
      className="input"
    >
      <option value="">بدون قضية</option>

      {cases.map((c) => (
        <option key={c.id} value={c.id}>
          {c.title}
        </option>
      ))}
    </select>
  </FormField>
</div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-ghost flex-1"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? <span className="spinner spinner-sm" /> : 'حفظ'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="تأكيد حذف المهمة"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            هل أنت متأكد من حذف هذه المهمة؟
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              className="btn btn-ghost flex-1"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteLoading}
              className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {deleteLoading ? 'جاري الحذف...' : 'حذف'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}