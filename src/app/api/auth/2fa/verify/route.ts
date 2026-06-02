import { NextRequest } from 'next/server'
import speakeasy from 'speakeasy'
import { decryptText } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { verifySameOrigin } from '@/lib/csrf'

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req)
     if (csrf) return csrf
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])

    if (auth.error || !auth.user) {
      return auth.error
    }

    const body = await req.json().catch(() => ({}))
    const code = String(body.code ?? '').trim()

    if (!code) {
      return err('رمز التحقق مطلوب', 400)
    }

    const user = await prisma.user.findFirst({
      where: {
        id: auth.user.userId,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    })

    if (!user) {
      return err('المستخدم غير موجود', 404)
    }

    if (!user.twoFactorSecret) {
      return err('لم يتم إعداد التحقق الثنائي', 400)
    }

    const twoFactorSecret = decryptText(user.twoFactorSecret)

if (!twoFactorSecret) {
  return err('لم يتم إعداد التحقق الثنائي', 400)
}

    const valid = speakeasy.totp.verify({
      secret: twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    })

    if (!valid) {
      return err('رمز التحقق غير صحيح', 401)
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        twoFactorEnabled: true,
      },
    })

    return ok({
      enabled: true,
    })
  })
}