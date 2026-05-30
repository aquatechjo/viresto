'use client'
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ar" dir="rtl"><body>
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1rem',fontFamily:'Cairo,sans-serif'}}>
        <p style={{fontSize:'3rem'}}>💥</p>
        <p style={{fontWeight:800,fontSize:'1.25rem'}}>خطأ فادح في التطبيق</p>
        <button onClick={reset} style={{background:'#2d4a3e',color:'#fff',padding:'.5rem 1.5rem',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:'Cairo,sans-serif',fontWeight:700}}>إعادة تحميل</button>
      </div>
    </body></html>
  )
}
