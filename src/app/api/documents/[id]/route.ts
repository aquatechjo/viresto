import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, notFound } from '@/lib/api-response'
import cloudinary, { generateSignedFileUrl } from '@/lib/cloudinary'
import { logActivity } from '@/lib/activity'
import { requireRole, getRequestMeta } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

type Params = { params: Promise<{ id: string }> }

function getResourceType(fileType?: string | null): 'image' | 'raw' | 'video' {
  if (fileType?.startsWith('image/')) return 'image'
  if (fileType?.startsWith('video/')) return 'video'
  return 'raw'
}

export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])

    if (auth.error || !auth.user) {
      return auth.error
    }

    const meta = getRequestMeta(req)
    const { id } = await params

    const doc = await prisma.document.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        publicId: true,
        caseId: true,
      },
    })

    if (!doc) {
      return notFound('المستند غير موجود')
    }

    if (!doc.publicId) {
      return notFound('رابط المستند غير متاح')
    }

    const url = generateSignedFileUrl(
      doc.publicId,
      getResourceType(doc.fileType)
    )

    await logActivity({
      tenantId: auth.user.tenantId,
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      type: 'DOCUMENT_VIEWED',
      title: 'تم فتح مستند',
      message: doc.fileName,
      entityType: 'DOCUMENT',
      entityId: doc.id,
    })

    return ok({
      url,
      expiresIn: 300,
      fileName: doc.fileName,
    })
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER'])

    if (auth.error || !auth.user) {
      return auth.error
    }

    const meta = getRequestMeta(req)
    const { id } = await params

    const exists = await prisma.document.findFirst({
      where: {
        id,
        tenantId: auth.user.tenantId,
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        publicId: true,
        caseId: true,
      },
    })

    if (!exists) {
      return notFound('المستند غير موجود')
    }

    if (exists.publicId) {
      try {
        await cloudinary.uploader.destroy(exists.publicId, {
          resource_type: getResourceType(exists.fileType),
        })
      } catch (e) {
        console.error('Cloudinary delete failed:', e)
      }
    }

    await prisma.document.delete({
      where: {
        id: exists.id,
      },
    })

    await logActivity({
      actorId: auth.user.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      tenantId: auth.user.tenantId,
      type: 'DOCUMENT_DELETED',
      title: exists.caseId ? 'تم حذف مستند من القضية' : 'تم حذف مستند',
      message: exists.fileName,
      entityType: exists.caseId ? 'CASE' : 'DOCUMENT',
      entityId: exists.caseId || exists.id,
    })

    return ok({ deleted: true })
  })
}