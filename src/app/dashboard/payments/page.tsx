'use client'
import { useEffect,useState,useCallback } from 'react'
import PageLoader from '@/components/ui/PageLoader'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency,formatDate } from '@/lib/utils'

interface CaseSummary { id:string;caseNumber?:string;title:string;feeAgreed:number;client:{name:string};payments:{amount:number;status:string}[] }

export default function PaymentsPage() {
  const [cases,setCases]     = useState<CaseSummary[]>([])
  const [loading,setLoading] = useState(true)

  const load = useCallback(async()=>{
    setLoading(true)
    const r=await fetch('/api/cases')
    const d=await r.json()
    setCases(d.data?.data ?? [])
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])

  const totalFees   = cases.reduce((s,c)=>s+c.feeAgreed,0)
  const totalPaid   = cases.reduce((s,c)=>s+c.payments.filter(p=>p.status==='PAID').reduce((ss,p)=>ss+p.amount,0),0)
  const totalPend   = cases.reduce((s,c)=>s+c.payments.filter(p=>p.status==='PENDING').reduce((ss,p)=>ss+p.amount,0),0)

  function paid(c:CaseSummary){ return c.payments.filter(p=>p.status==='PAID').reduce((s,p)=>s+p.amount,0) }
  function pct(c:CaseSummary){ return c.feeAgreed>0?Math.min((paid(c)/c.feeAgreed)*100,100):0 }

  return (
    <div className="space-y-4 stagger">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {l:'إجمالي الأتعاب',v:formatCurrency(totalFees),color:'var(--text)',bg:'var(--card)'},
          {l:'المحصّل',v:formatCurrency(totalPaid),color:'var(--sidebar)',bg:'var(--green-soft)'},
          {l:'المستحق',v:formatCurrency(totalPend),color:'#dc2626',bg:'var(--red-soft)'},
        ].map(s=>(
          <div key={s.l} className="card p-5 text-center" style={{background:s.bg}}>
            <p className="text-xs font-semibold mb-1" style={{color:s.color+'99'}}>{s.l}</p>
            <p className="text-2xl font-black" style={{color:s.color}}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading?<PageLoader/>:cases.length===0?<EmptyState icon="💰" title="لا توجد بيانات مالية"/>:(
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b" style={{borderColor:'var(--border)'}}>
            <p className="font-bold text-sm" style={{color:'var(--text)'}}>تفصيل الأتعاب حسب القضية</p>
          </div>
          <table className="data-table">
            <thead><tr><th>القضية</th><th>الموكل</th><th>الكلي</th><th>المدفوع</th><th>المتبقي</th><th>نسبة التحصيل</th></tr></thead>
            <tbody>{cases.map(c=>{
              const p=paid(c), rem=c.feeAgreed-p, pc=pct(c)
              return (
                <tr key={c.id}>
                  <td><p className="font-mono text-xs font-bold">#{c.caseNumber?.split('/').pop()??c.id.slice(-4)}</p><p className="text-xs truncate max-w-[140px]" style={{color:'var(--text-3)'}}>{c.title}</p></td>
                  <td className="font-semibold">{c.client.name}</td>
                  <td>{formatCurrency(c.feeAgreed)}</td>
                  <td className="font-bold" style={{color:'var(--sidebar)'}}>{formatCurrency(p)}</td>
                  <td className={`font-bold ${rem>0?'text-red-500':''}`}>{formatCurrency(Math.max(0,rem))}</td>
                  <td>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:'var(--input-bg)'}}>
                        <div className="h-full rounded-full transition-all" style={{width:`${pc}%`,background:pc>=100?'var(--sidebar)':pc>60?'#f59e0b':'#dc2626'}}/>
                      </div>
                      <span className="text-xs font-bold w-8" style={{color:'var(--text-2)'}}>{Math.round(pc)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
