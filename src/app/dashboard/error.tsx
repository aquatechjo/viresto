'use client'
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-4xl">⚠️</p>
      <p className="font-bold text-lg" style={{color:'var(--text)'}}>حدث خطأ غير متوقع</p>
      <p className="text-sm" style={{color:'var(--text-3)'}}>{error.message}</p>
      <button onClick={reset} className="btn btn-primary">إعادة المحاولة</button>
    </div>
  )
}
