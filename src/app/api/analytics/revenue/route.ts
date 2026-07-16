import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'
import { buildPaymentAccessWhere } from '@/lib/access-control'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const from = new Date()
    from.setMonth(from.getMonth() - 5)
    from.setDate(1)
    from.setHours(0, 0, 0, 0)

    const payments = await prisma.payment.findMany({
      where: buildPaymentAccessWhere(auth.user, {
        status: 'PAID',
        paidAt: { gte: from },
      }),
      select: {
        amount: true,
        paidAt: true,
      },
    })

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))

      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: new Intl.DateTimeFormat('ar', {
          month: 'short',
        }).format(d),
        revenue: 0,
      }
    })

    for (const p of payments) {
      if (!p.paidAt) continue

      const key = `${p.paidAt.getFullYear()}-${p.paidAt.getMonth()}`
      const item = months.find((m) => m.key === key)

      if (item) {
        item.revenue += Number(p.amount || 0)
      }
    }

    return ok(months)
  })
}
