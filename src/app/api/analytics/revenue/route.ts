import { NextRequest } from 'next/server'
import { DateTime } from 'luxon'
import { prisma } from '@/lib/prisma'
import { ok } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'
import { buildPaymentAccessWhere } from '@/lib/access-control'
import {
  buildRollingMonthlyRevenue,
  DEFAULT_REPORT_TIME_ZONE,
} from '@/lib/report-finance'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const nowInZone = DateTime.now().setZone(DEFAULT_REPORT_TIME_ZONE)
    const from = nowInZone
      .minus({ months: 5 })
      .startOf('month')
      .toUTC()
      .toJSDate()

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

    const months = buildRollingMonthlyRevenue(
      payments,
      nowInZone.toJSDate(),
      DEFAULT_REPORT_TIME_ZONE,
    ).map((bucket) => {
      const monthDate = DateTime.fromObject(
        { year: bucket.year, month: bucket.month, day: 1 },
        { zone: DEFAULT_REPORT_TIME_ZONE },
      )

      return {
        key: bucket.key,
        month: new Intl.DateTimeFormat('ar', {
          month: 'short',
          timeZone: DEFAULT_REPORT_TIME_ZONE,
        }).format(monthDate.toJSDate()),
        revenue: bucket.revenue,
      }
    })

    return ok(months)
  })
}
