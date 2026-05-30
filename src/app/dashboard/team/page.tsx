'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Role = 'ADMIN' | 'LAWYER' | 'STAFF'

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

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'LAWYER' as Role,
    password: '',
  })

  async function loadUsers() {
    const res = await fetch('/api/team')
    const data = await res.json()

    if (data.success) {
    setUsers(Array.isArray(data.data?.users) ? data.data.users : [])
    setRole(data.data?.currentRole || '')
    } else {
      toast.error(data.message || 'تعذر تحميل الفريق')
    }

    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (data.success) {
      toast.success('تمت إضافة المستخدم')
      setForm({
        name: '',
        email: '',
        role: 'LAWYER',
        password: '',
      })
      loadUsers()
    } else {
      toast.error(data.message || 'حدث خطأ')
    }

    setSaving(false)
  }

  async function updateUser(id: string, payload: Partial<TeamUser>) {
    const res = await fetch(`/api/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (data.success) {
      toast.success('تم تحديث المستخدم')
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? data.data : u))
      )
    } else {
      toast.error(data.message || 'تعذر التحديث')
    }
  }

  if (loading) {
  return (
    <div className="card p-10 rounded-3xl text-center">
      جاري التحميل...
    </div>
  )
}


  if (role && role !== 'ADMIN') {
  return (
    <div className="card p-10 rounded-3xl text-center">
      <h1 className="text-2xl font-black">
        غير مصرح
      </h1>

      <p className="text-gray-500 mt-3">
         فقط مدير النظام يستطيع إدارة الفريق.
      </p>
    </div>
  )
}

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-3xl font-black">إدارة الفريق</h1>
        <p className="text-sm text-gray-500 mt-2">
          أضف مستخدمين للمكتب وحدد صلاحيات الدخول للنظام.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        <form
          onSubmit={addUser}
          className="card p-6 rounded-3xl space-y-4"
        >
          <div>
            <h2 className="text-xl font-bold">إضافة مستخدم</h2>
            <p className="text-sm text-gray-500 mt-1">
              المستخدم الجديد سيدخل باستخدام البريد وكلمة المرور.
            </p>
          </div>

          <input
            className="input"
            placeholder="الاسم الكامل"
            value={form.name}
            onChange={(e) =>
              setForm((p) => ({ ...p, name: e.target.value }))
            }
          />

          <input
            className="input"
            type="email"
            placeholder="البريد الإلكتروني"
            value={form.email}
            onChange={(e) =>
              setForm((p) => ({ ...p, email: e.target.value }))
            }
          />

          <select
            aria-label="تغيير صلاحية المستخدم"
            title="تغيير صلاحية المستخدم"
            className="input"
            value={form.role}
            onChange={(e) =>
              setForm((p) => ({ ...p, role: e.target.value as Role }))
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
            onChange={(e) =>
              setForm((p) => ({ ...p, password: e.target.value }))
            }
          />

          <button
            disabled={saving}
            className="btn btn-primary w-full"
          >
            {saving ? 'جاري الإضافة...' : 'إضافة المستخدم'}
          </button>
        </form>

        <div className="lg:col-span-2 card p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-gray-500">
              {users.length} مستخدم
            </p>
            <h2 className="text-xl font-bold">أعضاء الفريق</h2>
          </div>

          {loading ? (
            <p className="text-center py-10 text-gray-500">
              جاري التحميل...
            </p>
          ) : (
            <div className="space-y-3">
              {Array.isArray(users) && users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border bg-white"
                >
                  <div>
                    <p className="font-bold">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                     aria-label="تغيير صلاحية المستخدم"
                     title="تغيير صلاحية المستخدم"
                      className="input min-w-[140px]"
                      value={user.role}
                      onChange={(e) =>
                        updateUser(user.id, {
                          role: e.target.value as Role,
                        })
                      }
                    >
                     <option value="ADMIN">مدير النظام</option>
                     <option value="LAWYER">محامٍ</option>
                     <option value="STAFF">موظف</option>
                    </select>

                    <button
                      onClick={() =>
                        updateUser(user.id, {
                          isActive: !user.isActive,
                        })
                      }
                      className={`px-4 py-2 rounded-xl text-sm font-bold ${
                        user.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.isActive ? 'مفعل' : 'معطل'}
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