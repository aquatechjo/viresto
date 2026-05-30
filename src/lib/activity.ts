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

export async function logActivity(data: ActivityInput) {
  return prisma.activity.create({
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