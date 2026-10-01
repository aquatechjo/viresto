import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocationFromHeaders } from '@/lib/geo'
import { getClientIp } from '@/lib/client-ip'

type LogActivityInput = {
  req?: NextRequest
  tenantId: string
  actorId?: string | null
  type: string
  title: string
  message?: string | null
  entityType?: string | null
  entityId?: string | null
}

function getIpAddress(req?: NextRequest) {
  return req ? getClientIp(req) : null
}

export async function logActivity(input: LogActivityInput) {
  try {
    const ipAddress = getIpAddress(input.req)
    const location = input.req
      ? getLocationFromHeaders(input.req.headers)
      : { country: null, city: null }
    await prisma.activity.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId || null,
        type: input.type,
        title: input.title,
        message: input.message || null,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        ipAddress,
        country: location.country,
        city: location.city,
        userAgent: input.req?.headers.get('user-agent') || null,
      },
    })
  } catch (error) {
    console.error('Activity log failed:', error)
  }
}
