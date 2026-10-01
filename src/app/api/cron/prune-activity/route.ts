import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { err, ok } from '@/lib/api-response'
import { apiHandler } from '@/lib/api-handler'
import { isBearerSecretAuthorized } from '@/lib/bearer-secret'
import {
  ACTIVITY_RETENTION_DAYS,
  auditActivityWhere,
  getActivityRetentionCutoffs,
} from '@/lib/activity-retention'
import { PROCESSED_WEBHOOK_RETENTION_DAYS } from '@/lib/webhook-dedupe'
import { cleanupOrphanUploads } from '@/lib/server/cleanup-orphan-uploads'

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

    const { auditCutoff, defaultCutoff } = getActivityRetentionCutoffs()
    const webhookCutoff = new Date(
      Date.now() - PROCESSED_WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    )

    const [deletedAuditLogs, deletedDefaultLogs, deletedWebhooks] = await prisma.$transaction([
      // Audit events (deletions, money, billing, admin, team, security): 1 year.
      prisma.activity.deleteMany({
        where: {
          AND: [auditActivityWhere(), { createdAt: { lt: auditCutoff } }],
        },
      }),

      // Everything else: 30 days.
      prisma.activity.deleteMany({
        where: {
          AND: [{ NOT: auditActivityWhere() }, { createdAt: { lt: defaultCutoff } }],
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

    // Also the daily home of upload cleanup (a separate cron would exceed the
    // two Vercel Hobby crons). A Cloudinary failure must not fail the prune;
    // it is logged and simply retried the next day.
    let uploads: Awaited<ReturnType<typeof cleanupOrphanUploads>> | { status: 'failed' }
    try {
      uploads = await cleanupOrphanUploads()
    } catch (error) {
      console.error(
        `[upload-cleanup] failed error=${error instanceof Error ? error.name : 'unknown'}`,
      )
      uploads = { status: 'failed' }
    }

    return ok({
      message: 'Activity logs pruned successfully',
      uploads,
      retention: {
        auditDays: ACTIVITY_RETENTION_DAYS.audit,
        defaultDays: ACTIVITY_RETENTION_DAYS.default,
      },
      deleted: {
        auditLogs: deletedAuditLogs.count,
        defaultLogs: deletedDefaultLogs.count,
        total: deletedAuditLogs.count + deletedDefaultLogs.count,
        processedWebhooks: deletedWebhooks.count,
      },
    })
  })
}