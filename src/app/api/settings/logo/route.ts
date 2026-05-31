import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'

const allowedLogoTypes = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN'])

    if (auth.error || !auth.user) {
      return auth.error
    }

    const CLOUD = process.env.CLOUDINARY_CLOUD_NAME
    const KEY = process.env.CLOUDINARY_API_KEY
    const SECRET = process.env.CLOUDINARY_API_SECRET

    if (!CLOUD || !KEY || !SECRET) {
      return err('رفع الشعار غير مُهيأ', 503)
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.user.tenantId },
      select: {
        isSuspended: true,
        status: true,
      },
    })

    if (!tenant) {
      return err('المكتب غير موجود', 404)
    }

    if (tenant.isSuspended || tenant.status === 'SUSPENDED') {
      return err('لا يمكن رفع الشعار لأن المكتب موقوف', 403)
    }

    if (tenant.status === 'EXPIRED') {
      return err('لا يمكن رفع الشعار لأن الاشتراك منتهي', 403)
    }

    const form = await req.formData()
    const file = form.get('file') as File | null

    if (!file) {
      return err('لم يتم إرسال الشعار', 400)
    }

    if (!allowedLogoTypes.includes(file.type as any)) {
      return err('نوع الشعار غير مسموح. ارفع PNG أو JPG أو WEBP أو SVG فقط.', 400)
    }

    if (file.name.length > 180) {
      return err('اسم الملف طويل جدًا', 400)
    }

    if (file.size > 2 * 1024 * 1024) {
      return err('حجم الشعار يجب أن لا يتجاوز 2 ميجابايت', 400)
    }

    const ts = Math.floor(Date.now() / 1000)
    const folder = `Viresto/${auth.user.tenantId}/logos`

    const str = `folder=${folder}&timestamp=${ts}${SECRET}`

    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(str)
    )

    const sig = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const fd = new FormData()
    fd.append('file', file)
    fd.append('api_key', KEY)
    fd.append('timestamp', String(ts))
    fd.append('signature', sig)
    fd.append('folder', folder)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`,
      {
        method: 'POST',
        body: fd,
      }
    )

    const data = await res.json()

    if (!res.ok) {
      return err(data.error?.message ?? 'فشل رفع الشعار', 500)
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: auth.user.tenantId },
      data: {
        logoUrl: data.secure_url,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        logoUrl: true,
        slug: true,
        plan: true,
      },
    })

    return ok(updatedTenant)
  })
}
