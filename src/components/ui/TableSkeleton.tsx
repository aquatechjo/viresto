export default function TableSkeleton({
  rows = 5,
}: {
  rows?: number
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-2xl border border-white/10 bg-white/5"
        />
      ))}
    </div>
  )
}