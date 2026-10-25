import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type ActivityInput = {
  tenantId: string
  type: string
  title: string
  message?: string
  entityType?: string
  entityId?: string

  actorId?: string
  ipAddress?: string
  userAgent?: string
}

// Pass the transaction client (`tx`) when the activity is the audit record of
// a write in that transaction, so both are saved together or not at all.
export async function logActivity(
  data: ActivityInput,
  db: Prisma.TransactionClient = prisma,
) {
  return db.activity.create({
    data: {
      tenantId: data.tenantId,
      type: data.type,
      title: data.title,

      message: data.message,
      entityType: data.entityType,
      entityId: data.entityId,

      actorId: data.actorId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    },
  })
}