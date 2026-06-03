'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

interface ClientItem {
  id: string
  name: string
}

interface CaseItem {
  id: string
  title: string
}

const PB: Record<string, string> = {
  URGENT: 'badge badge-red',
  HIGH: 'badge badge-red',
  MEDIUM: 'badge badge-amber',
  LOW: 'badge badge-gray',
}

const PA: Record<string, string> = {
  URGENT: 'عاجلة',
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
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(INIT)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<ClientItem[]>([])
  const [cases, setCases] = useState<CaseItem[]>([])
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [caseFilter, setCaseFilter] = useState('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const now = useMemo(() => new Date(), [])

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const [tasksRes, clientsRes, casesRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/clients?limit=100'),
        fetch('/api/cases?limit=100'),
      ])

      const [tasksData, clientsData, casesData] = await Promise.all([
        tasksRes.json(),
        clientsRes.json(),
        casesRes.json(),
      ])

      setTasks(Array.isArray(tasksData.data) ? tasksData.data : [])
      setClients(Array.isArray(clientsData.data?.data) ? clientsData.data.data : [])
      setCases(Array.isArray(casesData.data?.data) ? casesData.data.data : [])
    } catch {
      toast.error('فشل تحميل المهام')
      setTasks([])
      setClients([])
      setCases([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isOverdue = useCallback(
    (task: Task) => !task.completed && !!task.dueDate && new Date(task.dueDate) < now,
    [now]
  )

  const isSoon = useCallback(
    (task: Task) => {
      if (isOverdue(task) || !task.dueDate) return false
      return new Date(task.dueDate).getTime() - now.getTime() < 3 * 86400000
    },
    [isOverdue, now]
  )

  const total = tasks.length
  const done = tasks.filter((task) => task.completed).length
  const pending = total - done
  const overdue = tasks.filter((task) => isOverdue(task)).length

  const filtered = tasks.filter((task) => {
    const query = search.trim().toLowerCase()

    const matchesStatus =
      filter === 'all' ||
      (filter === 'pending' && !task.completed) ||
      (filter === 'done' && task.completed)

    const matchesSearch =
      !query ||
      task.title?.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.client?.name?.toLowerCase().includes(query) ||
      task.case?.title?.toLowerCase().includes(query)

    const matchesPriority =
      priorityFilter === 'all' || task.priority === priorityFilter

    const matchesClient =
      clientFilter === 'all' || task.client?.name === clientFilter

    const matchesCase =
      caseFilter === 'all' || task.case?.title === caseFilter

    return (
      matchesStatus &&
      matchesSearch &&
      matchesPriority &&
      matchesClient &&
      matchesCase
    )
  })

  async function toggle(id: string, completed: boolean) {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })

      if (!response.ok) {
        toast.error('فشل تحديث المهمة')
        return
      }

      setTasks((current) =>
        current.map((task) => (task.id === id ? { ...task, completed } : task))
      )

      toast.success(completed ? 'تم إنجاز المهمة' : 'تم إعادة المهمة')
    } catch {
      toast.error('حدث خطأ أثناء تحديث المهمة')
    }
  }

  function del(id: string) {
    setDeleteId(id)
  }

  async function confirmDelete() {
    if (!deleteId) return

    try {
      setDeleteLoading(true)

      const response = await fetch(`/api/tasks/${deleteId}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(data.message ?? 'فشل حذف المهمة')
        return
      }

      toast.success('تم حذف المهمة')
      setDeleteId(null)
      load()
    } catch {
      toast.error('حدث خطأ أثناء حذف المهمة')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()

    if (!form.title.trim()) {
      toast.error('العنوان مطلوب')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clientId: form.clientId || undefined,
          caseId: form.caseId || undefined,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        toast.error(data.message ?? 'فشل إضافة المهمة')
        return
      }

      toast.success('تمت إضافة المهمة')
      setOpen(false)
      setForm(INIT)
      load()
    } catch {
      toast.error('حدث خطأ أثناء إضافة المهمة')
    } finally {
      setSaving(false)
    }
  }

  function clearFilters() {
    setSearch('')
    setPriorityFilter('all')
    setClientFilter('all')
    setCaseFilter('all')
    setFilter('all')
  }

  return (
    <div className="space-y-5 stagger">
      {/* Header */}
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
              إدارة العمل اليومي
            </div>

            <h1 className="text-2xl font-black text-white">المهام</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              تابع المهام المرتبطة بالقضايا والموكلين، وحدد الأولويات والمواعيد النهائية
              لضمان عدم تفويت أي إجراء مهم.
            </p>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="btn shrink-0"
            style={{
              background: '#fff',
              color: 'var(--sidebar)',
              borderColor: 'rgba(255,255,255,0.32)',
            }}
          >
            + مهمة جديدة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'كل المهام', value: total, color: 'var(--text)', bg: 'var(--card)' },
          { label: 'معلقة', value: pending, color: 'var(--sidebar)', bg: 'var(--green-soft)' },
          { label: 'منتهية', value: done, color: '#6b7280', bg: 'var(--card)' },
          { label: 'متأخرة', value: overdue, color: '#dc2626', bg: 'var(--red-soft)' },
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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_.8fr_.8fr_.8fr_auto]">
          <input
            aria-label="البحث في المهام"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث في العنوان، الوصف، الموكل أو القضية..."
            className="input"
          />

          <select
            aria-label="فلترة حسب الأولوية"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="input"
          >
            <option value="all">جميع الأولويات</option>
            <option value="URGENT">عاجلة</option>
            <option value="HIGH">عالية</option>
            <option value="MEDIUM">متوسطة</option>
            <option value="LOW">منخفضة</option>
          </select>

          <select
            aria-label="فلترة حسب الموكل"
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            className="input"
          >
            <option value="all">جميع الموكلين</option>
            {clients.map((client) => (
              <option key={client.id} value={client.name}>
                {client.name}
              </option>
            ))}
          </select>

          <select
            aria-label="فلترة حسب القضية"
            value={caseFilter}
            onChange={(event) => setCaseFilter(event.target.value)}
            className="input"
          >
            <option value="all">جميع القضايا</option>
            {cases.map((caseItem) => (
              <option key={caseItem.id} value={caseItem.title}>
                {caseItem.title}
              </option>
            ))}
          </select>

          <button onClick={clearFilters} className="btn btn-ghost whitespace-nowrap">
            تصفية
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['all', 'الكل'],
              ['pending', 'معلقة'],
              ['done', 'منتهية'],
            ] as ['all' | 'pending' | 'done', string][]
          ).map(([key, label]) => (
            <button
              key={key}
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
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="✅"
            title="لا توجد مهام"
            sub={
              tasks.length === 0
                ? 'أضف أول مهمة لتنظيم العمل داخل المكتب.'
                : 'لا توجد نتائج مطابقة للفلاتر الحالية.'
            }
            action={
              tasks.length === 0 ? (
                <button onClick={() => setOpen(true)} className="btn btn-primary">
                  + إضافة مهمة
                </button>
              ) : (
                <button onClick={clearFilters} className="btn btn-ghost">
                  مسح الفلاتر
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((task) => (
            <div
              key={task.id}
              className={`card group p-4 transition-all duration-200 hover:-translate-y-0.5 ${
                task.completed ? 'opacity-70' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  aria-label="تغيير حالة المهمة"
                  onClick={() => toggle(task.id, !task.completed)}
                  className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black transition-all"
                  style={{
                    borderColor: 'var(--sidebar)',
                    background: task.completed ? 'var(--sidebar)' : 'transparent',
                    color: task.completed ? '#fff' : 'transparent',
                  }}
                >
                  ✓
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-black leading-6 ${
                          task.completed ? 'line-through' : ''
                        }`}
                        style={{ color: 'var(--text)' }}
                      >
                        {task.title}
                      </p>

                      {task.description && (
                        <p
                          className="mt-1 line-clamp-2 text-xs leading-5"
                          style={{ color: 'var(--text-3)' }}
                        >
                          {task.description}
                        </p>
                      )}
                    </div>

                    <span className={`${PB[task.priority] ?? 'badge badge-gray'} shrink-0`}>
                      {PA[task.priority] ?? task.priority}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {task.dueDate && (
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-bold"
                        style={{
                          background: isOverdue(task)
                            ? 'var(--red-soft)'
                            : isSoon(task)
                              ? '#fff7ed'
                              : 'var(--green-soft)',
                          color: isOverdue(task)
                            ? '#dc2626'
                            : isSoon(task)
                              ? '#d97706'
                              : 'var(--text-2)',
                        }}
                      >
                        📅{' '}
                        {formatDate(task.dueDate, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    )}

                    {task.client && (
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        👤 {task.client.name}
                      </span>
                    )}

                    {task.case && (
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        ⚖️ {task.case.title}
                      </span>
                    )}

                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{
                        background: task.completed ? '#ecfdf5' : 'var(--green-soft)',
                        color: task.completed ? '#059669' : 'var(--sidebar)',
                      }}
                    >
                      {task.completed ? 'منتهية' : 'معلقة'}
                    </span>
                  </div>
                </div>

                <button
                  aria-label="حذف المهمة"
                  onClick={() => del(task.id)}
                  className="shrink-0 text-sm text-red-400 opacity-70 transition-all hover:text-red-600 hover:opacity-100"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
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
              onChange={(event) =>
                setForm((previous) => ({ ...previous, title: event.target.value }))
              }
              className="input"
              autoFocus
            />
          </FormField>

          <FormField label="الوصف">
            <textarea
              aria-label="الوصف"
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              className="input"
              rows={2}
              style={{ resize: 'none' }}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="الأولوية">
              <select
                aria-label="الأولوية"
                value={form.priority}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    priority: event.target.value,
                  }))
                }
                className="input"
              >
                {Object.entries(PA).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="الموعد النهائي">
              <input
                aria-label="الموعد النهائي"
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    dueDate: event.target.value,
                  }))
                }
                className="input"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="الموكل">
              <select
                aria-label="الموكل"
                value={form.clientId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    clientId: event.target.value,
                  }))
                }
                className="input"
              >
                <option value="">بدون موكل</option>

                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="القضية">
              <select
                aria-label="القضية"
                value={form.caseId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    caseId: event.target.value,
                  }))
                }
                className="input"
              >
                <option value="">بدون قضية</option>

                {cases.map((caseItem) => (
                  <option key={caseItem.id} value={caseItem.id}>
                    {caseItem.title}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setForm(INIT)
              }}
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

      {/* Delete Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="تأكيد حذف المهمة"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.
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