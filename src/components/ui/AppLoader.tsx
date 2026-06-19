"use client";

import { useLocale } from "@/lib/useLocale";

export default function AppLoader({
  text,
  fullScreen = true,
}: {
  text?: string;
  fullScreen?: boolean;
}) {
  const { locale } = useLocale();
  const isArabic = locale === "ar";

  const displayText =
    text ?? (isArabic ? "جاري تجهيز النظام..." : "Preparing the system...");

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className={`flex items-center justify-center ${
        fullScreen ? "min-h-screen" : "min-h-[calc(100vh-88px)]"
      }`}
      style={{
        background: "var(--bg, #f6faf7)",
        color: "var(--text, #0f241a)",
      }}
    >
      <div className="flex flex-col items-center gap-5">
        <div
          className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border shadow-[0_18px_55px_rgba(16,185,129,0.16)]"
          style={{
            background: "var(--card, #ffffff)",
            borderColor: "var(--border, rgba(16,185,129,0.22))",
          }}
        >
          <div
            className="absolute inset-0 animate-pulse rounded-3xl"
            style={{ background: "rgba(16,185,129,0.10)" }}
          />

          <div className="absolute -left-10 top-0 h-full w-8 rotate-12 animate-[loaderShine_1.6s_ease-in-out_infinite] bg-white/30 blur-sm" />

          <span
            className="relative text-2xl font-black"
            style={{ color: "var(--text, #0f241a)" }}
          >
            V
          </span>
        </div>

        <div className="text-center">
          <p
            className="text-lg font-black"
            style={{ color: "var(--text, #0f241a)" }}
          >
            Viresto
          </p>

          <p
            className="mt-1 text-sm font-bold"
            style={{ color: "var(--text-2, #5f7569)" }}
          >
            {displayText}
          </p>
        </div>

        <div
          className="h-1.5 w-44 overflow-hidden rounded-full"
          style={{ background: "var(--green-soft, rgba(16,185,129,0.10))" }}
        >
          <div
            className="h-full w-1/2 animate-[loadingBar_1.2s_ease-in-out_infinite] rounded-full"
            style={{ background: "var(--accent, #34d399)" }}
          />
        </div>
      </div>
    </div>
  );
}
