"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenantAccessSummary } from "@/hooks/useTenantAccessSummary";
import { useLocale } from "@/lib/useLocale";

// Dashboard-wide: the office has more active users than its plan allows
// (after a downgrade, or a trial that ended on a smaller plan). Users
// beyond the limit are read-only (tenant-seats.ts). The admin sees who and
// how to fix it; a read-only member is told why writes fail.
export default function SeatLimitBanner() {
  const pathname = usePathname() ?? "";
  const access = useTenantAccessSummary(pathname);
  const { locale } = useLocale();
  const isArabic = locale === "ar";
  const seats = access?.seats;

  if (!access || access.state === "LOCKED" || !seats?.overLimit) return null;

  if (!access.canManageBilling) {
    if (!seats.readOnly) return null;

    return (
      <div
        role="alert"
        data-testid="seat-limit-banner"
        className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-50"
      >
        {isArabic
          ? "حسابك للقراءة فقط: عدد المستخدمين الفعّالين في المكتب أكبر من حد خطته. يمكنك عرض البيانات، ولا يمكنك الإضافة أو التعديل إلى أن يعطّل مدير المكتب بعض المستخدمين أو يرقّي الخطة."
          : "Your account is read-only: the office has more active users than its plan allows. You can view data, but not add or change anything until your office admin deactivates some users or upgrades the plan."}
      </div>
    );
  }

  const limit = seats.limit ?? 0;
  const names = seats.readOnlyUsers.map((user) => user.name).join(isArabic ? "، " : ", ");
  const extra = seats.readOnlyUsers.length;

  const title = isArabic
    ? `خطة ${seats.planName} تسمح بـ ${limit} ${limit === 1 ? "مستخدم" : "مستخدمين"}، وفي المكتب ${seats.activeCount} مستخدمين فعّالين.`
    : `The ${seats.planName} plan includes ${limit} ${limit === 1 ? "user" : "users"}, and the office has ${seats.activeCount} active users.`;

  const detail = isArabic
    ? `${extra === 1 ? "المستخدم الزائد صار" : `المستخدمون الزائدون (${extra}) صاروا`} للقراءة فقط: ${names}. لا يُحذف أي شيء. عطّل من لا يحتاج الوصول من صفحة الفريق، أو رقِّ الخطة، ليعود الوصول الكامل فورًا.`
    : `${extra === 1 ? "The extra user is" : `The ${extra} extra users are`} now read-only: ${names}. Nothing is deleted. Deactivate members who don't need access on the Team page, or upgrade the plan, to restore full access right away.`;

  return (
    <div
      role="alert"
      data-testid="seat-limit-banner"
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 lg:flex-row lg:items-center lg:justify-between dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-50"
    >
      <div className="min-w-0">
        <p className="font-black">{title}</p>
        <p className="mt-1 font-bold opacity-85">{detail}</p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href="/dashboard/team"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 px-4 py-2 font-black hover:bg-amber-100 dark:border-amber-300/40 dark:hover:bg-amber-500/20"
        >
          {isArabic ? "إدارة الفريق" : "Manage team"}
        </Link>
        <Link
          href="/dashboard/billing"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--landing-copper)] px-4 py-2 font-black text-[var(--landing-canvas)] hover:bg-[var(--landing-copper-hover)]"
        >
          {isArabic ? "ترقية الخطة" : "Upgrade plan"}
        </Link>
      </div>
    </div>
  );
}
