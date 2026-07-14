'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'

export default function DashboardHeader() {
  const [notifications, setNotifications] = useState<any>(null)
  const [openNotifications, setOpenNotifications] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => setNotifications(d.data))
      .catch(() => setNotifications(null))
  }, [])

  useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    if (
      notificationRef.current &&
      !notificationRef.current.contains(e.target as Node)
    ) {
      setOpenNotifications(false)
    }
  }

  function handleScroll() {
    setOpenNotifications(false)
  }

  document.addEventListener('mousedown', handleClickOutside)
  window.addEventListener('scroll', handleScroll)

  return () => {
    document.removeEventListener('mousedown', handleClickOutside)
    window.removeEventListener('scroll', handleScroll)
  }
}, [])

  return (
    <div className="relative overflow-visible rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#185354] via-[#0f3d3e] to-[#082c2d] p-7 md:p-9 text-white shadow-2xl">

      <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-400/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-52 h-52 bg-green-300/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

        {/* Left Content */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-sm mb-4">
            <span className="w-2 h-2 rounded-full bg-copper-400" />
            نظام Viresto مفعل
          </div>

          <h1 className="text-3xl md:text-4xl font-black leading-tight">
            أهلاً بعودتك 👋
          </h1>

          <p className="text-white/70 mt-3 text-sm md:text-base max-w-lg leading-relaxed">
            إدارة القضايا، المواعيد، العملاء، والدفعات من مكان واحد بشكل احترافي وسريع.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 min-w-[120px]">
              <p className="text-white/60 text-xs">الخطة الحالية</p>
              <p className="font-bold mt-1">PRO</p>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 min-w-[120px]">
              <p className="text-white/60 text-xs">حالة النظام</p>
              <p className="font-bold mt-1 text-emerald-300">
                يعمل بكفاءة
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">

          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setOpenNotifications((v) => !v)}
              className="flex items-center justify-center h-12 w-12 rounded-2xl bg-white/10 border border-white/10 text-white backdrop-blur-xl hover:bg-white/15 transition-all relative"
              title="التنبيهات"
            >
              <Bell className="h-5 w-5" />

              {notifications?.count > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                  {notifications.count}
                </span>
              )}
            </button>

            {openNotifications && (
              <div className="absolute left-0 top-14 z-[99999] w-80 rounded-2xl bg-[#0f3d3e] text-white border border-white/10 p-4 shadow-2xl">

                <h3 className="font-bold mb-3 text-lg">
                  التنبيهات
                </h3>

                {notifications?.count > 0 ? (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">

                    {/* Appointments */}
                    {notifications.upcomingAppointments?.map((a: any) => (
                      <Link
                        key={a.id}
                        href="/dashboard/appointments"
                        className="block rounded-xl bg-emerald-500/15 text-emerald-100 border border-emerald-400/20 p-3 hover:bg-emerald-500/20 transition-all"
                      >
                        📅 موعد: {a.client?.name ?? 'بدون موكل'}
                      </Link>
                    ))}

                    {/* Payments */}
                    {notifications.pendingPayments?.map((p: any) => (
                      <Link
                        key={p.id}
                        href="/dashboard/payments"
                        className="block rounded-xl bg-yellow-500/15 text-yellow-100 border border-yellow-400/20 p-3 hover:bg-yellow-500/20 transition-all"
                      >
                        💰 دفعة معلقة: {p.case?.client?.name ?? 'بدون موكل'}
                      </Link>
                    ))}

                    {/* Tasks */}
                    {notifications.overdueTasks?.map((t: any) => (
                      <Link
                        key={t.id}
                        href="/dashboard/tasks"
                        className="block rounded-xl bg-red-500/15 text-red-100 border border-red-400/20 p-3 hover:bg-red-500/20 transition-all"
                      >
                        ⚠️ مهمة متأخرة: {t.title}
                      </Link>
                    ))}

                  </div>
                ) : (
                  <p className="text-sm text-white/60">
                    لا توجد تنبيهات حالياً
                  </p>
                )}

              </div>
            )}
          </div>

{/* New Case */}
<Link
  href="/dashboard/cases"
  className="flex items-center gap-2 h-12 px-4 py-2.5 rounded-2xl bg-copper-500 text-[#041819] font-bold shadow-lg shadow-black/10 hover:bg-copper-400 hover:scale-[1.02] hover:shadow-xl transition-all"
>
  <span className="text-lg leading-none">+</span>
  قضية جديدة
</Link>

{/* Add Appointment */}
<Link
  href="/dashboard/appointments"
  className="flex items-center gap-2 h-12 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 text-white/90 font-semibold backdrop-blur-xl hover:bg-white/15 transition-all"
>
  <span>📅</span>
  إضافة موعد
</Link>

          {/* Settings */}
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 h-12 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 text-white/90 font-semibold backdrop-blur-xl hover:bg-white/15 transition-all"
          >
            <span>⚙</span>
            الإعدادات
          </Link>

        </div>
      </div>
    </div>
  )
}
