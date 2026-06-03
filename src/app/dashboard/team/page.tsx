'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'

import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import {
  getApiMessage,
  isPlanLimitResponse,
  planLimitMessage,
} from '@/lib/plan-ui'

type Role = 'ADMIN' | 'LAWYER' | 'STAFF'
type StatusFilter = 'all' | 'active' | 'inactive'

interface TeamUser {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  createdAt: string
}

const ROLE_AR: Record<Role, string> = {
  ADMIN: 'مدير النظام',
  LAWYER: 'محامٍ',
  STAFF: 'موظف',
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'badge badge-green',
  LAWYER: 'badge badge-blue',
  STAFF: 'badge badge-gray',
}

const INIT_FORM = {
  name: '',
  email: '',
  role: 'LAWYER' as Role,
  password: '',
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('ar-JO')
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

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentRole, setCurrentRole] = useState('')
  const [planLimit, setPlanLimit] = useState('')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [form, setForm] = useState(INIT_FORM)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/team')
      const data = await response.json().catch(() => ({}))

      if (data.success) {
        setUsers(Array.isArray(data.data?.users) ? data.data.users : [])
        setCurrentRole(data.data?.currentRole || '')
      } else {
        toast.error(getApiMessage(data, 'تعذر تحميل الفريق'))
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل الفريق')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const adminsCount = users.filter((user) => user.role === 'ADMIN').length
  const lawyersCount = users.filter((user) => user.role === 'LAWYER').length
  const staffCount = users.filter((user) => user.role === 'STAFF').length
  const activeCount = users.filter((user) => user.isActive).length
  const inactiveCount = users.filter((user) => !user.isActive).length

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)

      const matchesRole = roleFilter === 'all' || user.role === roleFilter

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.isActive) ||
        (statusFilter === 'inactive' && !user.isActive)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  function clearFilters() {
    setSearch('')
    setRoleFilter('all')
    setStatusFilter('all')
  }

  async function addUser(event: FormEvent) {
    event.preventDefault()

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('الاسم والبريد وكلمة المرور مطلوبة')
      return
    }

    try {
      setSaving(true)
      setPlanLimit('')

      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json().catch(() => ({}))

      if (data.success) {
        toast.success('تمت إضافة المستخدم')
        setForm(INIT_FORM)
        loadUsers()
      } else if (isPlanLimitResponse(data)) {
        setPlanLimit(
          planLimitMessage(
            data,
            'وصلت إلى الحد المسموح من المستخدمين في خطتك الحالية.'
          )
        )
      } else {
        toast.error(getApiMessage(data, 'حدث خطأ أثناء إضافة المستخدم'))
      }
    } catch {
      toast.error('حدث خطأ أثناء إضافة المستخدم')
    } finally {
      setSaving(false)
    }
  }

  async function updateUser(id: string, payload: Partial<TeamUser>) {
    try {
      const response = await fetch(`/api/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (data.success) {
        toast.success('تم تحديث المستخدم')
        setUsers((previous) =>
          previous.map((user) => (user.id === id ? data.data : user))
        )
      } else {
        toast.error(getApiMessage(data, 'تعذر تحديث المستخدم'))
      }
    } catch {
      toast.error('حدث خطأ أثناء تحديث المستخدم')
    }
  }

  if (loading) return <PageLoader />

  if (currentRole && currentRole !== 'ADMIN') {
    return (
      <div className="space-y-5 stagger">
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              'linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 18px 50px rgba(45, 74, 62, 0.18)',
          }}
        >
          <h1 className="text-2xl font-black text-white">إدارة الفريق</h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
            هذه الصفحة مخصصة لإدارة مستخدمي المكتب وصلاحياتهم.
          </p>
        </div>

        <div className="card p-10 text-center">
          <h2 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
            غير مصرح
          </h2>

          <p className="mt-3 text-sm" style={{ color: 'var(--text-3)' }}>
            فقط مدير النظام يستطيع إدارة الفريق.
          </p>
        </div>
      </div>
    )
  }

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
              إدارة الصلاحيات والمستخدمين
            </div>

            <h1 className="text-2xl font-black text-white">الفريق</h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              أضف أعضاء المكتب، وحدد صلاحيات كل مستخدم، وفعّل أو عطّل الوصول
              للنظام من مكان واحد واضح وآمن.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const element = document.getElementById('add-team-user')
              element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="btn shrink-0"
            style={{
              background: '#fff',
              color: 'var(--sidebar)',
              borderColor: 'rgba(255,255,255,0.32)',
            }}
          >
            + عضو جديد
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'كل الأعضاء',
            value: users.length,
            color: 'var(--text)',
            bg: 'var(--card)',
          },
          {
            label: 'المفعلون',
            value: activeCount,
            color: 'var(--sidebar)',
            bg: 'var(--green-soft)',
          },
          {
            label: 'المدراء',
            value: adminsCount,
            color: '#2563eb',
            bg: 'var(--card)',
          },
          {
            label: 'المعطلون',
            value: inactiveCount,
            color: inactiveCount > 0 ? '#dc2626' : 'var(--text-3)',
            bg: inactiveCount > 0 ? 'var(--red-soft)' : 'var(--card)',
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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_.8fr_.8fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المستخدم أو البريد الإلكتروني..."
            className="input"
          />

          <select
            aria-label="فلترة حسب الدور"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as 'all' | Role)}
            className="input"
          >
            <option value="all">جميع الصلاحيات</option>
            <option value="ADMIN">مدير النظام</option>
            <option value="LAWYER">محامٍ</option>
            <option value="STAFF">موظف</option>
          </select>

          <select
            aria-label="فلترة حسب الحالة"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="input"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">مفعل</option>
            <option value="inactive">معطل</option>
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
          {[
            ['all', 'الكل'],
            ['ADMIN', 'المدراء'],
            ['LAWYER', 'المحامون'],
            ['STAFF', 'الموظفون'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRoleFilter(key as 'all' | Role)}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={
                roleFilter === key
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

          {(search || roleFilter !== 'all' || statusFilter !== 'all') && (
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

      {/* Main */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
        {/* Add User */}
        <form
          id="add-team-user"
          onSubmit={addUser}
          className="card p-5"
        >
          <div className="mb-5">
            <h2 className="text-xl font-black" style={{ color: 'var(--text)' }}>
              إضافة مستخدم
            </h2>

            <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
              المستخدم الجديد سيدخل باستخدام البريد وكلمة المرور المؤقتة.
            </p>
          </div>

          <div className="space-y-3">
            <input
              className="input"
              placeholder="الاسم الكامل"
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
            />

            <input
              className="input"
              type="email"
              placeholder="البريد الإلكتروني"
              value={form.email}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
            />

            <select
              aria-label="صلاحية المستخدم الجديد"
              className="input"
              value={form.role}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  role: event.target.value as Role,
                }))
              }
            >
              <option value="ADMIN">مدير النظام</option>
              <option value="LAWYER">محامٍ</option>
              <option value="STAFF">موظف</option>
            </select>

            <input
              className="input"
              type="password"
              placeholder="كلمة المرور المؤقتة"
              value={form.password}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
            />

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary w-full"
            >
              {saving ? 'جاري الإضافة...' : 'إضافة المستخدم'}
            </button>
          </div>

          <div
            className="mt-5 rounded-2xl border p-3 text-xs leading-6"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-3)',
              background: 'var(--green-soft)',
            }}
          >
            الأفضل استخدام كلمة مرور مؤقتة قوية، ثم مطالبة المستخدم بتغييرها بعد
            أول دخول.
          </div>
        </form>

        {/* Team List */}
        <div className="card overflow-hidden p-0">
          <div
            className="flex items-center justify-between gap-4 border-b px-5 py-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <div>
              <h2 className="font-black" style={{ color: 'var(--text)' }}>
                أعضاء الفريق
              </h2>

              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                {filteredUsers.length} مستخدم ضمن النتائج الحالية
              </p>
            </div>

            <div className="hidden gap-2 sm:flex">
              <span className="badge badge-green">{lawyersCount} محامٍ</span>
              <span className="badge badge-gray">{staffCount} موظف</span>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="👥"
                title="لا يوجد أعضاء"
                sub={
                  users.length === 0
                    ? 'أضف أول مستخدم للفريق.'
                    : 'لا توجد نتائج مطابقة للفلاتر الحالية.'
                }
                action={
                  users.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="btn btn-ghost"
                    >
                      مسح الفلاتر
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-black text-white"
                      style={{
                        background: user.isActive ? 'var(--sidebar)' : '#9ca3af',
                      }}
                    >
                      {user.name?.charAt(0) || '؟'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className="truncate font-black"
                          style={{ color: 'var(--text)' }}
                        >
                          {user.name}
                        </p>

                        <span className={ROLE_BADGE[user.role]}>
                          {ROLE_AR[user.role]}
                        </span>

                        <span
                          className="rounded-full px-3 py-1 text-xs font-black"
                          style={
                            user.isActive
                              ? {
                                  background: 'var(--green-soft)',
                                  color: 'var(--sidebar)',
                                }
                              : {
                                  background: 'var(--red-soft)',
                                  color: '#dc2626',
                                }
                          }
                        >
                          {user.isActive ? 'مفعل' : 'معطل'}
                        </span>
                      </div>

                      <p
                        className="mt-1 truncate text-sm"
                        style={{ color: 'var(--text-3)' }}
                      >
                        {user.email}
                      </p>

                      <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                        تاريخ الإضافة: {formatDate(user.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      aria-label="تغيير صلاحية المستخدم"
                      title="تغيير صلاحية المستخدم"
                      className="input min-w-[150px]"
                      value={user.role}
                      onChange={(event) =>
                        updateUser(user.id, {
                          role: event.target.value as Role,
                        })
                      }
                    >
                      <option value="ADMIN">مدير النظام</option>
                      <option value="LAWYER">محامٍ</option>
                      <option value="STAFF">موظف</option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        updateUser(user.id, {
                          isActive: !user.isActive,
                        })
                      }
                      className="btn whitespace-nowrap"
                      style={
                        user.isActive
                          ? {
                              background: 'var(--red-soft)',
                              color: '#dc2626',
                            }
                          : {
                              background: 'var(--green-soft)',
                              color: 'var(--sidebar)',
                            }
                      }
                    >
                      {user.isActive ? 'تعطيل' : 'تفعيل'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}