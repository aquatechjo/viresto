"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import DemoLoadingOverlay from "@/components/demo/DemoLoadingOverlay";
import { runDemoAction, useDemoMode } from "@/lib/demo/client";
import { useLocale } from "@/lib/useLocale";

// Dashboard card that opens demo mode. Shown only while the real office is
// on its trial (GET /api/demo says so); the server enforces the same rule.
export default function DemoModeCard() {
  const demo = useDemoMode();
  const { locale } = useLocale();
  const isArabic = locale === "ar";
  const [busy, setBusy] = useState(false);

  if (!demo || demo.inDemo || !demo.available) return null;

  async function enter() {
    setBusy(true);
    const message = await runDemoAction("enter");
    if (message) {
      setBusy(false);
      toast.error(message);
    }
  }

  return (
    <>
      <section
        data-testid="demo-mode-card"
        className="flex min-w-0 flex-col gap-4 rounded-2xl border border-teal-600/25 bg-teal-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-teal-300/20 dark:bg-teal-400/10"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--landing-copper)] text-[var(--landing-canvas)]">
            <FlaskConical className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black text-teal-950 dark:text-teal-50">
              {isArabic
                ? "شوف كيف بيكون شكل مكتبك مع بيانات"
                : "See what your office looks like with data"}
            </h2>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-teal-900/80 dark:text-teal-50/75">
              {isArabic
                ? "مكتب تجريبي فيه موكلين وقضايا وجلسات ومهام وفواتير وهمية. جرّب كل الميزات بحرية، ومكتبك الحقيقي ما بيتأثر."
                : "A sample office with fake clients, cases, sessions, tasks and invoices. Try every feature freely; your real office is not affected."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={enter}
          disabled={busy}
          data-testid="demo-enter"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--landing-copper)] text-[var(--landing-canvas)] hover:bg-[var(--landing-copper-hover)] px-5 py-2 text-sm font-black transition disabled:opacity-60"
        >
          {isArabic ? "جرّب ببيانات تجريبية" : "Try with sample data"}
        </button>
      </section>

      <DemoLoadingOverlay
        open={busy}
        title={isArabic ? "جارٍ تجهيز مكتبك التجريبي…" : "Preparing your sample office…"}
      />
    </>
  );
}
