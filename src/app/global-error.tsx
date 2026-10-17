'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ar" dir="rtl"><body style={{margin:0,background:'#041819',color:'#f8fbfa'}}>
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1rem',fontFamily:'Cairo,sans-serif'}}>
        <p style={{fontSize:'3rem'}}>💥</p>
        <p style={{fontWeight:800,fontSize:'1.25rem'}}>خطأ فادح</p>
        <button onClick={reset} style={{background:'#b87333',color:'#041819',padding:'.5rem 1.5rem',borderRadius:'10px',border:'none',cursor:'pointer',fontFamily:'Cairo,sans-serif',fontWeight:700}}>إعادة تحميل</button>
      </div>
    </body></html>
  )
}
