"use client";

import type { TenantAccessSummary } from "@/lib/tenant-write-access-cache";

interface TrialStatusCardProps {
  access: TenantAccessSummary | null | undefined;
  isArabic: boolean;
  canSubscribe: boolean;
  onSubscribe?: () => void;
}

function formatTrialDate(value: string | null, isArabic: boolean) {
  if (!value) return "";

  return new Intl.DateTimeFormat(isArabic ? "ar-JO-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function daysPhrase(days: number, isArabic: boolean) {
  if (!isArabic) return days === 1 ? "1 day left" : `${days} days left`;
  if (days === 1) return "بقي يوم واحد";
  if (days === 2) return "بقي يومان";
  if (days <= 10) return `بقي ${days} أيام`;
  return `بقي ${days} يومًا`;
}

// Billing page headline for the free in-app trial and the locked state.
// Renders nothing for a paying office.
export default function TrialStatusCard({
  access,
  isArabic,
  canSubscribe,
  onSubscribe,
}: TrialStatusCardProps) {
  if (!access || access.state === "PAID") return null;

  const locked = access.state === "LOCKED";
  const endsOn = formatTrialDate(access.trialEndsAt, isArabic);
  const days = access.trialDaysLeft ?? 0;
  const urgent = locked || access.trialEndingSoon;

  const title = locked
    ? access.lockReason === "TRIAL_EXPIRED"
      ? isArabic
        ? "انتهت التجربة المجانية"
        : "Your free trial has ended"
      : isArabic
        ? "لا يوجد اشتراك فعّال"
        : "No active subscription"
    : isArabic
      ? `تجربة مجانية: ${daysPhrase(days, true)}، تنتهي في ${endsOn}`
      : `Free trial: ${daysPhrase(days, false)}, ends on ${endsOn}`;

  const body = locked
    ? isArabic
      ? "الوصول إلى التطبيق متوقف حتى تشترك. بياناتك محفوظة بالكامل، ويعود كل شيء فور إتمام الدفع."
      : "The app is paused until you subscribe. All your data is kept, and everything unlocks as soon as payment completes."
    : isArabic
      ? "تستخدم الآن كل مزايا خطة Pro مجانًا. هذه تجربة وليست اشتراكًا مدفوعًا، فاشترك قبل انتهائها لتستمر دون انقطاع."
      : "You have every Pro feature for free. This is a trial, not a paid plan: subscribe before it ends to keep going without interruption.";

  const memberNote = isArabic
    ? "اطلب من مدير المكتب إتمام الاشتراك."
    : "Ask your office admin to subscribe.";

  return (
    <div
      role={urgent ? "alert" : "status"}
      data-testid="trial-status-card"
      className={[
        "flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:justify-between",
        locked
          ? "border-red-200 bg-red-50 text-red-900 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-50"
          : urgent
            ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-50"
            : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-[var(--brand-surface-hover)] dark:text-emerald-50",
      ].join(" ")}
    >
      <div className="min-w-0">
        <p className="text-lg font-black">{title}</p>
        <p className="mt-1 text-sm font-bold opacity-80">{body}</p>
        {!canSubscribe && (
          <p className="mt-1 text-sm font-bold opacity-80">{memberNote}</p>
        )}
      </div>

      {canSubscribe && onSubscribe && (
        <button
          type="button"
          onClick={onSubscribe}
          className="min-h-11 shrink-0 rounded-2xl bg-[var(--landing-copper)] px-6 py-3 text-sm font-black text-[var(--landing-canvas)] shadow-lg shadow-black/10 transition hover:bg-[var(--landing-copper-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-copper-hover)]"
        >
          {isArabic ? "اشترك الآن" : "Subscribe now"}
        </button>
      )}
    </div>
  );
}
