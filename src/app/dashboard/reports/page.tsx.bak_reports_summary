'use client'
import { useEffect,useState,useCallback } from 'react'
import PageLoader from '@/components/ui/PageLoader'
import { formatCurrency } from '@/lib/utils'

const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

interface CaseData { status:string; feeAgreed:number; payments:{amount:number;status:string;paidAt:string}[] }

export default function ReportsPage() {
  const [cases,setCases]     = useState<CaseData[]>([])
  const [year,setYear]       = useState(new Date().getFullYear())
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('yearly')
  const [month, setMonth] = useState(new Date().getMonth())
  const [loading,setLoading] = useState(true)

  const load = useCallback(async()=>{
    setLoading(true)
    const r=await fetch('/api/cases')
    const d=await r.json()
    setCases(d.data?.data ?? [])
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])

  const totalFees  = cases.reduce((s,c)=>s+c.feeAgreed,0)
  const totalPaid  = cases.reduce((s,c)=>s+c.payments.filter(p=>p.status==='PAID').reduce((ss,p)=>ss+p.amount,0),0)
  const rate       = totalFees>0?Math.round((totalPaid/totalFees)*100):0
  const avg        = cases.length>0?Math.round(totalFees/cases.length):0
  const open       = cases.filter(c=>['OPEN','IN_PROGRESS'].includes(c.status)).length
  const pending    = cases.filter(c=>c.status==='IN_PROGRESS').length
  const closed     = cases.filter(c=>['CLOSED','ARCHIVED'].includes(c.status)).length
  const total      = cases.length

  const monthly = Array(12).fill(0).map((_,i)=>
    cases.reduce((s,c)=>s+c.payments.filter(p=>{ const d=new Date(p.paidAt); return p.status==='PAID'&&d.getFullYear()===year&&d.getMonth()===i }).reduce((ss,p)=>ss+p.amount,0),0)
  )
  const maxM = Math.max(...monthly,1)
const filteredPayments =
  reportType === 'monthly'
    ? cases
        .flatMap(c => c.payments)
        .filter((p) => {
          const d = new Date(p.paidAt)
          return (
            p.status === 'PAID' &&
            d.getMonth() === month &&
            d.getFullYear() === year
          )
        })
    : cases
        .flatMap(c => c.payments)
        .filter((p) => {
          const d = new Date(p.paidAt)
          return (
            p.status === 'PAID' &&
            d.getFullYear() === year
          )
        })

const totalRevenue = filteredPayments.reduce(
  (sum, p) => sum + p.amount,
  0
)

  // SVG Donut
  function DonutChart(){
    const r=58,cx=80,cy=80,sw=20,circ=2*Math.PI*r
    const segs=[ {pct:total>0?(open/total)*100:60,color:'var(--sidebar)'}, {pct:total>0?(pending/total)*100:22,color:'var(--gold)'}, {pct:total>0?(closed/total)*100:18,color:'#d1d5db'} ]
    let off=0
    return (
      <svg viewBox="0 0 160 160" className="w-full max-w-[180px]">
        {segs.map((seg,i)=>{
          const dash=(seg.pct/100)*circ, gap=circ-dash
          const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-off*circ/100} transform={`rotate(-90 ${cx} ${cy})`} style={{transition:'all .5s ease'}}/>
          off+=seg.pct; return el
        })}
        <text x={cx} y={cy-6} textAnchor="middle" fill="var(--text)" style={{fontSize:18,fontFamily:'Cairo',fontWeight:700}}>{total}</text>
        <text x={cx} y={cy+14} textAnchor="middle" fill="var(--text-3)" style={{fontSize:11,fontFamily:'Cairo'}}>قضية</text>
      </svg>
    )
  }

  if(loading) return <PageLoader/>

  return (
  <>
  <style jsx global>{`
  @media print {
    aside,
    header,
    nav {
      display: none !important;
    }

    body {
      background: white !important;
    }
  }
`}</style>
  <div className="mb-6">
  <h1 className="text-3xl font-black" style={{ color: 'var(--text)' }}>
    {reportType === 'monthly'
      ? `تقرير ${MONTHS[month]} ${year}`
      : `التقرير السنوي ${year}`}
  </h1>

  <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
    تقارير مالية وإحصائية شاملة للمكتب
  </p>
</div>
    
    
    <div className="space-y-5 stagger">
      {/* Year selector */}
<div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between print:hidden">
  <div className="flex gap-3">
    <select
      aria-label="نوع التقرير"
      title="نوع التقرير"
      value={reportType}
      onChange={(e) => setReportType(e.target.value as 'monthly' | 'yearly')}
      className="input w-40"
    >
      <option value="yearly">تقرير سنوي</option>
      <option value="monthly">تقرير شهري</option>
    </select>

    {reportType === 'monthly' && (
      <select
        aria-label="الشهر"
        title="الشهر"
        value={month}
        onChange={(e) => setMonth(+e.target.value)}
        className="input w-40"
      >
        
        {MONTHS.map((m, i) => (
          <option key={m} value={i}>{m}</option>
        ))}
      </select>
    )}

    <select
      aria-label="السنة"
      title="السنة"
      value={year}
      onChange={(e) => setYear(+e.target.value)}
      className="input w-32"
    >
      {[2023, 2024, 2025, 2026].map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  </div>

  <button
    onClick={() => window.print()}
    className="btn btn-primary"
  >
    طباعة التقرير
  </button>
</div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
  l: reportType === 'monthly'
    ? `إيرادات ${MONTHS[month]}`
    : 'إجمالي الإيرادات',
  v: formatCurrency(totalRevenue)
},
          {l:'عدد القضايا',v:total},
          {l:'نسبة التحصيل',v:`${rate}%`},
          {l:'متوسط القضية',v:formatCurrency(avg)},
        ].map(k=>(
          <div key={k.l} className="card p-5 text-center">
            <p className="text-xs font-semibold mb-1" style={{color:'var(--text-3)'}}>{k.l}</p>
            <p className="text-2xl font-black" style={{color:'var(--text)'}}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Donut */}
        <div className="card p-5 flex flex-col items-center">
          <p className="font-bold text-sm mb-4 self-end" style={{color:'var(--text)'}}>حالة القضايا</p>
          <DonutChart/>
          <div className="mt-4 space-y-2 self-start w-full">
            {[{l:`نشطة ${total>0?Math.round((open/total)*100):60}%`,c:'var(--sidebar)'},{l:`جارية ${total>0?Math.round((pending/total)*100):22}%`,c:'var(--gold)'},{l:`مغلقة ${total>0?Math.round((closed/total)*100):18}%`,c:'#d1d5db'}].map(i=>(
              <div key={i.l} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{background:i.c}}/>
                <span className="text-xs" style={{color:'var(--text-2)'}}>{i.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="card p-5 col-span-2">
          <p className="font-bold text-sm mb-5" style={{color:'var(--text)'}}>الإيرادات الشهرية ({year})</p>
          <div className="flex items-end justify-between gap-1 h-44">
            {monthly.map((v,i)=>(
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full rounded-t-lg transition-all duration-700"
                  style={{height:`${(v/maxM)*100}%`,minHeight:v>0?6:2,background:v>0?'var(--sidebar)':'var(--border)',opacity:v>0?1:.3}}/>
                <span style={{color:'var(--text-3)',fontSize:9}}>{MONTHS[i].slice(0,3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
            <div className="card p-0 overflow-hidden">
  <div className="p-5 border-b">
    <h2 className="text-xl font-black">
      {reportType === 'monthly'
        ? 'الحركات المالية الشهرية'
        : 'الحركات المالية السنوية'}
    </h2>
  </div>

  <div className="overflow-x-auto">
    <table className="data-table">
      <thead>
        <tr>
          <th>القضية</th>
          <th>الموكل</th>
          <th>المبلغ</th>
          <th>الحالة</th>
          <th>التاريخ</th>
        </tr>
      </thead>

<tbody>
  {cases.map((c: any) =>
    (c.payments || []).map((p: any, i: number) => (
      <tr key={`${c.id}-${i}`}>
        <td>{c.title}</td>
        <td>{c.clientName || '-'}</td>
        <td>{formatCurrency(p.amount)}</td>
        <td>{p.status === 'PAID' ? 'مدفوع' : 'معلق'}</td>
        <td>{new Date(p.paidAt || Date.now()).toLocaleDateString('ar-JO')}</td>
      </tr>
    ))
  )}
</tbody>
    </table>
  </div>
</div>
    </div>
      </>

  )
}
