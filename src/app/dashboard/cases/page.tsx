'use client'
import { useEffect,useState,useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Modal     from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import EmptyState from '@/components/ui/EmptyState'
import PageLoader from '@/components/ui/PageLoader'
import { formatCurrency } from '@/lib/utils'
import TableSkeleton from '@/components/ui/TableSkeleton'

interface Case { id:string;title:string;caseNumber?:string;status:string;feeAgreed:number;client:{name:string};payments:{amount:number;status:string}[];_count:{appointments:number;documents:number} }
interface ClientOpt { id:string;name:string }

const STATUS_BADGE:Record<string,string> = { OPEN:'badge badge-green',IN_PROGRESS:'badge badge-blue',CLOSED:'badge badge-gray',ARCHIVED:'badge badge-gray' }
const STATUS_AR:Record<string,string>    = { OPEN:'مفتوحة',IN_PROGRESS:'جارية',CLOSED:'مغلقة',ARCHIVED:'مؤرشفة' }
const STATUS_FILTERS = [['all','الكل'],['OPEN','مفتوحة'],['IN_PROGRESS','جارية'],['CLOSED','مغلقة']]
const INIT = { clientId:'',title:'',caseNumber:'',court:'',feeAgreed:'',description:'' }

export default function CasesPage() {
  const router = useRouter()
  const [cases,setCases]     = useState<Case[]>([])
  const [clients,setClients] = useState<ClientOpt[]>([])
  const [filter,setFilter]   = useState('all')
  const [loading,setLoading] = useState(true)
  const [open,setOpen]       = useState(false)
  const [form,setForm]       = useState(INIT)
  const [saving,setSaving]   = useState(false)

  const load = useCallback(async()=>{
    const [cr, cl] = await Promise.all([
fetch(
  `/api/cases?page=1&limit=10${filter !== 'all' ? `&status=${filter}` : ''}`
),
fetch('/api/clients?page=1&limit=50'),
])

if (!cr.ok || !cl.ok) {
  console.error('Failed to fetch cases/clients', {
    casesStatus: cr.status,
    clientsStatus: cl.status,
  })

  setCases([])
  setClients([])
  setLoading(false)
  return
}

const [cd, cld] = await Promise.all([
  cr.json().catch(() => ({ data: [] })),
  cl.json().catch(() => ({ data: [] })),
])

setCases(cd.data?.data ?? [])
setClients(cld.data?.data ?? [])
    setLoading(false)
  },[])

useEffect(() => {
  load()
}, [load, filter])

  const filtered = filter==='all' ? cases : cases.filter(c=>c.status===filter)
  const open2=cases.filter(c=>['OPEN','IN_PROGRESS'].includes(c.status)).length
  const pending=cases.filter(c=>c.status==='IN_PROGRESS').length
  const closed=cases.filter(c=>['CLOSED','ARCHIVED'].includes(c.status)).length

  function paid(c:Case){ return c.payments.filter(p=>p.status==='PAID').reduce((s,p)=>s+p.amount,0) }
  function remaining(c:Case){ return c.feeAgreed - paid(c) }

  async function handleAdd(e:React.FormEvent){
    e.preventDefault()
    if(!form.clientId||!form.title) return toast.error('الموكل والعنوان مطلوبان')
    setSaving(true)
    const r=await fetch('/api/cases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,feeAgreed:parseFloat(form.feeAgreed)||0})})
    const d=await r.json()
    if(d.success){toast.success('تمت إضافة القضية');setOpen(false);setForm(INIT);load()}else toast.error(d.message)
    setSaving(false)
  }

  function f(k:keyof typeof INIT){ return (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setForm(p=>({...p,[k]:e.target.value})) }

  return (
    <div className="space-y-4 stagger">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[{label:'نشطة',v:open2,bg:'var(--green-soft)',color:'var(--sidebar)'},{label:'جارية',v:pending,bg:'var(--amber-soft)',color:'#92400e'},{label:'مغلقة',v:closed,bg:'var(--border)',color:'var(--text-2)'}].map(s=>(
          <div key={s.label} className="card p-5 text-center" style={{background:s.bg}}>
            <p className="text-sm font-bold mb-1" style={{color:s.color}}>{s.label}</p>
            <p className="text-4xl font-black" style={{color:s.color}}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Filter + add */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={()=>setOpen(true)} className="btn btn-primary">+ قضية جديدة</button>
        <div className="flex items-center gap-1 mr-2">
          {STATUS_FILTERS.map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter===k?'text-white':'hover:bg-gray-100'}`}
              style={filter===k?{background:'var(--sidebar)'}:{color:'var(--text-2)'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading?<TableSkeleton rows={6} />:filtered.length===0?<EmptyState   icon="⚖️"
       title="لا توجد قضايا"
       sub="قم بإنشاء أول قضية للبدء بإدارة العمل القانوني."
        action={<button onClick={()=>setOpen(true)} className="btn btn-primary">+ قضية جديدة</button>}/>:(
        <div className="card overflow-hidden p-0">
          <table className="data-table">
            <thead><tr><th>رقم القضية</th><th>الموكل</th><th>الأتعاب</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th></th></tr></thead>
            <tbody>{filtered.map(c=>{
              const rem=remaining(c)
              return (
                <tr key={c.id} onClick={()=>router.push(`/dashboard/cases/${c.id}`)}>
                  <td><div><p className="font-mono text-sm font-bold">{c.caseNumber??`#${c.id.slice(-6)}`}</p><p className="text-xs truncate max-w-[140px]" style={{color:'var(--text-3)'}}>{c.title}</p></div></td>
                  <td className="font-semibold">{c.client.name}</td>
                  <td>{formatCurrency(c.feeAgreed)}</td>
                  <td className="font-bold" style={{color:'var(--sidebar)'}}>{formatCurrency(paid(c))}</td>
                  <td className={`font-bold ${rem>0?'text-red-500':''}`}>{formatCurrency(Math.max(0,rem))}</td>
                  <td><span className={STATUS_BADGE[c.status]}>{STATUS_AR[c.status]}</span></td>
                  <td className="text-sm" style={{color:'var(--text-3)'}}>←</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={()=>{setOpen(false);setForm(INIT)}} title="إضافة قضية جديدة">
        <form onSubmit={handleAdd} className="space-y-3">
          <FormField label="الموكل" required>
            <select value={form.clientId} onChange={f('clientId')} className="input">
              <option value="">اختر موكلاً...</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="عنوان القضية" required><input value={form.title} onChange={f('title')} className="input" autoFocus/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="رقم القضية"><input value={form.caseNumber} onChange={f('caseNumber')} className="input"/></FormField>
            <FormField label="الأتعاب (د.أ)"><input type="number" value={form.feeAgreed} onChange={f('feeAgreed')} className="input" min="0"/></FormField>
          </div>
          <FormField label="المحكمة"><input value={form.court} onChange={f('court')} className="input"/></FormField>
          <FormField label="الوصف"><textarea value={form.description} onChange={f('description')} className="input" rows={2} style={{resize:'none'}}/></FormField>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={()=>{setOpen(false);setForm(INIT)}} className="btn btn-ghost flex-1">إلغاء</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving?<span className="spinner spinner-sm"/>:'حفظ'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
