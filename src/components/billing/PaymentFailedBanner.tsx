"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useTenantAccessSummary } from "@/hooks/useTenantAccessSummary";
import { useLocale } from "@/lib/useLocale";

// Red, dashboard-wide: a renewal charge failed (Polar past_due). The office
// keeps full access while Polar retries, until Polar cancels the
// subscription or 7 days pass (pastDueLocksAt), whichever comes first.
export default function PaymentFailedBanner() {
  const pathname = usePathname() ?? "";
  const access = useTenantAccessSummary(pathname);
  const { locale } = useLocale();
  const isArabic = locale === "ar";
  const [opening, setOpening] = useState(false);

  if (!access?.paymentFailed) return null;

  const locksOn = access.pastDueLocksAt
    ? new Intl.DateTimeFormat(isArabic ? "ar-JO-u-nu-latn" : "en-US", {
        month: "long",
        day: "numeric",
      }).format(new Date(access.pastDueLocksAt))
    : null;

  const title = isArabic
    ? "فشل الدفع، يرجى تحديث بطاقتك"
    : "Payment failed, update your card";

  const detail = isArabic
    ? `لم ننجح في تجديد اشتراكك. يستمر الوصول الكامل${locksOn ? ` حتى ${locksOn}` : ""} ريثما تُحدّث وسيلة الدفع.`
    : `We couldn't renew your subscription. Full access continues${locksOn ? ` until ${locksOn}` : ""} while you update your payment method.`;

  async function openPortal() {
    setOpening(true);

    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.data?.url) {
        window.location.href = json.data.url;
        return;
      }

      toast.error(
        json.message ||
          (isArabic
            ? "تعذر فتح صفحة تحديث الدفع"
            : "Could not open the payment update page"),
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <div
      role="alert"
      data-testid="payment-failed-banner"
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-50"
    >
      <div className="min-w-0">
        <p className="font-black">{title}</p>
        <p className="mt-1 font-bold opacity-85">{detail}</p>
        {!access.canManageBilling && (
          <p className="mt-1 font-bold opacity-85">
            {isArabic
              ? "اطلب من مدير المكتب تحديث وسيلة الدفع."
              : "Ask your office admin to update the payment method."}
          </p>
        )}
      </div>

      {access.canManageBilling ? (
        <button
          type="button"
          onClick={() => void openPortal()}
          disabled={opening}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 py-2 font-black text-white hover:bg-red-700 disabled:opacity-70"
        >
          {opening
            ? isArabic
              ? "جاري الفتح..."
              : "Opening..."
            : isArabic
              ? "تحديث وسيلة الدفع"
              : "Update payment method"}
        </button>
      ) : (
        <Link
          href="/dashboard/billing"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 py-2 font-black text-white hover:bg-red-700"
        >
          {isArabic ? "صفحة الاشتراك" : "Billing page"}
        </Link>
      )}
    </div>
  );
}
