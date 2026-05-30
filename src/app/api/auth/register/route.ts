import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken, buildCookie } from '@/lib/auth'
import { registerSchema } from '@/lib/validations'
import { err } from '@/lib/api-response'
import { slugify } from '@/lib/utils'
import { checkRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'
export async function POST(req: NextRequest) {
  const ip =
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  req.headers.get('x-real-ip') ??
  'unknown'

const rl = checkRateLimit(ip, {
  keyPrefix: 'register',
  max: 3,
  windowMs: 60 * 60 * 1000,
})

if (!rl.allowed) {
  return err('تم تجاوز عدد محاولات إنشاء الحساب. حاول لاحقاً.', 429)
}
  const body   = await req.json().catch(() => ({}))
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) return err('بيانات غير صالحة', 400, parsed.error.flatten())

  const { tenantName, name, email, password } = parsed.data
  const exists = await prisma.user.findFirst({ where: { email } })
  if (exists) return err('البريد الإلكتروني مستخدم مسبقاً', 409)

  const baseSlug = slugify(tenantName)
  let slug = baseSlug, i = 1
  while (await prisma.tenant.findUnique({ where: { slug } })) slug = `${baseSlug}-${i++}`

  const passwordHash = await bcrypt.hash(password, 12)
  const tenant = await prisma.tenant.create({
    data: { name: tenantName, slug, users: { create: { name, email, passwordHash, role: 'ADMIN' } } },
    include: { users: true },
  })
const user = tenant.users[0]

const session = await prisma.session.create({
  data: {
    userId: user.id,
    tenantId: tenant.id,
    tokenHash: crypto.randomUUID(),
    ipAddress: ip,
    userAgent: req.headers.get('user-agent'),
  },
})

const token = await signToken({
  userId: user.id,
  tenantId: tenant.id,
  email: user.email,
  name: user.name,
  role: user.role,
  sessionId: session.id,
  isSystemAdmin: user.isSystemAdmin,
})

  const res   = NextResponse.json({ success: true, data: { name: user.name, email: user.email } }, { status: 201 })
  res.cookies.set(buildCookie(token))
  return res
}
