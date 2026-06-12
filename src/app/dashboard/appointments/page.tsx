'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import AppLoader from "@/components/ui/AppLoader"
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatTime } from '@/lib/utils'
import { translations, type Locale } from '@/lib/i18n'
import { useLocale } from '@/lib/useLocale'

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
      name?: string
      archivedAt?: string | null
    } | null
  } | null
}

interface ClientItem {
  id: string
  name: string
  archivedAt?: string | null
}

const TYPE_COLOR: Record<string, string> = {
  COURT_SESSION: 'var(--sidebar)',
  MEETING: '#2563eb',
  PHONE_CALL: '#d97706',
  DEADLINE: '#dc2626',
  OTHER: 'var(--text-3)',
}

const TYPE_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    COURT_SESSION: 'جلسة',
    MEETING: 'اجتماع',
    PHONE_CALL: 'اتصال',
    DEADLINE: 'موعد نهائي',
    OTHER: 'أخرى',
  },
  en: {
    COURT_SESSION: 'Court session',
    MEETING: 'Meeting',
    PHONE_CALL: 'Phone call',
    DEADLINE: 'Deadline',
    OTHER: 'Other',
  },
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

function formatDate(date: string, locale: Locale) {
  return new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-JO' : 'en-US')
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
  const localeState = useLocale() as { locale?: Locale; t?: typeof translations.ar }
  const locale = localeState?.locale === 'en' ? 'en' : 'ar'
  const t = localeState?.t ?? translations[locale] ?? translations.ar
  const a = t.appointments ?? translations.ar.appointments
  const common = t.common ?? translations.ar.common
  const isRtl = locale === 'ar'
  const typeLabels = TYPE_LABELS[locale] ?? TYPE_LABELS.ar
  const fieldDir = {
    dir: (isRtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    style: {
      textAlign: isRtl ? 'right' : 'left',
      direction: isRtl ? 'rtl' : 'ltr',
    } as React.CSSProperties,
  }

  const dateTimeFieldStyle = {
    textAlign: 'left',
    direction: 'ltr',
    colorScheme: 'dark',
  } as React.CSSProperties

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
        fetch('/api/appointments?includeArchivedClients=true'),
        fetch('/api/clients?limit=100&archive=active'),
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
      toast.error(a.messages.loadError)
      setAppts([])
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isArchivedAppt = useCallback((appt: Appt) => {
    return Boolean(appt.client?.archivedAt || appt.case?.client?.archivedAt)
  }, [])

  const selectedApptArchived = selectedAppt ? isArchivedAppt(selectedAppt) : false

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientId),
    [clients, form.clientId]
  )

  const selectedClientArchived = Boolean(selectedClient?.archivedAt)

  const now = useMemo(() => new Date(), [])
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
      toast.error(a.messages.requiredTitleTime)
      return
    }

    if (editMode && selectedAppt && isArchivedAppt(selectedAppt)) {
      toast.warning(a.messages.archivedEditBlocked)
      return
    }

    if (selectedClientArchived) {
      toast.warning(a.messages.archivedCreateBlocked)
      return
    }

    try {
      setSaving(true)

      const url =
        editMode && selectedAppt
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
        toast.error(data.message || a.messages.saveError)
        return
      }

      toast.success(editMode ? a.messages.updateSuccess : a.messages.createSuccess)
      setOpen(false)
      resetForm()
      load()
    } catch {
      toast.error(a.messages.saveUnexpectedError)
    } finally {
      setSaving(false)
    }
  }

  async function deleteAppointment(id: string) {
    if (selectedAppt && isArchivedAppt(selectedAppt)) {
      toast.warning(a.messages.archivedDeleteBlocked)
      return
    }

    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        toast.error(data.message || a.messages.deleteError)
        return
      }

      toast.success(a.messages.deleteSuccess)
      setDetailsOpen(false)
      setSelectedAppt(null)
      load()
    } catch {
      toast.error(a.messages.deleteUnexpectedError)
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
    if (isArchivedAppt(appt)) {
      toast.warning(a.messages.archivedEditBlocked)
      return
    }

    setSelectedAppt(appt)
    setForm({
      title: appt.title,
      clientId: appt.client?.id || '',
      caseId: appt.case?.id || '',
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

if (loading) {
  return <AppLoader fullScreen={false} />
}

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-5 stagger">
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
          <div className="text-start">
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              {a.hero.badge}
            </div>

            <h1 className="text-2xl font-black text-white">{a.hero.title}</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {a.hero.subtitle}
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
            {a.actions.newAppointment}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: a.stats.total,
            value: appts.length,
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: a.stats.today,
            value: todayAppts.length,
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: a.stats.sessions,
            value: courtSessions,
            color: '#92400e',
            bg: 'var(--amber-soft)',
          },
          {
            label: a.stats.deadlines,
            value: deadlines,
            color: deadlines > 0 ? '#dc2626' : '#6b7280',
            bg: deadlines > 0 ? 'var(--red-soft)' : 'var(--card)',
          },
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
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_.8fr_auto]" dir={isRtl ? 'rtl' : 'ltr'}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={a.filters.searchPlaceholder}
            className="input"
            {...fieldDir}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ['all', a.filters.chips.all],
            ['COURT_SESSION', a.filters.chips.sessions],
            ['MEETING', a.filters.chips.meetings],
            ['PHONE_CALL', a.filters.chips.calls],
            ['DEADLINE', a.filters.chips.deadlines],
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
            locale={locale}
            events={calendarEvents}
            onEventDrop={async (info) => {
              const appt = info.event.extendedProps as Appt

              if (isArchivedAppt(appt)) {
                toast.warning(a.messages.archivedEditBlocked)
                info.revert()
                return
              }

              const response = await fetch(`/api/appointments/${info.event.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  startTime: info.event.start?.toISOString(),
                }),
              })

              const data = await response.json().catch(() => ({}))

              if (response.ok && data.success) {
                toast.success(a.messages.moveSuccess)
                load()
              } else {
                toast.error(data.message || a.messages.moveError)
                info.revert()
              }
            }}
            onEventResize={async (info) => {
              const appt = info.event.extendedProps as Appt

              if (isArchivedAppt(appt)) {
                toast.warning(a.messages.archivedEditBlocked)
                info.revert()
                return
              }

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
                toast.success(a.messages.resizeSuccess)
                load()
              } else {
                toast.error(data.message || a.messages.resizeError)
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

        <div className="card p-5 text-start">
          <div className="mb-4">
            <h3 className="font-black" style={{ color: 'var(--text)' }}>
              {a.upcoming.title}
            </h3>

            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
              {a.upcoming.subtitle}
            </p>
          </div>

          {upcomingAppts.length === 0 ? (
            <EmptyState
              icon="📅"
              title={a.empty.upcomingTitle}
              sub={a.empty.upcomingSub}
            />
          ) : (
            <div className="space-y-3">
              {upcomingAppts.map((appt) => {
                const archivedAppt = isArchivedAppt(appt)

                return (
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
                            {typeLabels[appt.type] ?? appt.type}
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
                          {formatDate(appt.startTime, locale)}
                        </p>

                        {appt.client?.name && (
                          <p
                            className="mt-1 truncate text-xs"
                            style={{ color: 'var(--text-2)' }}
                          >
                            👤 {appt.client.name}
                          </p>
                        )}

                        {archivedAppt && (
                          <span
                            className="mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-black"
                            style={{
                              background: '#fff7ed',
                              color: '#b45309',
                              border: '1px solid rgba(180, 83, 9, 0.18)',
                            }}
                          >
                            {a.labels.archivedClient}
                          </span>
                        )}

                        {appt.location && (
                          <p
                            className="mt-1 truncate text-xs"
                            style={{ color: 'var(--text-2)' }}
                          >
                            📍 {appt.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
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
        title={editMode ? a.modal.editTitle : a.modal.createTitle}
      >
        <form onSubmit={saveAppointment} className="space-y-3 text-start" dir={isRtl ? 'rtl' : 'ltr'}>
          <FormField label={a.form.title} required>
            <input
              value={form.title}
              onChange={f('title')}
              className="input"
              {...fieldDir}
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={a.form.type}>
              <select
                aria-label={a.form.type}
                value={form.type}
                onChange={f('type')}
                className="input"
                {...fieldDir}
              >
                {Object.entries(typeLabels).map(([key, value]) => (
                  <option key={key} value={key} dir={isRtl ? 'rtl' : 'ltr'}>
                    {value}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={a.form.client}>
              <select
                aria-label={a.form.client}
                value={form.clientId}
                onChange={f('clientId')}
                className="input"
                {...fieldDir}
              >
                <option value="" dir={isRtl ? 'rtl' : 'ltr'}>{a.form.noClient}</option>

                {clients.map((client) => (
                  <option key={client.id} value={client.id} dir={isRtl ? 'rtl' : 'ltr'}>
                    {client.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {selectedClientArchived && (
            <div
              className="rounded-2xl border p-3 text-xs font-bold"
              style={{
                background: '#fff7ed',
                color: '#b45309',
                borderColor: 'rgba(180, 83, 9, 0.22)',
              }}
            >
              {a.messages.archivedLinkBlocked}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={a.form.startTime} required>
              <input
                aria-label={a.form.startTime}
                type="datetime-local"
                value={form.startTime}
                onChange={f('startTime')}
                className="input"
                dir="ltr"
                style={dateTimeFieldStyle}
              />
            </FormField>

            <FormField label={a.form.endTime}>
              <input
                aria-label={a.form.endTime}
                type="datetime-local"
                value={form.endTime}
                onChange={f('endTime')}
                className="input"
                dir="ltr"
                style={dateTimeFieldStyle}
              />
            </FormField>
          </div>

          <FormField label={a.form.location}>
            <input
              aria-label={a.form.location}
              value={form.location}
              onChange={f('location')}
              placeholder={a.form.locationPlaceholder}
              className="input"
              {...fieldDir}
            />
          </FormField>

          <FormField label={a.form.description}>
            <textarea
              aria-label={a.form.description}
              value={form.description}
              onChange={f('description')}
              className="input"
              rows={2}
              dir={isRtl ? 'rtl' : 'ltr'}
              style={{ resize: 'none', textAlign: isRtl ? 'right' : 'left' }}
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
              {common.cancel}
            </button>

            <button
              type="submit"
              disabled={saving || selectedClientArchived}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="spinner spinner-sm" />
              ) : editMode ? (
                a.actions.saveChanges
              ) : (
                common.save
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
        title={a.details.title}
      >
        {selectedAppt && (
          <div className="space-y-4 text-start" dir={isRtl ? 'rtl' : 'ltr'}>
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--green-soft)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-black" style={{ color: 'var(--text)' }}>
                  {selectedAppt.title}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-black"
                    style={{
                      background: '#fff',
                      color: TYPE_COLOR[selectedAppt.type] ?? 'var(--sidebar)',
                    }}
                  >
                    {typeLabels[selectedAppt.type] ?? selectedAppt.type}
                  </span>

                  {selectedApptArchived && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-black"
                      style={{
                        background: '#fff7ed',
                        color: '#b45309',
                        border: '1px solid rgba(180, 83, 9, 0.18)',
                      }}
                    >
                      {a.labels.archivedClient}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                    {a.details.date}
                  </p>
                  <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {formatDate(selectedAppt.startTime, locale)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                    {a.details.time}
                  </p>
                  <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {formatTime(selectedAppt.startTime)}
                    {selectedAppt.endTime
                      ? ` - ${formatTime(selectedAppt.endTime)}`
                      : ''}
                  </p>
                </div>

                {selectedAppt.client?.name && (
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                      {a.details.client}
                    </p>
                    <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {selectedAppt.client.name}
                    </p>
                  </div>
                )}

                {selectedAppt.case?.title && (
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                      {a.details.case}
                    </p>
                    <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {selectedAppt.case.title}
                    </p>
                  </div>
                )}

                {selectedAppt.location && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>
                      {a.details.location}
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
                {a.actions.close}
              </button>

              <button
                type="button"
                disabled={selectedApptArchived}
                title={
                  selectedApptArchived
                    ? a.messages.archivedEditBlocked
                    : common.edit
                }
                onClick={() => openEditModal(selectedAppt)}
                className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {common.edit}
              </button>

              <button
                type="button"
                disabled={selectedApptArchived}
                title={
                  selectedApptArchived
                    ? a.messages.archivedDeleteBlocked
                    : common.delete
                }
                onClick={() => {
                  if (selectedApptArchived) {
                    toast.warning(a.messages.archivedDeleteBlocked)
                    return
                  }

                  deleteAppointment(selectedAppt.id)
                }}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {common.delete}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}