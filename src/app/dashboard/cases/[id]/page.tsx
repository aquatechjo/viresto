'use client'
import { useEffect,useState,useCallback } from 'react'
import { useParams,useRouter } from 'next/navigation'
import { toast } from 'sonner'
import PageLoader from '@/components/ui/PageLoader'
import Modal     from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import { formatCurrency,formatDate,formatTime } from '@/lib/utils'

interface Payment { id:string;amount:number;status:string;method:string;paidAt:string;notes?:string }
interface Appointment { id:string;title:string;startTime:string;type:string;location?:string }
interface CaseDetail { id:string;title:string;caseNumber?:string;court?:string;status:string;feeAgreed:number;description?:string;createdAt:string;client:{id:string;name:string;phone?:string};payments:Payment[];appointments:Appointment[] }

const STATUS_AR:Record<string,string> = { OPEN:'مفتوحة',IN_PROGRESS:'جارية',CLOSED:'مغلقة',ARCHIVED:'مؤرشفة' }
const STATUS_BADGE:Record<string,string> = { OPEN:'badge badge-green',IN_PROGRESS:'badge badge-blue',CLOSED:'badge badge-gray',ARCHIVED:'badge badge-gray' }
const METHOD_AR:Record<string,string> = { CASH:'نقداً',BANK_TRANSFER:'تحويل',CHECK:'شيك',ONLINE:'إلكتروني' }
const PMT_STATUS:Record<string,string> = { PAID:'badge badge-green',PENDING:'badge badge-amber',OVERDUE:'badge badge-red',CANCELLED:'badge badge-gray' }
const PMT_AR:Record<string,string> = { PAID:'مدفوع',PENDING:'معلق',OVERDUE:'متأخر',CANCELLED:'ملغي' }
const STATUSES = [['OPEN','مفتوحة'],['IN_PROGRESS','جارية'],['CLOSED','مغلقة'],['ARCHIVED','مؤرشفة']]
const PMT_INIT = { amount:'',method:'CASH',status:'PAID',notes:'',paidAt:'' }


export default function CaseDetailPage() {
  const { id } = useParams<{id:string}>()
  const router = useRouter()
  const [c,setC]       = useState<CaseDetail|null>(null)
  const [loading,setL] = useState(true)
  const [pmtOpen,setPO] = useState(false)
  const [pmt,setPmt]   = useState(PMT_INIT)
  const [saving,setSv] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

const load = useCallback(async () => {
  if (!id || id === 'undefined') {
    setL(false)
    toast.error('رقم القضية غير موجود')
    return
  }

  const r = await fetch(`/api/cases/${id}`)
  const d = await r.json()

  if (d.success) setC(d.data)
  else toast.error('القضية غير موجودة')

  setL(false)
}, [id])

useEffect(() => {
  load()
}, [load])

async function updateStatus(status: string) {
  if (!id || id === 'undefined') {
    toast.error('رقم القضية غير موجود')
    return
  }

  const r = await fetch(`/api/cases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  const d = await r.json()

  if (d.success) {
    toast.success('تم تحديث الحالة')
    load()
  } else {
    toast.error(d.message)
  }
}

  async function addPayment(e:React.FormEvent){
    e.preventDefault()
    if(!pmt.amount) return toast.error('المبلغ مطلوب')
    setSv(true)
    const r=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...pmt,caseId:id,amount:parseFloat(pmt.amount),paidAt:pmt.paidAt||new Date().toISOString()})})
    const d=await r.json()
    if(d.success){toast.success('تمت إضافة الدفعة');setPO(false);setPmt(PMT_INIT);load()}else toast.error(d.message)
    setSv(false)
  }

async function delPayment(pid: string) {
  setDeleteId(pid)
}

async function confirmDelete() {
  if (!deleteId) return

  try {
    setDeleteLoading(true)

    const r = await fetch(`/api/payments/${deleteId}`, {
      method: 'DELETE',
    })

    const d = await r.json()

    if (!r.ok) {
      toast.error(d.message ?? 'فشل حذف الدفعة')
      return
    }

    toast.success('تم حذف الدفعة')
    setDeleteId(null)
    load()
  } catch {
    toast.error('حدث خطأ')
  } finally {
    setDeleteLoading(false)
  }
}

  if(loading) return <PageLoader/>
  if(!c) return <div className="text-center py-16"><button onClick={()=>router.back()} className="btn btn-ghost">رجوع</button></div>

  const totalPaid=c.payments.filter(p=>p.status==='PAID').reduce((s,p)=>s+p.amount,0)
  const remaining=c.feeAgreed-totalPaid
  const pct=c.feeAgreed>0?Math.min((totalPaid/c.feeAgreed)*100,100):0

  return (
    <div className="space-y-5 stagger">
      <button onClick={()=>router.back()} className="btn btn-ghost" style={{fontSize:'.8rem',padding:'.3rem .8rem'}}>← رجوع</button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Case info */}
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <span className={STATUS_BADGE[c.status]}>{STATUS_AR[c.status]}</span>
              <h2 className="font-black text-base text-right" style={{color:'var(--text)'}}>{c.title}</h2>
            </div>
            {c.caseNumber&&<p className="font-mono text-sm" style={{color:'var(--text-3)'}}>رقم: {c.caseNumber}</p>}
            {c.court&&<p className="text-sm" style={{color:'var(--text-2)'}}>{c.court}</p>}
            {c.description&&<p className="text-sm" style={{color:'var(--text-2)'}}>{c.description}</p>}
            <p className="text-xs" style={{color:'var(--text-3)'}}>أُضيف {formatDate(c.createdAt)}</p>
          </div>

          {/* Client */}
          <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>router.push(`/dashboard/clients/${c.client.id}`)}>
            <p className="text-xs font-bold mb-2" style={{color:'var(--text-3)'}}>الموكل</p>
            <p className="font-bold" style={{color:'var(--text)'}}>{c.client.name}</p>
            {c.client.phone&&<p className="text-sm mt-0.5" style={{color:'var(--text-2)'}}>{c.client.phone}</p>}
          </div>

          {/* Status change */}
          <div className="card p-4">
            <p className="text-xs font-bold mb-2" style={{color:'var(--text-3)'}}>تغيير الحالة</p>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map(([s,l])=>(
                <button key={s} onClick={()=>updateStatus(s)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${c.status===s?'text-white':''}`}
                  style={c.status===s?{background:'var(--sidebar)'}:{background:'var(--input-bg)',color:'var(--text-2)'}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Financial + payments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Financial summary */}
          <div className="grid grid-cols-3 gap-3">
            {[{l:'الأتعاب المتفق عليها',v:formatCurrency(c.feeAgreed),color:'var(--text)'},{l:'المحصّل',v:formatCurrency(totalPaid),color:'var(--sidebar)'},{l:'المتبقي',v:formatCurrency(Math.max(0,remaining)),color:'#dc2626'}].map(s=>(
              <div key={s.l} className="card p-4 text-center">
                <p className="text-xs font-semibold mb-1" style={{color:'var(--text-3)'}}>{s.l}</p>
                <p className="text-lg font-black" style={{color:s.color}}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="card p-4">
            <div className="flex justify-between text-xs font-bold mb-2">
              <span style={{color:'var(--text-3)'}}>{Math.round(pct)}% محصّل</span>
              <span style={{color:'var(--text-2)'}}>نسبة التحصيل</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{background:'var(--input-bg)'}}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{width:`${pct}%`,background:pct>=100?'var(--sidebar)':pct>50?'#f59e0b':'#dc2626'}}/>
            </div>
          </div>

          {/* Payments table */}
          <div className="card overflow-hidden p-0">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{borderColor:'var(--border)'}}>
              <button onClick={()=>setPO(true)} className="btn btn-primary" style={{fontSize:'.75rem',padding:'.3rem .75rem'}}>+ دفعة جديدة</button>
              <p className="font-bold text-sm" style={{color:'var(--text)'}}>سجل المدفوعات</p>
            </div>
            {c.payments.length===0?<p className="text-center py-8 text-sm" style={{color:'var(--text-3)'}}>لا توجد دفعات</p>:(
              <table className="data-table">
                <thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th></th></tr></thead>
                <tbody>{c.payments.map(p=>(
                  <tr key={p.id}>
                    <td className="text-sm">{formatDate(p.paidAt)}</td>
                    <td className="font-bold">{formatCurrency(p.amount)}</td>
                    <td style={{color:'var(--text-2)'}}>{METHOD_AR[p.method]}</td>
                    <td><span className={PMT_STATUS[p.status]}>{PMT_AR[p.status]}</span></td>
                    <td><button onClick={()=>delPayment(p.id)} className="text-red-400 hover:text-red-600 text-sm transition-colors">🗑</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>

          {/* Appointments */}
          {c.appointments.length>0&&(
            <div className="card p-4">
              <p className="font-bold text-sm mb-3" style={{color:'var(--text)'}}>المواعيد ({c.appointments.length})</p>
              <div className="space-y-2">
                {c.appointments.slice(0,4).map(a=>(
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{background:'var(--input-bg)'}}>
                    <span className="text-xs" style={{color:'var(--text-3)'}}>{formatDate(a.startTime,{day:'numeric',month:'short'})}</span>
                    <div className="text-right"><p className="text-sm font-semibold" style={{color:'var(--text)'}}>{a.title}</p>{a.location&&<p className="text-xs" style={{color:'var(--text-3)'}}>{a.location}</p>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add payment modal */}
      <Modal open={pmtOpen} onClose={()=>{setPO(false);setPmt(PMT_INIT)}} title="إضافة دفعة" size="sm">
        <form onSubmit={addPayment} className="space-y-3">
          <FormField label="المبلغ (د.أ)" required><input type="number" value={pmt.amount} onChange={e=>setPmt(p=>({...p,amount:e.target.value}))} className="input" min="1" step="0.01" autoFocus/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="طريقة الدفع"><select value={pmt.method} onChange={e=>setPmt(p=>({...p,method:e.target.value}))} className="input">{Object.entries(METHOD_AR).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></FormField>
            <FormField label="الحالة"><select value={pmt.status} onChange={e=>setPmt(p=>({...p,status:e.target.value}))} className="input">{Object.entries(PMT_AR).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></FormField>
          </div>
          <FormField label="التاريخ"><input type="date" value={pmt.paidAt} onChange={e=>setPmt(p=>({...p,paidAt:e.target.value}))} className="input"/></FormField>
          <FormField label="ملاحظات"><input value={pmt.notes} onChange={e=>setPmt(p=>({...p,notes:e.target.value}))} className="input"/></FormField>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={()=>setPO(false)} className="btn btn-ghost flex-1">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving?<span className="spinner spinner-sm"/>:'حفظ'}</button>
          </div>
        </form>
      </Modal>
      <Modal
  open={!!deleteId}
  onClose={() => setDeleteId(null)}
  title="تأكيد حذف الدفعة"
  size="sm"
>
  <div className="space-y-4">
    <p className="text-sm" style={{ color: 'var(--text-2)' }}>
      هل أنت متأكد من حذف هذه الدفعة؟
    </p>

    <div className="flex gap-2 pt-2">
      <button
        type="button"
        onClick={() => setDeleteId(null)}
        className="btn btn-ghost flex-1"
      >
        إلغاء
      </button>

      <button
        type="button"
        onClick={confirmDelete}
        disabled={deleteLoading}
        className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
      >
        {deleteLoading ? 'جاري الحذف...' : 'حذف'}
      </button>
    </div>
  </div>
</Modal>
    </div>
  )
}
