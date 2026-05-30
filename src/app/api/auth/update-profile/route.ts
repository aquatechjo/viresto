import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession, signToken, buildCookie } from '@/lib/auth'
import { updateProfileSchema } from '@/lib/validations'
import { err, unauthorized } from '@/lib/api-response'
import { NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const body   = await req.json().catch(() => ({}))
  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) return err('بيانات غير صالحة', 400)

  const { name, email, currentPassword, newPassword } = parsed.data

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      tenantId: session.tenantId,
    },
  })

  if (!user) return unauthorized()

  // ✅ منع تغيير البريد إلى بريد مستخدم مسبقًا
  if (email && email !== user.email) {
    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (exists) {
      return err('البريد الإلكتروني مستخدم مسبقًا', 409)
    }
  }

  if (newPassword) {
    if (!currentPassword) return err('كلمة المرور الحالية مطلوبة', 400)

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return err('كلمة المرور الحالية غير صحيحة', 401)
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name  ? { name }  : {}),
      ...(email ? { email } : {}),
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12) } : {}),
    },
  })

  const token = await signToken({
    userId: updated.id,
    tenantId: updated.tenantId,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    sessionId: session.sessionId,
  })

  const res = NextResponse.json({
    success: true,
    data: {
      name: updated.name,
      email: updated.email,
    },
  })

  res.cookies.set(buildCookie(token))
  return res
}