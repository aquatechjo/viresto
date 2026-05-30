import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import speakeasy from 'speakeasy'

import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])

    if (auth.error || !auth.user) {
      return auth.error
    }

    const body = await req.json().catch(() => ({}))
    const password = String(body.password ?? '')
    const code = String(body.code ?? '').trim()

    if (!password || !code) {
      return err('كلمة المرور ورمز التحقق مطلوبان', 400)
    }

    const user = await prisma.user.findFirst({
      where: {
        id: auth.user.userId,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        passwordHash: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    })

    if (!user) {
      return err('المستخدم غير موجود', 404)
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return err('التحقق الثنائي غير مفعّل', 400)
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash)

    if (!passwordOk) {
      return err('كلمة المرور غير صحيحة', 401)
    }

    const codeOk = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    })

    if (!codeOk) {
      return err('رمز التحقق غير صحيح', 401)
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    })

    return ok({
      disabled: true,
    })
  })
} 