import { NextRequest } from 'next/server'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { encryptText } from '@/lib/encryption'
import { verifySameOrigin } from '@/lib/csrf'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req)
     if (csrf) return csrf
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const user = await prisma.user.findFirst({
      where: {
        id: auth.user.userId,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
      },
    })

    if (!user) {
      return err('المستخدم غير موجود', 404)
    }

    if (user.twoFactorEnabled) {
      return err('التحقق الثنائي مفعّل مسبقًا', 400)
    }

    const secret = speakeasy.generateSecret({
      name: `Viresto (${user.email})`,
      issuer: 'Viresto',
      length: 20,
    })

    if (!secret.base32 || !secret.otpauth_url) {
      return err('فشل إنشاء رمز التحقق الثنائي', 500)
    }

await prisma.user.update({
  where: { id: user.id },
  data: {
    twoFactorSecret: encryptText(secret.base32),
    twoFactorEnabled: false,
  },
})

    const qrCode = await QRCode.toDataURL(secret.otpauth_url)

    return ok({
      qrCode,
      secret: secret.base32,
    })
  })
}