"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenantAccessSummary } from "@/hooks/useTenantAccessSummary";
import { useLocale } from "@/lib/useLocale";

// Dashboard-wide warning in the last days of the free trial. Hidden on the
// billing page itself, which shows the full trial card instead.
export default function SubscriptionBanner() {
  const pathname = usePathname() ?? "";
  const access = useTenantAccessSummary(pathname);
  const { locale } = useLocale();
  const isArabic = locale === "ar";

  if (pathname.startsWith("/dashboard/billing")) return null;
  if (!access || access.state !== "TRIAL" || !access.trialEndingSoon) {
    return null;
  }

  const days = access.trialDaysLeft ?? 0;
  const message = isArabic
    ? days <= 1
      ? "تنتهي تجربتك المجانية خلال يوم. اشترك الآن حتى لا يتوقف الوصول إلى التطبيق."
      : `تنتهي تجربتك المجانية خلال ${days === 2 ? "يومين" : `${days} أيام`}. اشترك الآن حتى لا يتوقف الوصول إلى التطبيق.`
    : days <= 1
      ? "Your free trial ends within a day. Subscribe now to keep access to the app."
      : `Your free trial ends in ${days} days. Subscribe now to keep access to the app.`;

  return (
    <div
      role="alert"
      data-testid="trial-ending-banner"
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-50"
    >
      <span>{message}</span>
      <Link
        href="/dashboard/billing"
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--landing-copper)] px-4 py-2 font-black text-[var(--landing-canvas)] hover:bg-[var(--landing-copper-hover)]"
      >
        {isArabic ? "اشترك الآن" : "Subscribe now"}
      </Link>
    </div>
  );
}
