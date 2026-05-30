import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocationFromIp } from '@/lib/geo'

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
  if (!req) return null

  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  )
}

export async function logActivity(input: LogActivityInput) {
  try {
    const ipAddress = getIpAddress(input.req)
    const location = await getLocationFromIp(ipAddress)
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