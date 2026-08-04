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

  if (!fullScreen) {
    return (
      <div
        dir={isArabic ? "rtl" : "ltr"}
        aria-busy="true"
        aria-label={displayText}
        role="status"
        className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-5"
      >
        <div
          className="animate-pulse rounded-[24px] border p-4 sm:p-5"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div
                className="h-7 w-44 max-w-[70%] rounded-xl"
                style={{ background: "var(--green-soft)" }}
              />
              <div
                className="h-4 w-80 max-w-full rounded-full"
                style={{ background: "var(--green-soft)" }}
              />
            </div>

            <div
              className="h-11 w-36 shrink-0 rounded-2xl"
              style={{ background: "var(--green-soft)" }}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-20 rounded-2xl border"
                style={{
                  background: "var(--surface-2, var(--green-soft))",
                  borderColor: "var(--border)",
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="animate-pulse overflow-hidden rounded-[24px] border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="h-11 min-w-0 flex-1 rounded-2xl"
              style={{ background: "var(--green-soft)" }}
            />
            <div className="flex gap-2">
              <div
                className="h-11 w-24 rounded-2xl"
                style={{ background: "var(--green-soft)" }}
              />
              <div
                className="h-11 w-11 rounded-2xl"
                style={{ background: "var(--green-soft)" }}
              />
            </div>
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="grid min-h-16 grid-cols-[44px_minmax(0,1fr)_80px] items-center gap-3 rounded-2xl border px-3 py-2 sm:grid-cols-[48px_minmax(0,1.4fr)_minmax(120px,.7fr)_96px] sm:px-4"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="h-10 w-10 rounded-xl"
                  style={{ background: "var(--green-soft)" }}
                />
                <div className="min-w-0 space-y-2">
                  <div
                    className="h-4 w-2/3 rounded-full"
                    style={{ background: "var(--green-soft)" }}
                  />
                  <div
                    className="h-3 w-1/2 rounded-full"
                    style={{ background: "var(--green-soft)" }}
                  />
                </div>
                <div
                  className="hidden h-4 w-24 rounded-full sm:block"
                  style={{ background: "var(--green-soft)" }}
                />
                <div
                  className="h-9 w-20 rounded-xl"
                  style={{ background: "var(--green-soft)" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="flex min-h-screen items-center justify-center"
      style={{
        background: "var(--bg, #f7faf9)",
        color: "var(--text, #082526)",
      }}
    >
      <div className="flex flex-col items-center gap-5">
        <div
          className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border shadow-[0_18px_55px_rgba(53,138,136,0.16)]"
          style={{
            background: "var(--card, #ffffff)",
            borderColor: "var(--border, rgba(53,138,136,0.22))",
          }}
        >
          <div
            className="absolute inset-0 animate-pulse rounded-3xl"
            style={{ background: "rgba(53,138,136,0.10)" }}
          />

          <div className="absolute -left-10 top-0 h-full w-8 rotate-12 animate-[loaderShine_1.6s_ease-in-out_infinite] bg-white/30 blur-sm" />

          <span
            className="relative text-2xl font-black"
            style={{ color: "var(--text, #082526)" }}
          >
            V
          </span>
        </div>

        <div className="text-center">
          <p
            className="text-lg font-black"
            style={{ color: "var(--text, #082526)" }}
          >
            Viresto
          </p>

          <p
            className="mt-1 text-sm font-bold"
            style={{ color: "var(--text-2, #647c7c)" }}
          >
            {displayText}
          </p>
        </div>

        <div
          className="h-1.5 w-44 overflow-hidden rounded-full"
          style={{ background: "var(--green-soft, rgba(53,138,136,0.10))" }}
        >
          <div
            className="h-full w-1/2 animate-[loadingBar_1.2s_ease-in-out_infinite] rounded-full"
            style={{ background: "var(--accent, #b87333)" }}
          />
        </div>
      </div>
    </div>
  );
}
