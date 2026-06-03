'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'

import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatTime } from '@/lib/utils'

const AppointmentsCalendar = dynamic(() => import('./AppointmentsCalendar'), {
  ssr: false,
  loading: () => <PageLoader />,
})

interface Appt {
  id: string
  title: string
  startTime: string
  endTime?: string
  location?: string
  type: string
  status: string
  description?: string
  client?: { name: string }
  case?: { title: string }
}

interface ClientItem {
  id: string
  name: string
}

const TYPE_COLOR: Record<string, string> = {
  COURT_SESSION: 'var(--sidebar)',
  MEETING: '#2563eb',
  PHONE_CALL: '#d97706',
  DEADLINE: '#dc2626',
  OTHER: 'var(--text-3)',
}

const TYPE_AR: Record<string, string> = {
  COURT_SESSION: 'جلسة',
  MEETING: 'اجتماع',
  PHONE_CALL: 'اتصال',
  DEADLINE: 'موعد نهائي',
  OTHER: 'أخرى',
}

const INIT = {
  title: '',
  clientId: '',
  caseId: '',
  startTime: '',
  endTime: '',
  location: '',
  type: 'MEETING',
  description: '',
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ar-JO')
}

function toDateTimeLocal(value?: string) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)

  return local.toISOString().slice(0, 16)
}

export default function AppointmentsPage() {
  const [appts, setAppts] = useState<Appt[]>([])
  const [clients, setClients] = useState<ClientItem[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appt | null>(null)

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INIT)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const [appointmentsRes, clientsRes] = await Promise.all([
        fetch('/api/appointments'),
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

      const [appointmentsData, clientsData] = await Promise.all([
        safeJson(appointmentsRes),
        safeJson(clientsRes),
      ])

      setAppts(Array.isArray(appointmentsData.data) ? appointmentsData.data : [])
      setClients(
        Array.isArray(clientsData.data?.data)
          ? clientsData.data.data
          : Array.isArray(clientsData.data)
            ? clientsData.data
            : []
      )
    } catch {
      toast.error('فشل تحميل المواعيد')
      setAppts([])
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)

  const todayAppts = useMemo(
    () => appts.filter((appt) => appt.startTime.slice(0, 10) === todayKey),
    [appts, todayKey]
  )

  const upcomingAppts = useMemo(
    () =>
      appts
        .filter((appt) => new Date(appt.startTime).getTime() >= now.getTime())
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )
        .slice(0, 5),
    [appts, now]
  )

  const courtSessions = appts.filter((appt) => appt.type === 'COURT_SESSION').length
  const deadlines = appts.filter((appt) => appt.type === 'DEADLINE').length

  const filteredAppts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return appts.filter((appt) => {
      const matchesType = typeFilter === 'all' || appt.type === typeFilter

      const matchesSearch =
        !query ||
        appt.title?.toLowerCase().includes(query) ||
        appt.location?.toLowerCase().includes(query) ||
        appt.client?.name?.toLowerCase().includes(query) ||
        appt.case?.title?.toLowerCase().includes(query)

      return matchesType && matchesSearch
    })
  }, [appts, search, typeFilter])

  const calendarEvents = useMemo(
    () =>
      filteredAppts.map((appt) => ({
        id: appt.id,
        title: appt.client?.name
          ? `${appt.title} - ${appt.client.name}`
          : appt.title,
        start: appt.startTime,
        end: appt.endTime,
        backgroundColor: TYPE_COLOR[appt.type] || 'var(--sidebar)',
        borderColor: TYPE_COLOR[appt.type] || 'var(--sidebar)',
        extendedProps: appt,
      })),
    [filteredAppts]
  )

  function f(key: keyof typeof INIT) {
    return (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((previous) => ({
        ...previous,
        [key]: event.target.value,
      }))
    }
  }

  function resetForm() {
    setForm(INIT)
    setEditMode(false)
    setSelectedAppt(null)
  }

  function clearFilters() {
    setSearch('')
    setTypeFilter('all')
  }

  async function saveAppointment(event: React.FormEvent) {
    event.preventDefault()

    if (!form.title.trim() || !form.startTime) {
      toast.error('العنوان والوقت مطلوبان')
      return
    }

    try {
      setSaving(true)

      const url = editMode && selectedAppt
        ? `/api/appointments/${selectedAppt.id}`
        : '/api/appointments'

      const method = editMode ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clientId: form.clientId || undefined,
          caseId: form.caseId || undefined,
          endTime: form.endTime || undefined,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        toast.error(data.message || 'حدث خطأ أثناء حفظ الموعد')
        return
      }

      toast.success(editMode ? 'تم تعديل الموعد' : 'تمت إضافة الموعد')
      setOpen(false)
      resetForm()
      load()
    } catch {
      toast.error('حدث خطأ أثناء حفظ الموعد')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAppointment(id: string) {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        toast.error(data.message || 'فشل حذف الموعد')
        return
      }

      toast.success('تم حذف الموعد')
      setDetailsOpen(false)
      setSelectedAppt(null)
      load()
    } catch {
      toast.error('حدث خطأ أثناء حذف الموعد')
    }
  }

  function openCreateModal(startTime?: string) {
    resetForm()

    setForm((previous) => ({
      ...previous,
      startTime: startTime ? `${startTime}T09:00` : '',
    }))

    setOpen(true)
  }

  function openEditModal(appt: Appt) {
    setSelectedAppt(appt)
    setForm({
      title: appt.title,
      clientId: '',
      caseId: '',
      startTime: toDateTimeLocal(appt.startTime),
      endTime: toDateTimeLocal(appt.endTime),
      location: appt.location || '',
      type: appt.type || 'MEETING',
      description: appt.description || '',
    })

    setEditMode(true)
    setDetailsOpen(false)
    setOpen(true)
  }

  if (loading) return <PageLoader />

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
              التقويم القانوني
            </div>

            <h1 className="text-2xl font-black text-white">المواعيد</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              تابع الجلسات والاجتماعات والمواعيد النهائية من تقويم واحد، مع
              ربط كل موعد بالموكل أو القضية لتسهيل متابعة العمل اليومي.
            </p>
          </div>

          <button
            onClick={() => openCreateModal()}
            className="btn shrink-0"
            style={{
              background: '#fff',
              color: 'var(--sidebar)',
              borderColor: 'rgba(255,255,255,0.32)',
            }}
          >
            + موعد جديد
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'كل المواعيد',
            value: appts.length,
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: 'مواعيد اليوم',
            value: todayAppts.length,
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: 'الجلسات',
            value: courtSessions,
            color: '#92400e',
            bg: 'var(--amber-soft)',
          },
          {
            label: 'المواعيد النهائية',
            value: deadlines,
            color: deadlines > 0 ? '#dc2626' : '#6b7280',
            bg: deadlines > 0 ? 'var(--red-soft)' : 'var(--card)',
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
            placeholder="ابحث في العنوان، المكان، الموكل أو القضية..."
            className="input"
          />

          <select
            aria-label="فلترة حسب نوع الموعد"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="input"
          >
            <option value="all">جميع الأنواع</option>

            {Object.entries(TYPE_AR).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>

          <button onClick={clearFilters} className="btn btn-ghost whitespace-nowrap">
            تصفية
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ['all', 'الكل'],
            ['COURT_SESSION', 'جلسات'],
            ['MEETING', 'اجتماعات'],
            ['PHONE_CALL', 'اتصالات'],
            ['DEADLINE', 'مواعيد نهائية'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={
                typeFilter === key
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

      {/* Calendar + Upcoming */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="card p-4">
          <AppointmentsCalendar
            events={calendarEvents}
            onEventDrop={async (info) => {
              const response = await fetch(`/api/appointments/${info.event.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  startTime: info.event.start?.toISOString(),
                }),
              })

              const data = await response.json().catch(() => ({}))

              if (response.ok && data.success) {
                toast.success('تم تحديث الموعد')
                load()
              } else {
                toast.error('فشل تحديث الموعد')
                info.revert()
              }
            }}
            onEventResize={async (info) => {
              const response = await fetch(`/api/appointments/${info.event.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  startTime: info.event.start?.toISOString(),
                  endTime: info.event.end?.toISOString(),
                }),
              })

              const data = await response.json().catch(() => ({}))

              if (response.ok && data.success) {
                toast.success('تم تحديث مدة الموعد')
                load()
              } else {
                toast.error('فشل تحديث مدة الموعد')
                info.revert()
              }
            }}
            onDateClick={(info) => openCreateModal(info.dateStr)}
            onEventClick={(info) => {
              const appt = info.event.extendedProps as Appt

              setSelectedAppt(appt)
              setDetailsOpen(true)
            }}
          />
        </div>

        <div className="card p-5">
          <div className="mb-4">
            <h3 className="font-black" style={{ color: 'var(--text)' }}>
              أقرب المواعيد
            </h3>

            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
              آخر 5 مواعيد قادمة
            </p>
          </div>

          {upcomingAppts.length === 0 ? (
            <EmptyState
              icon="📅"
              title="لا توجد مواعيد قادمة"
              sub="لا يوجد مواعيد مجدولة حالياً."
            />
          ) : (
            <div className="space-y-3">
              {upcomingAppts.map((appt) => (
                <div
                  key={appt.id}
                  onClick={() => {
                    setSelectedAppt(appt)
                    setDetailsOpen(true)
                  }}
                  className="cursor-pointer rounded-2xl border p-3 transition-all hover:-translate-y-0.5"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-1 h-full min-h-[42px] w-1 rounded-full"
                      style={{
                        background: TYPE_COLOR[appt.type] ?? 'var(--text-3)',
                      }}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-black"
                          style={{
                            background: 'var(--green-soft)',
                            color: 'var(--sidebar)',
                          }}
                        >
                          {TYPE_AR[appt.type] ?? appt.type}
                        </span>

                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {formatTime(appt.startTime)}
                        </span>
                      </div>

                      <p
                        className="mt-2 truncate text-sm font-black"
                        style={{ color: 'var(--text)' }}
                      >
                        {appt.title}
                      </p>

                      <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                        {formatDate(appt.startTime)}
                      </p>

                      {appt.client?.name && (
                        <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-2)' }}>
                          👤 {appt.client.name}
                        </p>
                      )}

                      {appt.location && (
                        <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-2)' }}>
                          📍 {appt.location}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          resetForm()
        }}
        title={editMode ? 'تعديل الموعد' : 'إضافة موعد جديد'}
      >
        <form onSubmit={saveAppointment} className="space-y-3">
          <FormField label="عنوان الموعد" required>
            <input
              value={form.title}
              onChange={f('title')}
              className="input"
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="النوع">
              <select
                aria-label="نوع الموعد"
                value={form.type}
                onChange={f('type')}
                className="input"
              >
                {Object.entries(TYPE_AR).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="الموكل">
              <select
                aria-label="الموكل"
                value={form.clientId}
                onChange={f('clientId')}
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
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="وقت البداية" required>
              <input
                aria-label="وقت البداية"
                type="datetime-local"
                value={form.startTime}
                onChange={f('startTime')}
                className="input"
              />
            </FormField>

            <FormField label="وقت الانتهاء">
              <input
                aria-label="وقت الانتهاء"
                type="datetime-local"
                value={form.endTime}
                onChange={f('endTime')}
                className="input"
              />
            </FormField>
          </div>

          <FormField label="المكان">
            <input
              aria-label="المكان"
              value={form.location}
              onChange={f('location')}
              placeholder="مثلاً: محكمة بداية عمان"
              className="input"
            />
          </FormField>

          <FormField label="الوصف">
            <textarea
              aria-label="الوصف"
              value={form.description}
              onChange={f('description')}
              className="input"
              rows={2}
              style={{ resize: 'none' }}
            />
          </FormField>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                resetForm()
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
              {saving ? (
                <span className="spinner spinner-sm" />
              ) : editMode ? (
                'حفظ التعديل'
              ) : (
                'حفظ'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false)
          setSelectedAppt(null)
        }}
        title="تفاصيل الموعد"
      >
        {selectedAppt && (
          <div className="space-y-4">
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--green-soft)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-black" style={{ color: 'var(--text)' }}>
                  {selectedAppt.title}
                </p>

                <span
                  className="rounded-full px-3 py-1 text-xs font-black"
                  style={{
                    background: '#fff',
                    color: TYPE_COLOR[selectedAppt.type] ?? 'var(--sidebar)',
                  }}
                >
                  {TYPE_AR[selectedAppt.type] ?? selectedAppt.type}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                    التاريخ
                  </p>
                  <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {formatDate(selectedAppt.startTime)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                    الوقت
                  </p>
                  <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {formatTime(selectedAppt.startTime)}
                    {selectedAppt.endTime ? ` - ${formatTime(selectedAppt.endTime)}` : ''}
                  </p>
                </div>

                {selectedAppt.client?.name && (
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                      الموكل
                    </p>
                    <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {selectedAppt.client.name}
                    </p>
                  </div>
                )}

                {selectedAppt.case?.title && (
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                      القضية
                    </p>
                    <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {selectedAppt.case.title}
                    </p>
                  </div>
                )}

                {selectedAppt.location && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                      المكان
                    </p>
                    <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {selectedAppt.location}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDetailsOpen(false)
                  setSelectedAppt(null)
                }}
                className="btn btn-ghost flex-1"
              >
                إغلاق
              </button>

              <button
                type="button"
                onClick={() => openEditModal(selectedAppt)}
                className="btn btn-primary flex-1"
              >
                تعديل
              </button>

              <button
                type="button"
                onClick={() => deleteAppointment(selectedAppt.id)}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
              >
                حذف
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}