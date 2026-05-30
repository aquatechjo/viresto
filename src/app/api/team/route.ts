import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

const allowedRoles = ['ADMIN', 'LAWYER', 'STAFF'] as const

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN'])
    if (auth.error || !auth.user) return auth.error

    const users = await prisma.user.findMany({
      where: {
        tenantId: auth.user.tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isSystemAdmin: true,
        createdAt: true,
      },
    })

    return ok({
      currentRole: auth.user.role,
      users,
    })
  })
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN'])
    if (auth.error || !auth.user) return auth.error

    const body = await req.json().catch(() => ({}))

    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const role = String(body.role ?? '').toUpperCase()
    const password = String(body.password ?? '')

    if (!name || !email || !role || !password) {
      return err('جميع الحقول مطلوبة', 400)
    }

    if (name.length < 2 || name.length > 100) {
      return err('اسم المستخدم غير صالح', 400)
    }

    if (!email.includes('@')) {
      return err('البريد الإلكتروني غير صالح', 400)
    }

    if (password.length < 8) {
      return err('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 400)
    }

    if (!allowedRoles.includes(role as any)) {
      return err('صلاحية غير صحيحة', 400)
    }

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: auth.user.tenantId,
      },
      select: {
        id: true,
        maxUsers: true,
        status: true,
        isSuspended: true,
      },
    })

    if (!tenant) {
      return err('المكتب غير موجود', 404)
    }

    if (tenant.isSuspended || tenant.status === 'SUSPENDED') {
      return err('لا يمكن إضافة مستخدمين لأن المكتب موقوف', 403)
    }

    if (tenant.status === 'EXPIRED') {
      return err('لا يمكن إضافة مستخدمين لأن الاشتراك منتهي', 403)
    }

    const usersCount = await prisma.user.count({
      where: {
        tenantId: auth.user.tenantId,
      },
    })

    if (usersCount >= tenant.maxUsers) {
      return err(
        `وصلت للحد الأقصى من المستخدمين في خطتك الحالية (${tenant.maxUsers})`,
        403
      )
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      return err('البريد الإلكتروني مستخدم مسبقًا', 409)
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        tenantId: auth.user.tenantId,
        name,
        email,
        role: role as any,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isSystemAdmin: true,
        createdAt: true,
      },
    })

    return ok(user, 201)
  })
}