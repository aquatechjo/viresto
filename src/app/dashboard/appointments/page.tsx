'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'

import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import PageLoader from '@/components/ui/PageLoader'

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
  client?: { name: string }
  case?: { title: string }
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
  DEADLINE: 'موعد',
  OTHER: 'أخرى',
}

const INIT = {
  title: '',
  clientId: '',
  caseId: '',
  startTime: '',
  location: '',
  type: 'MEETING',
  description: '',
  endTime: '',
}

export default function AppointmentsPage() {
  const [appts, setAppts] = useState<Appt[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INIT)
  const [detailsOpen, setDetailsOpen] = useState(false)
const [selectedAppt, setSelectedAppt] = useState<Appt | null>(null)
const [editMode, setEditMode] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    const [ar, cr] = await Promise.all([
      fetch('/api/appointments'),
      fetch('/api/clients'),
    ])

const safeJson = async (res: Response) => {
  if (!res.ok) return { data: [] }

  try {
    return await res.json()
  } catch {
    return { data: [] }
  }
}

const [ad, cd] = await Promise.all([
  safeJson(ar),
  safeJson(cr),
])

setAppts(Array.isArray(ad.data) ? ad.data : [])
setClients(Array.isArray(cd.data) ? cd.data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()

    if (!form.title || !form.startTime) {
      toast.error('العنوان والوقت مطلوبان')
      return
    }

    setSaving(true)

    const r = await fetch('/api/appointments', {
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
      toast.success('تمت إضافة الموعد')
      setOpen(false)
      setForm(INIT)
      load()
    } else {
      toast.error(d.message || 'حدث خطأ')
    }

    setSaving(false)
  }
  async function handleUpdate(e: React.FormEvent) {
  e.preventDefault()

  if (!selectedAppt) return

  if (!form.title || !form.startTime) {
    toast.error('العنوان والوقت مطلوبان')
    return
  }

  setSaving(true)

  const r = await fetch(`/api/appointments/${selectedAppt.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...form,
      clientId: form.clientId || undefined,
      caseId: form.caseId || undefined,
    }),
  })

  const d = await r.json()

  if (d.success) {
    toast.success('تم تعديل الموعد')
    setOpen(false)
    setEditMode(false)
    setSelectedAppt(null)
    setForm(INIT)
    load()
  } else {
    toast.error(d.message || 'حدث خطأ')
  }

  setSaving(false)
}

  async function del(id: string) {
  

    const r = await fetch(`/api/appointments/${id}`, {
      method: 'DELETE',
    })

    const d = await r.json()

    if (d.success) {
      toast.success('تم الحذف')
      load()
    }
  }

  function f(key: keyof typeof INIT) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((p) => ({ ...p, [key]: e.target.value }))
    }
  }

const calendarEvents = useMemo(
  () =>
    appts.map((a) => ({
      id: a.id,
      title: a.client?.name ? `${a.title} - ${a.client.name}` : a.title,
      start: a.startTime,
      end: a.endTime,
      backgroundColor: TYPE_COLOR[a.type] || 'var(--sidebar)',
      borderColor: TYPE_COLOR[a.type] || 'var(--sidebar)',
      extendedProps: a,
    })),
  [appts]
)

  return (
    <div className="space-y-5 stagger">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            المواعيد
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            إدارة الجلسات والاجتماعات والمواعيد من تقويم واحد
          </p>
        </div>

        <button onClick={() => setOpen(true)} className="btn btn-primary">
          + إضافة موعد
        </button>
      </div>

      <div className="card p-4">
        {loading ? (
          <PageLoader />
        ) : (
<AppointmentsCalendar
  events={calendarEvents}
  onEventDrop={async (info) => {
    const r = await fetch(`/api/appointments/${info.event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startTime: info.event.start?.toISOString(),
      }),
    })

    const d = await r.json()

    if (d.success) {
      toast.success('تم تحديث الموعد')
      load()
    } else {
      toast.error('فشل تحديث الموعد')
      info.revert()
    }
  }}
  onEventResize={async (info) => {
    const r = await fetch(`/api/appointments/${info.event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startTime: info.event.start?.toISOString(),
        endTime: info.event.end?.toISOString(),
      }),
    })

    const d = await r.json()

    if (d.success) {
      toast.success('تم تحديث مدة الموعد')
      load()
    } else {
      toast.error('فشل تحديث مدة الموعد')
      info.revert()
    }
  }}
  onDateClick={(info) => {
    setForm((p) => ({
      ...p,
      startTime: `${info.dateStr}T09:00`,
    }))
    setOpen(true)
  }}
  onEventClick={(info) => {
    const a = info.event.extendedProps as Appt

    setSelectedAppt(a)
    setDetailsOpen(true)
  }}
/>
        )}
      </div>

      <Modal
        open={open}
onClose={() => {
  setOpen(false)
  setEditMode(false)
  setSelectedAppt(null)
  setForm(INIT)
}}
        title={editMode ? 'تعديل الموعد' : 'إضافة موعد جديد'}
      >
        <form onSubmit={editMode ? handleUpdate : handleAdd} className="space-y-3">
          <FormField label="عنوان الموعد" required>
            <input
              value={form.title}
              onChange={f('title')}
              className="input"
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="النوع">
              <select
  aria-label="نوع الموعد"
  value={form.type}
  onChange={f('type')}
  className="input"
>
                {Object.entries(TYPE_AR).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
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
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="التاريخ والوقت" required>
<input
  aria-label="التاريخ والوقت"
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
  value={form.endTime || ''}
  onChange={(e) =>
    setForm((p) => ({
      ...p,
      endTime: e.target.value,
    }))
  }
  className="input"
/>
</FormField>

          <FormField label="المكان">
<input
  aria-label="المكان"
  value={form.location}
  onChange={f('location')}
  placeholder="مثلاً: محكمة بداية عمان"
  className="input"
/>
          </FormField>

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
              {saving ? <span className="spinner spinner-sm" /> : editMode ? 'حفظ التعديل' : 'حفظ'}
            </button>
          </div>
        </form>
      </Modal>
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
      <div className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-4">
        <p className="text-sm text-[var(--text-2)]">الموعد</p>
        <p className="mt-1 font-bold text-[var(--text)]">
          {selectedAppt.title}
        </p>

        <p className="mt-3 text-sm text-[var(--text-2)]">النوع</p>
        <p className="mt-1 font-bold text-[var(--text)]">
          {selectedAppt.type}
        </p>
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
    onClick={() => {
      if (!selectedAppt) return

setForm({
  title: selectedAppt.title,
  clientId: '',
  caseId: '',
  startTime: selectedAppt.startTime.slice(0, 16),
  endTime: selectedAppt.endTime ? selectedAppt.endTime.slice(0, 16) : '',
  location: selectedAppt.location || '',
  type: selectedAppt.type || 'MEETING',
  description: '',
})

      setEditMode(true)
      setDetailsOpen(false)
      setOpen(true)
    }}
    className="btn btn-primary flex-1"
  >
    تعديل
  </button>

  <button
    type="button"
    onClick={() => {
      if (!selectedAppt) return
      del(selectedAppt.id)
      setDetailsOpen(false)
      setSelectedAppt(null)
    }}
    className="btn btn-danger flex-1"
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