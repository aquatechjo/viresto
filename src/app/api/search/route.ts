import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import {
  decryptText,
  normalizeEmail,
  normalizePhone,
  hashSearchValue,
} from '@/lib/encryption'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
    if (auth.error || !auth.user) return auth.error

    const sp = new URL(req.url).searchParams
    const q = sp.get('q')?.trim()

    if (!q) {
      return ok({ clients: [] })
    }

    const normalizedEmail = normalizeEmail(q)
    const normalizedPhone = normalizePhone(q)

    const emailHash = normalizedEmail ? hashSearchValue(normalizedEmail) : null
    const phoneHash = normalizedPhone ? hashSearchValue(normalizedPhone) : null
    const nationalIdHash = q ? hashSearchValue(q.trim()) : null

    const clients = await prisma.client.findMany({
      where: {
        tenantId: auth.user.tenantId,
        OR: [
          {
            name: {
              contains: q,
              mode: 'insensitive',
            },
          },
          ...(emailHash ? [{ emailHash }] : []),
          ...(phoneHash ? [{ phoneHash }] : []),
          ...(nationalIdHash ? [{ nationalIdHash }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        nationalId: true,
        createdAt: true,
        _count: {
          select: {
            cases: true,
          },
        },
      },
      take: 20,
      orderBy: {
        createdAt: 'desc',
      },
    })

    const safeClients = clients.map((client) => ({
      ...client,
      email: decryptText(client.email),
      phone: decryptText(client.phone),
      nationalId: decryptText(client.nationalId),
    }))

    return ok({ clients: safeClients })
  })
}