import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { err, ok } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { isBearerSecretAuthorized } from '@/lib/bearer-secret'
import {
  getActivityRetentionCutoffs,
  SECURITY_ACTIVITY_TYPES,
  ACTIVITY_RETENTION_DAYS,
} from '@/lib/activity-retention'
import { PROCESSED_WEBHOOK_RETENTION_DAYS } from '@/lib/webhook-dedupe'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const authHeader = req.headers.get('authorization')

    if (!process.env.CRON_SECRET) {
      return err('Cron secret is not configured', 500)
    }

    if (!isBearerSecretAuthorized(authHeader, process.env.CRON_SECRET)) {
      return err('Unauthorized', 401)
    }

    const { securityCutoff, defaultCutoff } = getActivityRetentionCutoffs()
    const webhookCutoff = new Date(
      Date.now() - PROCESSED_WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    )

    const [deletedSecurityLogs, deletedDefaultLogs, deletedWebhooks] = await prisma.$transaction([
      prisma.activity.deleteMany({
        where: {
          type: {
            in: [...SECURITY_ACTIVITY_TYPES],
          },
          createdAt: {
            lt: securityCutoff,
          },
        },
      }),

      prisma.activity.deleteMany({
        where: {
          NOT: {
            type: {
              in: [...SECURITY_ACTIVITY_TYPES],
            },
          },
          createdAt: {
            lt: defaultCutoff,
          },
        },
      }),

      // Webhook dedupe keys: only needed while Polar may still redeliver.
      prisma.processedWebhook.deleteMany({
        where: {
          processedAt: {
            lt: webhookCutoff,
          },
        },
      }),
    ])

    return ok({
      message: 'Activity logs pruned successfully',
      retention: {
        securityDays: ACTIVITY_RETENTION_DAYS.security,
        defaultDays: ACTIVITY_RETENTION_DAYS.default,
      },
      deleted: {
        securityLogs: deletedSecurityLogs.count,
        defaultLogs: deletedDefaultLogs.count,
        total: deletedSecurityLogs.count + deletedDefaultLogs.count,
        processedWebhooks: deletedWebhooks.count,
      },
    })
  })
}