export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{background:'var(--bg)'}}>
      <p className="text-8xl font-black" style={{color:'var(--sidebar)'}}>404</p>
      <p className="text-xl font-bold" style={{color:'var(--text)'}}>الصفحة غير موجودة</p>
      <a href="/dashboard" className="btn btn-primary">العودة للرئيسية</a>
    </div>
  )
}
