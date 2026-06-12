export default function AppLoader({
  text = "جاري تجهيز النظام...",
  fullScreen = true,
}: {
  text?: string
  fullScreen?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-center bg-[#06170f] ${
        fullScreen ? "min-h-screen" : "min-h-[calc(100vh-88px)]"
      }`}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-emerald-300/25 bg-white/[0.06] shadow-[0_18px_55px_rgba(16,185,129,0.18)]">
          <div className="absolute inset-0 animate-pulse rounded-3xl bg-emerald-300/10" />
          <div className="absolute -left-10 top-0 h-full w-8 rotate-12 animate-[loaderShine_1.6s_ease-in-out_infinite] bg-white/20 blur-sm" />

          <span className="relative text-2xl font-black text-white">V</span>
        </div>

        <div className="text-center">
          <p className="text-lg font-black text-white">Viresto</p>
          <p className="mt-1 text-sm font-bold text-emerald-100/55">
            {text}
          </p>
        </div>

        <div className="h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-[loadingBar_1.2s_ease-in-out_infinite] rounded-full bg-emerald-300/70" />
        </div>
      </div>
    </div>
  )
}