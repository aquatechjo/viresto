'use client'
import { useEffect,useState } from 'react'
import { toast } from 'sonner'
import PageLoader from '@/components/ui/PageLoader'
import FormField  from '@/components/ui/FormField'
import { initials } from '@/lib/utils'

interface User {
  name: string
  email: string
  role: string
  tenant: {
    name: string
    slug: string
    plan: string
    email?: string | null
    phone?: string | null
    address?: string | null
    logoUrl?: string | null
  }
}
export default function SettingsPage() {
  const [user,setUser]       = useState<User|null>(null)
  const [loading,setLoading] = useState(true)
  const [editing,setEditing] = useState(false)
  const [form,setForm]       = useState({name:'',email:'',phone:'',licenseNo:''})
  const [pw,setPw]           = useState({current:'',next:'',confirm:''})
  const [notif,setNotif]     = useState(true)
  const [dark,setDark]       = useState(false)
  const [saving,setSaving]   = useState(false)
  const [pwSaving,setPwSav]  = useState(false)
  const [twoFAEnabled,setTwoFAEnabled] = useState(false)
  const [qrCode,setQrCode] = useState('')
  const [twoFACode,setTwoFACode] = useState('')
  const [twoFALoading,setTwoFALoading] = useState(false)
const [company, setCompany] = useState({
  name: '',
  email: '',
  phone: '',
  address: '',
  logoUrl: '',
  aiEnabled: false,
  aiConsentAt: null as string | null,
})
const [companySaving, setCompanySaving] = useState(false)
const [aiSaving, setAiSaving] = useState(false)

useEffect(() => {
  fetch('/api/auth/me')
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        setUser(d.data)

        setForm(f => ({
          ...f,
          name: d.data.name,
          email: d.data.email,
        }))

        setTwoFAEnabled(!!d.data.twoFactorEnabled)
        fetch('/api/settings')
  .then(r => r.json())
  .then(s => {
    if (s.success) {
setCompany({
  name: s.data.name || '',
  email: s.data.email || '',
  phone: s.data.phone || '',
  address: s.data.address || '',
  logoUrl: s.data.logoUrl || '',
  aiEnabled: !!s.data.aiEnabled,
  aiConsentAt: s.data.aiConsentAt || null,
})
    }
  })
      }

      setLoading(false)
    })
}, [])

  async function saveProfile(e:React.FormEvent){
    e.preventDefault(); setSaving(true)
    const r=await fetch('/api/auth/update-profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.name,email:form.email})})
    const d=await r.json()
    if(d.success){toast.success('تم حفظ البيانات');setEditing(false);setUser(u=>u?{...u,name:d.data.name,email:d.data.email}:u)}
    else toast.error(d.message)
    setSaving(false)
  }

  async function savePw(e:React.FormEvent){
    e.preventDefault()
    if(pw.next!==pw.confirm) return toast.error('كلمتا المرور غير متطابقتين')
    if(pw.next.length<8) return toast.error('كلمة المرور 8 أحرف على الأقل')
    setPwSav(true)
    const r=await fetch('/api/auth/update-profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:pw.current,newPassword:pw.next})})
    const d=await r.json()
    if(d.success){toast.success('تم تغيير كلمة المرور');setPw({current:'',next:'',confirm:''})}
    else toast.error(d.message)
    setPwSav(false)
  }


  async function saveCompany(e: React.FormEvent) {
  e.preventDefault()
  setCompanySaving(true)

const r = await fetch('/api/settings', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: company.name,
    email: company.email,
    phone: company.phone,
    address: company.address,
  }),
})

  const d = await r.json()

  if (d.success) {
    toast.success('تم حفظ بيانات الشركة')

    setUser(u =>
      u
        ? {
            ...u,
            tenant: {
              ...u.tenant,
              name: d.data.name,
              email: d.data.email,
              phone: d.data.phone,
              address: d.data.address,
              logoUrl: d.data.logoUrl,
            },
          }
        : u
    )
  } else {
    toast.error(d.message || 'تعذر حفظ بيانات الشركة')
  }

  setCompanySaving(false)
}

async function toggleAi() {
  const nextValue = !company.aiEnabled

  if (nextValue) {
    const confirmed = window.confirm(
      'سيتم تفعيل المساعد الذكي لهذا المكتب. قد يتم إرسال السؤال وبيانات عامة محدودة إلى مزود ذكاء اصطناعي خارجي. هل تريد المتابعة؟'
    )

    if (!confirmed) return
  }

  setAiSaving(true)

  const r = await fetch('/api/settings/ai', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      enabled: nextValue,
    }),
  })

  const d = await r.json()

  if (d.success) {
    setCompany((p) => ({
      ...p,
      aiEnabled: d.data.aiEnabled,
      aiConsentAt: d.data.aiConsentAt,
    }))

    toast.success(
      nextValue
        ? 'تم تفعيل المساعد الذكي'
        : 'تم تعطيل المساعد الذكي'
    )
  } else {
    toast.error(d.message || 'تعذر تحديث إعدادات المساعد الذكي')
  }

  setAiSaving(false)
}


  if(loading) return <PageLoader/>
  if(!user)   return null

  const roleAR:Record<string,string>={OWNER:'المالك',LAWYER:'محامٍ',ASSISTANT:'مساعد'}
  const planAR:Record<string,string>={FREE:'مجاني',PRO:'احترافي',ENTERPRISE:'مؤسسي'}

  function Toggle({on,set}:{on:boolean;set:(v:boolean)=>void}){
    return <button onClick={()=>set(!on)} className="relative w-11 h-6 rounded-full transition-all duration-200" style={{background:on?'var(--sidebar)':'var(--border-dark)'}}>
      <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200" style={{right:on?5:'auto',left:on?'auto':5}}/>
    </button>
  }

  async function setup2FA() {
  try {
    setTwoFALoading(true)

    const r = await fetch('/api/auth/2fa/setup')
    const d = await r.json()

    if (!d.success) {
      toast.error(d.message)
      return
    }

    setQrCode(d.data.qrCode)
    toast.success('تم إنشاء QR Code')
  } catch {
    toast.error('فشل إعداد التحقق الثنائي')
  } finally {
    setTwoFALoading(false)
  }
}

async function verify2FA() {
  try {
    setTwoFALoading(true)

    const r = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: twoFACode,
      }),
    })

    const d = await r.json()

    if (!d.success) {
      toast.error(d.message)
      return
    }

    setTwoFAEnabled(true)
    setQrCode('')
    setTwoFACode('')

    toast.success('تم تفعيل التحقق الثنائي')
  } catch {
    toast.error('فشل تفعيل التحقق الثنائي')
  } finally {
    setTwoFALoading(false)
  }
}

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger">
      {/* Personal info */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          {editing?(
            <div className="flex gap-2">
              <button onClick={()=>setEditing(false)} className="btn btn-ghost" style={{fontSize:'.78rem',padding:'.3rem .75rem'}}>إلغاء</button>
              <button onClick={saveProfile} disabled={saving} className="btn btn-primary" style={{fontSize:'.78rem',padding:'.3rem .75rem'}}>{saving?<span className="spinner spinner-sm"/>:'حفظ'}</button>
            </div>
          ):(
            <button onClick={()=>setEditing(true)} className="btn btn-ghost" style={{fontSize:'.78rem',padding:'.3rem .75rem'}}>✏️ تعديل</button>
          )}
          <p className="font-bold text-sm" style={{color:'var(--text)'}}>البيانات الشخصية</p>
        </div>

        <div className="flex flex-col items-center mb-6">
          <div className="w-18 h-18 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black mb-2" style={{background:'var(--green-soft)',color:'var(--sidebar)'}}>
            {initials(user.name)}
          </div>
          <p className="font-black text-base" style={{color:'var(--text)'}}>{user.name}</p>
          <p className="text-xs mt-0.5" style={{color:'var(--text-3)'}}>{roleAR[user.role]??user.role}</p>
          <span className="badge badge-green mt-1">{planAR[user.tenant.plan]??user.tenant.plan}</span>
        </div>

        {editing?(
          <form onSubmit={saveProfile} className="space-y-3">
            <FormField label="الاسم الكامل"><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="input"/></FormField>
            <FormField label="البريد الإلكتروني"><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="input"/></FormField>
          </form>
        ):(
          <div className="space-y-3">
            {[['الاسم',user.name],['البريد',user.email],['المكتب',user.tenant.name]].map(([l,v])=>(
              <div key={l} className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{background:'var(--input-bg)'}}>
                <span className="font-semibold text-sm" style={{color:'var(--text)'}}>{v}</span>
                <span className="text-xs font-bold" style={{color:'var(--text-3)'}}>{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5 space-y-3">
  <div>
    <h2 className="text-lg font-black">المساعد الذكي</h2>
    <p className="text-sm text-gray-500">
      عند التفعيل، قد يتم إرسال السؤال وبيانات عامة محدودة عن المكتب إلى مزود ذكاء اصطناعي خارجي لمعالجة الطلب.
    </p>
  </div>

  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
    لا يتم إرسال أسماء الموكلين أو تفاصيل القضايا الحساسة افتراضيًا. استخدم المساعد فقط للمهام التنظيمية والمتابعة.
  </div>

  <button
    type="button"
    onClick={toggleAi}
    disabled={aiSaving}
    className="btn btn-primary"
  >
    {aiSaving
      ? 'جارٍ الحفظ...'
      : company.aiEnabled
        ? 'تعطيل المساعد الذكي'
        : 'تفعيل المساعد الذكي'}
  </button>
</div>

      {/* Company info */}
<div className="card p-6">
  <div className="mb-5">
    <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
      بيانات الشركة / المكتب
    </p>
    <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
      تظهر هذه البيانات في الفواتير والطباعة
    </p>
  </div>

  <form onSubmit={saveCompany} className="space-y-3">
    <FormField label="اسم المكتب / الشركة">
      <input
        value={company.name}
        onChange={e => setCompany(p => ({ ...p, name: e.target.value }))}
        className="input"
        required
      />
    </FormField>

    <FormField label="البريد الإلكتروني">
      <input
        type="email"
        value={company.email}
        onChange={e => setCompany(p => ({ ...p, email: e.target.value }))}
        className="input"
        placeholder="company@example.com"
      />
    </FormField>

    <FormField label="رقم الهاتف">
      <input
        value={company.phone}
        onChange={e => setCompany(p => ({ ...p, phone: e.target.value }))}
        className="input"
        placeholder="+962..."
      />
    </FormField>

    <FormField label="العنوان">
      <input
        value={company.address}
        onChange={e => setCompany(p => ({ ...p, address: e.target.value }))}
        className="input"
        placeholder="الأردن - عمّان"
      />

      
    </FormField>

    <button
      type="submit"
      disabled={companySaving}
      className="btn btn-primary w-full"
    >
      {companySaving ? 'جارٍ الحفظ...' : 'حفظ بيانات الشركة'}
    </button>
  </form>
</div>

      {/* Settings panel */}
      <div className="card p-6">
        <p className="font-bold text-sm mb-5" style={{color:'var(--text)'}}>الإعدادات</p>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <Toggle on={notif} set={setNotif}/>
            <div className="text-right"><p className="font-semibold text-sm" style={{color:'var(--text)'}}>الإشعارات</p><p className="text-xs" style={{color:'var(--text-3)'}}>تنبيهات المواعيد والمهام</p></div>
          </div>

          <div className="flex items-center justify-between py-4 border-y" style={{borderColor:'var(--border)'}}>
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{background:'var(--sidebar)',color:'#fff'}}>العربية</span>
            <div className="text-right"><p className="font-semibold text-sm" style={{color:'var(--text)'}}>اللغة</p><p className="text-xs" style={{color:'var(--text-3)'}}>لغة الواجهة</p></div>
          </div>

          <div className="flex items-center justify-between">
            <Toggle on={dark} set={setDark}/>
            <div className="text-right"><p className="font-semibold text-sm" style={{color:'var(--text)'}}>الوضع الليلي</p><p className="text-xs" style={{color:'var(--text-3)'}}>تفعيل الثيم الداكن</p></div>
          </div>
        </div>

        {/* Change password */}
        <div className="mt-6 pt-5 border-t" style={{borderColor:'var(--border)'}}>
          <p className="font-bold text-sm mb-3" style={{color:'var(--text)'}}>تغيير كلمة المرور</p>
          <form onSubmit={savePw} className="space-y-2.5">
            {([['current','كلمة المرور الحالية'],['next','كلمة المرور الجديدة'],['confirm','تأكيد كلمة المرور']] as [keyof typeof pw,string][]).map(([k,l])=>(
              <FormField key={k} label={l}><input type="password" value={pw[k]} onChange={e=>setPw(p=>({...p,[k]:e.target.value}))} className="input" placeholder="••••••••"/></FormField>
            ))}
            <button type="submit" disabled={pwSaving||!pw.current||!pw.next} className="btn btn-primary w-full mt-1">
              {pwSaving?<span className="spinner spinner-sm"/>:'تغيير كلمة المرور'}
            </button>
          </form>
        </div>
      </div>
      <div className="card p-6">
  <div className="flex items-center justify-between mb-4">
    <p
      className="font-bold text-sm"
      style={{ color: 'var(--text)' }}
    >
      الحماية الثنائية 2FA
    </p>

    <span className={twoFAEnabled ? 'badge badge-green' : 'badge'}>
      {twoFAEnabled ? 'مفعّل' : 'غير مفعّل'}
    </span>
  </div>

  <p
    className="text-xs mb-4"
    style={{ color: 'var(--text-3)' }}
  >
    حماية إضافية لحسابات المحامين والإدارة عبر Google Authenticator.
  </p>

  {!twoFAEnabled && !qrCode && (
    <button
      onClick={setup2FA}
      disabled={twoFALoading}
      className="btn btn-primary"
    >
      {twoFALoading ? '...' : 'تفعيل 2FA'}
    </button>
  )}

  {qrCode && (
    <div className="space-y-4">
      <img
        src={qrCode}
        alt="2FA QR"
        className="w-52 h-52 rounded-2xl border mx-auto"
      />

      <input
        value={twoFACode}
        onChange={(e) => setTwoFACode(e.target.value)}
        placeholder="أدخل رمز التحقق"
        className="input"
      />

      <button
        onClick={verify2FA}
        disabled={twoFALoading}
        className="btn btn-primary w-full"
      >
        تأكيد التفعيل
      </button>
    </div>
  )}
</div>
    </div>
  )
}
