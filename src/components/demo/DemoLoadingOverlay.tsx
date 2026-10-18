"use client";

import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/lib/useLocale";

// Full-screen state while the sample office is built (or rebuilt). Blocks
// the page so the user cannot fire the action twice.
export default function DemoLoadingOverlay({
  open,
  title,
}: {
  open: boolean;
  title: string;
}) {
  const { isRtl, locale } = useLocale();

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      dir={isRtl ? "rtl" : "ltr"}
      role="status"
      aria-live="polite"
      data-testid="demo-loading"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border p-8 text-center shadow-2xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <Loader2 className="h-10 w-10 text-indigo-600 motion-safe:animate-spin dark:text-indigo-300" aria-hidden />
        <p className="text-base font-black" style={{ color: "var(--text)" }}>
          {title}
        </p>
        <p className="text-sm font-semibold" style={{ color: "var(--text-3)" }}>
          {locale === "ar"
            ? "موكلين وقضايا وجلسات ومهام وفواتير… عادةً تأخذ ثوانٍ قليلة."
            : "Clients, cases, sessions, tasks and invoices… usually a few seconds."}
        </p>
      </div>
    </div>,
    document.body,
  );
}
