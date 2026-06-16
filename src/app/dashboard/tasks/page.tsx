'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import EmptyState from '@/components/ui/EmptyState'
import PageLoader from '@/components/ui/PageLoader'
import { formatDate } from '@/lib/utils'
import { translations, type Locale } from '@/lib/i18n'
import { useLocale } from '@/lib/useLocale'
import SubscriptionReadOnlyBanner from '@/components/billing/SubscriptionReadOnlyBanner'
import { useTenantWriteAccess } from '@/hooks/useTenantWriteAccess'

interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string
  priority: string
  completed: boolean
  client?: {
    id?: string
    name: string
    archivedAt?: string | null
  } | null
  case?: {
    id?: string
    title: string
    client?: {
      id?: string
      name: string
      archivedAt?: string | null
    } | null
  } | null
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

const PRIORITY_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    URGENT: 'عاجلة',
    HIGH: 'عالية',
    MEDIUM: 'متوسطة',
    LOW: 'منخفضة',
  },
  en: {
    URGENT: 'Urgent',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  },
}

const INIT = {
  title: '',
  description: '',
  dueDate: '',
  priority: 'MEDIUM',
  clientId: '',
  caseId: '',
}


const TASK_TRANSLATIONS = {
  ar: {
    hero: {
      badge: 'إدارة العمل اليومي',
      title: 'المهام',
      subtitle: 'تابع المهام المرتبطة بالقضايا والموكلين، وحدد الأولويات والمواعيد النهائية لضمان عدم تفويت أي إجراء مهم.',
    },
    actions: { newTask: '+ مهمة جديدة', addTask: '+ إضافة مهمة', deleteTask: 'حذف المهمة', deleting: 'جاري الحذف...' },
    stats: { total: 'كل المهام', pending: 'معلقة', done: 'منتهية', overdue: 'متأخرة' },
    filters: {
      searchAria: 'البحث في المهام',
      searchPlaceholder: 'ابحث في العنوان، الوصف، الموكل أو القضية...',
      priorityAria: 'فلترة حسب الأولوية', clientAria: 'فلترة حسب الموكل', caseAria: 'فلترة حسب القضية',
      allPriorities: 'جميع الأولويات', allClients: 'جميع الموكلين', allCases: 'جميع القضايا',
      apply: 'بحث', clear: 'مسح الفلاتر',
      chips: { all: 'الكل', pending: 'معلقة', done: 'منتهية' },
    },
    status: { pending: 'معلقة', done: 'منتهية' },
    empty: { title: 'لا توجد مهام', first: 'أضف أول مهمة لتنظيم العمل داخل المكتب.', filtered: 'لا توجد نتائج مطابقة للفلاتر الحالية.' },
    card: { toggleAria: 'تغيير حالة المهمة', archivedClient: 'موكل مؤرشف' },
    modal: { createTitle: 'إضافة مهمة جديدة', deleteTitle: 'تأكيد حذف المهمة', deleteMessage: 'هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.' },
    form: { title: 'عنوان المهمة', description: 'الوصف', priority: 'الأولوية', dueDate: 'الموعد النهائي', client: 'الموكل', case: 'القضية', noClient: 'بدون موكل', noCase: 'بدون قضية' },
    messages: {
      loadError: 'فشل تحميل المهام', updateError: 'فشل تحديث المهمة', updateUnexpectedError: 'حدث خطأ أثناء تحديث المهمة',
      completedSuccess: 'تم إنجاز المهمة', reopenedSuccess: 'تم إعادة المهمة', deleteError: 'فشل حذف المهمة', deleteSuccess: 'تم حذف المهمة',
      deleteUnexpectedError: 'حدث خطأ أثناء حذف المهمة', titleRequired: 'العنوان مطلوب', createError: 'فشل إضافة المهمة',
      createSuccess: 'تمت إضافة المهمة', createUnexpectedError: 'حدث خطأ أثناء إضافة المهمة', archivedDeleteBlocked: 'لا يمكن حذف مهمة مرتبطة بموكل مؤرشف',
    },
  },
  en: {
    hero: {
      badge: 'Daily work management',
      title: 'Tasks',
      subtitle: 'Track tasks linked to cases and clients, set priorities and deadlines, and avoid missing any important action.',
    },
    actions: { newTask: '+ New task', addTask: '+ Add task', deleteTask: 'Delete task', deleting: 'Deleting...' },
    stats: { total: 'All tasks', pending: 'Pending', done: 'Completed', overdue: 'Overdue' },
    filters: {
      searchAria: 'Search tasks',
      searchPlaceholder: 'Search by title, description, client, or case...',
      priorityAria: 'Filter by priority', clientAria: 'Filter by client', caseAria: 'Filter by case',
      allPriorities: 'All priorities', allClients: 'All clients', allCases: 'All cases',
      apply: 'Filter', clear: 'Clear filters',
      chips: { all: 'All', pending: 'Pending', done: 'Completed' },
    },
    status: { pending: 'Pending', done: 'Completed' },
    empty: { title: 'No tasks', first: 'Add the first task to organize the office workflow.', filtered: 'No tasks match the current filters.' },
    card: { toggleAria: 'Change task status', archivedClient: 'Archived client' },
    modal: { createTitle: 'Add new task', deleteTitle: 'Confirm task deletion', deleteMessage: 'Are you sure you want to delete this task? This action cannot be undone.' },
    form: { title: 'Task title', description: 'Description', priority: 'Priority', dueDate: 'Due date', client: 'Client', case: 'Case', noClient: 'No client', noCase: 'No case' },
    messages: {
      loadError: 'Failed to load tasks', updateError: 'Failed to update task', updateUnexpectedError: 'An error occurred while updating the task',
      completedSuccess: 'Task completed', reopenedSuccess: 'Task reopened', deleteError: 'Failed to delete task', deleteSuccess: 'Task deleted',
      deleteUnexpectedError: 'An error occurred while deleting the task', titleRequired: 'Title is required', createError: 'Failed to add task',
      createSuccess: 'Task added', createUnexpectedError: 'An error occurred while adding the task', archivedDeleteBlocked: 'Cannot delete a task linked to an archived client',
    },
  },
}

export default function TasksPage() {
  const localeState = useLocale() as { locale?: Locale; t?: typeof translations.ar }
  const locale = localeState?.locale === 'en' ? 'en' : 'ar'
  const t = localeState?.t ?? translations[locale] ?? translations.ar
  const tAny = t as { tasks?: typeof TASK_TRANSLATIONS.ar; common?: typeof translations.ar.common }
  const taskCopy = tAny.tasks?.messages ? tAny.tasks : TASK_TRANSLATIONS[locale]
  const common = tAny.common ?? translations.ar.common
  const isRtl = locale === 'ar'
  const priorityLabels = PRIORITY_LABELS[locale] ?? PRIORITY_LABELS.ar
  const fieldProps = {
    dir: isRtl ? 'rtl' : 'ltr',
    style: { textAlign: isRtl ? 'right' : 'left', direction: isRtl ? 'rtl' : 'ltr' } as React.CSSProperties,
  }
  const dateFieldStyle = {
    textAlign: 'left',
    direction: 'ltr',
    colorScheme: 'dark',
  } as React.CSSProperties

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
  const writeAccess = useTenantWriteAccess(locale)

  const now = useMemo(() => new Date(), [])

  const isArchivedTask = useCallback((task: Task) => {
    return Boolean(task.client?.archivedAt || task.case?.client?.archivedAt)
  }, [])

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
      toast.error(taskCopy.messages.loadError)
      setTasks([])
      setClients([])
      setCases([])
    } finally {
      setLoading(false)
    }
  }, [taskCopy.messages.loadError])

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
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.updateError)
      return
    }

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })

      if (!response.ok) {
        toast.error(taskCopy.messages.updateError)
        return
      }

      setTasks((current) =>
        current.map((task) => (task.id === id ? { ...task, completed } : task))
      )

      toast.success(completed ? taskCopy.messages.completedSuccess : taskCopy.messages.reopenedSuccess)
    } catch {
      toast.error(taskCopy.messages.updateUnexpectedError)
    }
  }

  function del(id: string) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.deleteError)
      return
    }

    setDeleteId(id)
  }

  async function confirmDelete() {
    if (!deleteId) return

    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.deleteError)
      return
    }

    try {
      setDeleteLoading(true)

      const response = await fetch(`/api/tasks/${deleteId}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(data.message ?? taskCopy.messages.deleteError)
        return
      }

      toast.success(taskCopy.messages.deleteSuccess)
      setDeleteId(null)
      load()
    } catch {
      toast.error(taskCopy.messages.deleteUnexpectedError)
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()

    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.createError)
      return
    }

    if (!form.title.trim()) {
      toast.error(taskCopy.messages.titleRequired)
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
        toast.error(data.message ?? taskCopy.messages.createError)
        return
      }

      toast.success(taskCopy.messages.createSuccess)
      setOpen(false)
      setForm(INIT)
      load()
    } catch {
      toast.error(taskCopy.messages.createUnexpectedError)
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

  function openCreateTaskModal() {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || taskCopy.messages.createError)
      return
    }

    setOpen(true)
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-5 stagger">
      <SubscriptionReadOnlyBanner
        visible={!writeAccess.canWrite}
        message={writeAccess.message}
        isRtl={isRtl}
      />

      {/* Header */}
      <div
        className="relative overflow-hidden rounded-[28px] border p-6 text-start"
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
              {taskCopy.hero.badge}
            </div>

            <h1 className="text-2xl font-black text-white">{taskCopy.hero.title}</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {taskCopy.hero.subtitle}
            </p>
          </div>

          <button
            onClick={openCreateTaskModal}
            disabled={!writeAccess.canWrite}
            title={!writeAccess.canWrite ? writeAccess.message || taskCopy.messages.createError : taskCopy.actions.newTask}
            className="btn shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: '#fff',
              color: 'var(--sidebar)',
              borderColor: 'rgba(255,255,255,0.32)',
            }}
          >
            {taskCopy.actions.newTask}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: taskCopy.stats.total, value: total, color: 'var(--text)', bg: 'var(--card)' },
          { label: taskCopy.stats.pending, value: pending, color: 'var(--sidebar)', bg: 'var(--green-soft)' },
          { label: taskCopy.stats.done, value: done, color: '#6b7280', bg: 'var(--card)' },
          { label: taskCopy.stats.overdue, value: overdue, color: '#dc2626', bg: 'var(--red-soft)' },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5 text-start"
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
      <div className="card p-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_.8fr_.8fr_.8fr_auto]">
          <input
            aria-label={taskCopy.filters.searchAria}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={taskCopy.filters.searchPlaceholder}
            className="input"
            {...fieldProps}
          />

          <select
            aria-label={taskCopy.filters.priorityAria}
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="input"
            {...fieldProps}
          >
            <option value="all" dir={isRtl ? 'rtl' : 'ltr'}>{taskCopy.filters.allPriorities}</option>
            <option value="URGENT" dir={isRtl ? 'rtl' : 'ltr'}>{priorityLabels.URGENT}</option>
            <option value="HIGH" dir={isRtl ? 'rtl' : 'ltr'}>{priorityLabels.HIGH}</option>
            <option value="MEDIUM" dir={isRtl ? 'rtl' : 'ltr'}>{priorityLabels.MEDIUM}</option>
            <option value="LOW" dir={isRtl ? 'rtl' : 'ltr'}>{priorityLabels.LOW}</option>
          </select>

          <select
            aria-label={taskCopy.filters.clientAria}
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            className="input"
            {...fieldProps}
          >
            <option value="all" dir={isRtl ? 'rtl' : 'ltr'}>{taskCopy.filters.allClients}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.name} dir={isRtl ? 'rtl' : 'ltr'}>
                {client.name}
              </option>
            ))}
          </select>

          <select
            aria-label={taskCopy.filters.caseAria}
            value={caseFilter}
            onChange={(event) => setCaseFilter(event.target.value)}
            className="input"
            {...fieldProps}
          >
            <option value="all" dir={isRtl ? 'rtl' : 'ltr'}>{taskCopy.filters.allCases}</option>
            {cases.map((caseItem) => (
              <option key={caseItem.id} value={caseItem.title} dir={isRtl ? 'rtl' : 'ltr'}>
                {caseItem.title}
              </option>
            ))}
          </select>

          <button onClick={clearFilters} className="btn btn-ghost whitespace-nowrap">
            {taskCopy.filters.apply}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['all', taskCopy.filters.chips.all],
              ['pending', taskCopy.filters.chips.pending],
              ['done', taskCopy.filters.chips.done],
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
            title={taskCopy.empty.title}
            sub={
              tasks.length === 0
                ? taskCopy.empty.first
                : taskCopy.empty.filtered
            }
            action={
              tasks.length === 0 ? (
                <button onClick={openCreateTaskModal} disabled={!writeAccess.canWrite} title={!writeAccess.canWrite ? writeAccess.message || taskCopy.messages.createError : taskCopy.actions.addTask} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60">
                  {taskCopy.actions.addTask}
                </button>
              ) : (
                <button onClick={clearFilters} className="btn btn-ghost">
                  {taskCopy.filters.clear}
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((task) => {
            const archivedTask = isArchivedTask(task)

            return (
              <div
                key={task.id}
                className={`card group p-4 text-start transition-all duration-200 hover:-translate-y-0.5 ${
                  task.completed ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    aria-label={taskCopy.card.toggleAria}
                    onClick={() => toggle(task.id, !task.completed)}
                    disabled={!writeAccess.canWrite}
                    title={!writeAccess.canWrite ? writeAccess.message || taskCopy.messages.updateError : taskCopy.card.toggleAria}
                    className="mt-1 flex h-7 w-7 disabled:cursor-not-allowed disabled:opacity-50 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black transition-all"
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
                        {priorityLabels[task.priority] ?? task.priority}
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
                        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--green-soft)', color: 'var(--text-2)' }}>
                          👤 {task.client.name}
                        </span>
                      )}

                      {archivedTask && (
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-black"
                          style={{
                            background: 'var(--amber-soft, #fff7ed)',
                            color: '#b45309',
                            border: '1px solid rgba(180, 83, 9, 0.18)',
                          }}
                        >
                          {taskCopy.card.archivedClient}
                        </span>
                      )}

                      {task.case && (
                        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--green-soft)', color: 'var(--text-2)' }}>
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
                        {task.completed ? taskCopy.status.done : taskCopy.status.pending}
                      </span>
                    </div>
                  </div>

                  <button
                    aria-label={taskCopy.actions.deleteTask}
                    disabled={!writeAccess.canWrite || archivedTask}
                    title={
                      !writeAccess.canWrite
                        ? writeAccess.message || taskCopy.messages.deleteError
                        : archivedTask
                          ? taskCopy.messages.archivedDeleteBlocked
                          : taskCopy.actions.deleteTask
                    }
                    onClick={() => {
                      if (!writeAccess.canWrite) {
                        toast.warning(writeAccess.message || taskCopy.messages.deleteError)
                        return
                      }

                      if (archivedTask) {
                        toast.warning(taskCopy.messages.archivedDeleteBlocked)
                        return
                      }

                      del(task.id)
                    }}
                    className="shrink-0 text-sm text-red-400 opacity-70 transition-all hover:text-red-600 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-red-400"
                  >
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          setForm(INIT)
        }}
        title={taskCopy.modal.createTitle}
        size="sm"
      >
        <form onSubmit={handleAdd} className="space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
          <FormField label={taskCopy.form.title} required>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, title: event.target.value }))
              }
              className="input"
              autoFocus
              {...fieldProps}
            />
          </FormField>

          <FormField label={taskCopy.form.description}>
            <textarea
              aria-label={taskCopy.form.description}
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              className="input"
              rows={2}
              style={{ ...fieldProps.style, resize: 'none' }}
              dir={fieldProps.dir}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={taskCopy.form.priority}>
              <select
                aria-label={taskCopy.form.priority}
                value={form.priority}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    priority: event.target.value,
                  }))
                }
                className="input"
                {...fieldProps}
              >
                {Object.entries(priorityLabels).map(([key, value]) => (
                  <option key={key} value={key} dir={isRtl ? 'rtl' : 'ltr'}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={taskCopy.form.dueDate}>
              <input
                aria-label={taskCopy.form.dueDate}
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    dueDate: event.target.value,
                  }))
                }
                className="input"
                dir="ltr"
                style={dateFieldStyle}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={taskCopy.form.client}>
              <select
                aria-label={taskCopy.form.client}
                value={form.clientId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    clientId: event.target.value,
                  }))
                }
                className="input"
                {...fieldProps}
              >
                <option value="" dir={isRtl ? 'rtl' : 'ltr'}>{taskCopy.form.noClient}</option>

                {clients.map((client) => (
                  <option key={client.id} value={client.id} dir={isRtl ? 'rtl' : 'ltr'}>
                    {client.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={taskCopy.form.case}>
              <select
                aria-label={taskCopy.form.case}
                value={form.caseId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    caseId: event.target.value,
                  }))
                }
                className="input"
                {...fieldProps}
              >
                <option value="" dir={isRtl ? 'rtl' : 'ltr'}>{taskCopy.form.noCase}</option>

                {cases.map((caseItem) => (
                  <option key={caseItem.id} value={caseItem.id} dir={isRtl ? 'rtl' : 'ltr'}>
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
              {common.cancel}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? <span className="spinner spinner-sm" /> : common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={taskCopy.modal.deleteTitle}
        size="sm"
      >
        <div className="space-y-4 text-start" dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            {taskCopy.modal.deleteMessage}
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              className="btn btn-ghost flex-1"
            >
              {common.cancel}
            </button>

            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteLoading}
              className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {deleteLoading ? taskCopy.actions.deleting : common.delete}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
