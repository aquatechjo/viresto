import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { documentSchema } from '@/lib/validations'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { logActivity } from '@/lib/log-activity'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
  const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
  if (auth.error || !auth.user) return auth.error

  const sp = new URL(req.url).searchParams
const caseId = sp.get('caseId')
const clientId = sp.get('clientId')

const limitRaw = Number(sp.get('limit') || 20)

const limit =
  Number.isNaN(limitRaw)
    ? 20
    : Math.min(Math.max(limitRaw, 1), 50)

  if (caseId) {
    const caseExists = await prisma.case.findFirst({
      where: {
        id: caseId,
        tenantId: auth.user.tenantId,
      },
      select: { id: true },
    })

    if (!caseExists) {
      return err('القضية غير موجودة داخل هذا المكتب', 404)
    }
  }

  if (clientId) {
    const clientExists = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId: auth.user.tenantId,
      },
      select: { id: true },
    })

    if (!clientExists) {
      return err('الموكل غير موجود داخل هذا المكتب', 404)
    }
  }

  const data = await prisma.document.findMany({
    where: {
      tenantId: auth.user.tenantId,
      ...(caseId ? { caseId } : {}),
      ...(clientId ? { clientId } : {}),
    },

    take: limit,
    
select: {
  id: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  notes: true,
  tags: true,
  createdAt: true,
  clientId: true,
  caseId: true,
  client: { select: { name: true } },
  case: { select: { title: true } },
},
    orderBy: { createdAt: 'desc' },
  })

  return ok(data)
  })
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
  const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])
  if (auth.error || !auth.user) return auth.error

  const body = await req.json().catch(() => ({}))
  const parsed = documentSchema.safeParse(body)

  if (!parsed.success) {
    return err('بيانات غير صالحة', 400, parsed.error.flatten())
  }

  const { caseId, clientId } = parsed.data

  if (caseId) {
    const caseExists = await prisma.case.findFirst({
where: {
  id: caseId,
  tenantId: auth.user.tenantId,
  ...(clientId ? { clientId } : {}),
},
      select: { id: true },
    })

    if (!caseExists) {
      return err('لا يمكن ربط المستند بقضية لا تتبع هذا المكتب', 403)
    }
  }

  if (clientId) {
    const clientExists = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId: auth.user.tenantId,
      },
      select: { id: true },
    })

    if (!clientExists) {
      return err('لا يمكن ربط المستند بموكل لا يتبع هذا المكتب', 403)
    }
  }

  const doc = await prisma.document.create({
    data: {
      tenantId: auth.user.tenantId,
      ...parsed.data,
    },
  })

await logActivity({
  req,
  tenantId: auth.user.tenantId,
  actorId: auth.user.userId,
  type: 'DOCUMENT_UPLOADED',
  title: 'تم رفع مستند جديد',
  message: doc.fileName,
  entityType: 'DOCUMENT',
  entityId: doc.id,
})

  return ok({
  id: doc.id,
  fileName: doc.fileName,
  fileType: doc.fileType,
  fileSize: doc.fileSize,
  notes: doc.notes,
  tags: doc.tags,
  createdAt: doc.createdAt,
  clientId: doc.clientId,
  caseId: doc.caseId,
}, 201)
  })
}