import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/tenant'
import { ok, err } from '@/lib/api-response'
import { NextRequest } from 'next/server'
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireTenant(req)

    const from = new Date()
    from.setMonth(from.getMonth() - 5)
    from.setDate(1)
    from.setHours(0, 0, 0, 0)

    const payments = await prisma.payment.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: 'PAID',
        paidAt: { gte: from },
      },
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
  } catch (e) {
    if (e instanceof Response) {
      return e
    }

    console.error('revenue analytics error:', e)
    return err('Failed to load revenue analytics', 500)
  }
}