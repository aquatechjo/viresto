import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSystemAdmin } from '@/lib/system-admin'
import {
  suspendTenant,
  activateTenant,
  deactivateUser,
  activateUser,
  updateTenantBilling,
} from './actions'
import { PLAN_META, STATUS_LABELS } from '@/lib/plans'

const planOptions = ['FREE', 'PRO', 'ENTERPRISE'] as const
const statusOptions = ['ACTIVE', 'TRIAL', 'EXPIRED', 'SUSPENDED'] as const

export default async function AdminPage() {
  try {
    await requireSystemAdmin()
  } catch {
    redirect('/login')
  }

  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          clients: true,
          cases: true,
          payments: true,
          documents: true,
          invoices: true,
        },
      },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isSystemAdmin: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main className="p-8 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-black mb-2">لوحة إدارة النظام</h1>
        <p className="text-sm opacity-70">
          إدارة المكاتب، الحسابات، الخطط، حدود المستخدمين، وحالة الاشتراكات.
        </p>
      </div>

      <div className="grid gap-5">
        {tenants.map((tenant) => {
          const hasSystemAdmin = tenant.users.some((user) => user.isSystemAdmin)
          const trialValue = tenant.trialEndsAt
            ? tenant.trialEndsAt.toISOString().slice(0, 10)
            : ''

          return (
            <section
              key={tenant.id}
              className="rounded-2xl border bg-white p-5 shadow-sm space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{tenant.name}</h2>

                  <p className="text-sm opacity-70">
                    Slug: {tenant.slug} | Plan: {tenant.plan} | Status:{' '}
                    {tenant.status}
                  </p>

                  <p className="text-sm opacity-70">
                    المستخدمون: {tenant._count.users} | الموكلون:{' '}
                    {tenant._count.clients} | القضايا: {tenant._count.cases} |
                    المدفوعات: {tenant._count.payments} | الفواتير:{' '}
                    {tenant._count.invoices} | المستندات:{' '}
                    {tenant._count.documents}
                  </p>

                  <p className="text-sm opacity-70">
                    انتهاء التجربة:{' '}
                    {tenant.trialEndsAt
                      ? tenant.trialEndsAt.toLocaleDateString('ar-JO')
                      : '-'}
                  </p>
                </div>

                <div>
                  {hasSystemAdmin ? (
                    <span className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-500">
                      مكتب النظام الرئيسي - محمي
                    </span>
                  ) : tenant.isSuspended ? (
                    <form action={activateTenant.bind(null, tenant.id)}>
                      <button className="rounded-xl bg-green-600 px-4 py-2 text-white">
                        تفعيل المكتب
                      </button>
                    </form>
                  ) : (
                    <form action={suspendTenant.bind(null, tenant.id)}>
                      <button className="rounded-xl bg-red-600 px-4 py-2 text-white">
                        تعليق المكتب
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <form
                action={updateTenantBilling.bind(null, tenant.id)}
                className="rounded-2xl border bg-gray-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black">إعدادات الاشتراك</h3>
                    <p className="text-xs text-gray-500">
                      عدّل الخطة، حالة الاشتراك، وعدد المستخدمين المسموح لهذا المكتب.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <label className="space-y-1 text-sm">
                    <span className="font-bold">الخطة</span>
                    <select
                      name="plan"
                      defaultValue={tenant.plan}
                      className="w-full rounded-xl border px-3 py-2"
                    >
                      {planOptions.map((plan) => (
                        <option key={plan} value={plan}>
                          {PLAN_META[plan].nameAr} - {plan}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-bold">الحالة</span>
                    <select
                      name="status"
                      defaultValue={tenant.status}
                      className="w-full rounded-xl border px-3 py-2"
                      disabled={hasSystemAdmin}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]} - {status}
                        </option>
                      ))}
                    </select>
                    {hasSystemAdmin && (
                      <input type="hidden" name="status" value={tenant.status} />
                    )}
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-bold">Max Users</span>
                    <input
                      name="maxUsers"
                      type="number"
                      min={1}
                      max={10000}
                      defaultValue={tenant.maxUsers}
                      className="w-full rounded-xl border px-3 py-2"
                    />
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-bold">Trial Ends</span>
                    <input
                      name="trialEndsAt"
                      type="date"
                      defaultValue={trialValue}
                      className="w-full rounded-xl border px-3 py-2"
                    />
                  </label>

                  <div className="flex items-end">
                    <button className="w-full rounded-xl bg-[#17352b] px-4 py-2 text-sm font-bold text-white">
                      حفظ الاشتراك
                    </button>
                  </div>
                </div>
              </form>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-start">الاسم</th>
                      <th className="p-3 text-start">الإيميل</th>
                      <th className="p-3 text-start">الدور</th>
                      <th className="p-3 text-start">System Admin</th>
                      <th className="p-3 text-start">الحالة</th>
                      <th className="p-3 text-start">تاريخ الإنشاء</th>
                      <th className="p-3 text-start">إجراء</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tenant.users.map((user) => (
                      <tr key={user.id} className="border-t">
                        <td className="p-3 font-medium">{user.name}</td>
                        <td className="p-3">{user.email}</td>
                        <td className="p-3">{user.role}</td>

                        <td className="p-3">
                          {user.isSystemAdmin ? 'نعم' : 'لا'}
                        </td>

                        <td className="p-3">
                          {user.isActive ? 'نشط' : 'معطل'}
                        </td>

                        <td className="p-3">
                          {user.createdAt.toLocaleDateString('ar-JO')}
                        </td>

                        <td className="p-3">
                          {user.isSystemAdmin ? (
                            <span className="rounded-lg bg-gray-100 px-3 py-1 text-sm text-gray-500">
                              محمي
                            </span>
                          ) : user.isActive ? (
                            <form action={deactivateUser.bind(null, user.id)}>
                              <button className="rounded-lg bg-red-600 px-3 py-1 text-white">
                                تعطيل
                              </button>
                            </form>
                          ) : (
                            <form action={activateUser.bind(null, user.id)}>
                              <button className="rounded-lg bg-green-600 px-3 py-1 text-white">
                                تفعيل
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
