import { NextRequest } from 'next/server'
import { DateTime } from 'luxon'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/api-auth'
import { buildPaymentAccessWhere } from '@/lib/access-control'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  REPORT_SUMMARY_SCAN_LIMIT,
  exceedsReportLimit,
} from '@/lib/report-limits'
import {
  buildRollingMonthlyRevenue,
  DEFAULT_REPORT_TIME_ZONE,
} from '@/lib/report-finance'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])
    if (auth.error || !auth.user) return auth.error

    const reportRateLimit = await checkRateLimit(
      `${auth.user.tenantId}:${auth.user.userId}`,
      {
        windowMs: 60_000,
        max: 60,
        keyPrefix: 'analytics-revenue',
      },
    )

    if (!reportRateLimit.allowed) {
      return err('طلبات التحليلات كثيرة جدًا. حاول مرة أخرى بعد دقيقة.', 429)
    }

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
      take: REPORT_SUMMARY_SCAN_LIMIT + 1,
    })

    if (exceedsReportLimit(payments.length, REPORT_SUMMARY_SCAN_LIMIT)) {
      return err(
        'حجم بيانات الإيرادات أكبر من الحد الآمن للتحليل. استخدم صفحة التقارير مع فلاتر أضيق.',
        413,
      )
    }

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
        month: new Intl.DateTimeFormat('ar-u-nu-latn', {
          month: 'short',
          timeZone: DEFAULT_REPORT_TIME_ZONE,
        }).format(monthDate.toJSDate()),
        revenue: bucket.revenue,
      }
    })

    return ok(months)
  })
}
