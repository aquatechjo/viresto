export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="min-w-0 animate-pulse space-y-4"
    >
      <div className="h-20 rounded-2xl border border-emerald-500/10 bg-emerald-500/5" />

      <div className="rounded-[28px] border border-emerald-500/10 bg-emerald-500/5 p-5">
        <div className="h-5 w-36 rounded-full bg-emerald-100/10" />
        <div className="mt-5 h-9 w-64 max-w-full rounded-xl bg-emerald-100/10" />
        <div className="mt-3 h-4 w-80 max-w-full rounded-full bg-emerald-100/10" />
        <div className="mt-6 h-12 rounded-2xl bg-emerald-100/10" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-44 rounded-[24px] border border-emerald-500/10 bg-emerald-500/5"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="h-72 rounded-[24px] border border-emerald-500/10 bg-emerald-500/5" />
        <div className="h-72 rounded-[24px] border border-emerald-500/10 bg-emerald-500/5" />
      </div>
    </div>
  );
}
