"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/ui/Modal";
import DemoLoadingOverlay from "@/components/demo/DemoLoadingOverlay";
import { runDemoAction, takeDemoEndedNotice, useDemoMode } from "@/lib/demo/client";
import { useLocale } from "@/lib/useLocale";

// Persistent banner on every dashboard page while in demo mode, with the
// way back to the real office and the reset. Importing it (from the
// dashboard layout) also installs the watcher in demo/client.ts that
// leaves demo mode the moment the server ends it.
export default function DemoModeBanner() {
  const demo = useDemoMode();
  const { locale } = useLocale();
  const isArabic = locale === "ar";
  const [busy, setBusy] = useState<"exit" | "reset" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (takeDemoEndedNotice()) {
      toast.info(
        isArabic
          ? "انتهى وضع التجربة. تمت إعادتك إلى مكتبك."
          : "Demo mode has ended. You are back in your office.",
      );
    }
  }, [isArabic]);

  if (!demo?.inDemo) return null;

  async function run(action: "exit" | "reset") {
    setConfirmReset(false);
    setBusy(action);
    const message = await runDemoAction(action);
    if (message) {
      setBusy(null);
      toast.error(message);
    }
  }

  return (
    <>
      <div
        role="region"
        aria-label={isArabic ? "وضع التجربة" : "Demo mode"}
        data-testid="demo-mode-banner"
        className="sticky top-[68px] z-30 mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--landing-copper)] bg-teal-950 p-3 text-white shadow-lg sm:top-[72px] sm:flex-row sm:items-center sm:justify-between xl:top-[84px]"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-black">
          <FlaskConical className="h-5 w-5 shrink-0 text-[var(--landing-copper)]" aria-hidden />
          {isArabic
            ? "أنت في وضع التجربة — البيانات وهمية"
            : "You are in demo mode — the data is fake"}
        </span>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => run("exit")}
            disabled={busy !== null}
            data-testid="demo-exit"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--landing-copper)] text-[var(--landing-canvas)] hover:bg-[var(--landing-copper-hover)] px-4 py-2 text-sm font-black transition disabled:opacity-60"
          >
            {isArabic ? "رجوع لمكتبي" : "Back to my office"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            disabled={busy !== null}
            data-testid="demo-reset"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/60 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            {isArabic ? "إعادة ضبط البيانات التجريبية" : "Reset sample data"}
          </button>
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={isArabic ? "إعادة ضبط البيانات التجريبية" : "Reset sample data"}
        size="sm"
      >
        <p className="text-sm font-semibold leading-relaxed" style={{ color: "var(--text-2)" }}>
          {isArabic
            ? "سيُحذف كل ما أضفته أو عدّلته في المكتب التجريبي، وتعود البيانات الوهمية كما كانت. مكتبك الحقيقي لا يتأثر."
            : "Everything you added or changed in the sample office is deleted and the sample data starts over. Your real office is not affected."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="min-h-10 rounded-xl border px-4 py-2 text-sm font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            {isArabic ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => run("reset")}
            data-testid="demo-reset-confirm"
            className="min-h-10 rounded-xl bg-[var(--landing-copper)] text-[var(--landing-canvas)] hover:bg-[var(--landing-copper-hover)] px-4 py-2 text-sm font-black"
          >
            {isArabic ? "إعادة الضبط" : "Reset"}
          </button>
        </div>
      </Modal>

      <DemoLoadingOverlay
        open={busy !== null}
        title={
          busy === "reset"
            ? isArabic ? "جارٍ إعادة ضبط البيانات التجريبية…" : "Resetting the sample data…"
            : isArabic ? "جارٍ الرجوع إلى مكتبك…" : "Going back to your office…"
        }
      />
    </>
  );
}
