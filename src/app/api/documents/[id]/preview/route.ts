import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import {
  generateSignedFileUrl,
  generatePrivateDownloadUrl,
} from '@/lib/cloudinary'

type Params = { params: Promise<{ id: string }> }

function getResourceTypes(fileType?: string | null): ('image' | 'raw' | 'video')[] {
  if (fileType?.startsWith('video/')) return ['video']
  if (fileType?.startsWith('image/')) return ['image']
  function getResourceTypes(fileType?: string | null): ('image' | 'raw' | 'video')[] {
  if (fileType?.startsWith('video/')) return ['video']
  if (fileType?.startsWith('image/')) return ['image']
  if (fileType === 'application/pdf') return ['image']

  return ['raw', 'image']
}

  return ['raw', 'image']
}


function getPublicIdCandidates(publicId: string, fileType?: string | null) {
  if (fileType === 'application/pdf' && !publicId.toLowerCase().endsWith('.pdf')) {
    return [publicId, `${publicId}.pdf`]
  }

  return [publicId]
}


export async function GET(req: NextRequest, { params }: Params) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN', 'LAWYER', 'STAFF'])

    if (auth.error || !auth.user) {
      return auth.error
    }

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
      },
    })

    if (!doc || !doc.publicId) {
      return NextResponse.json(
        { message: 'المستند غير موجود' },
        { status: 404 }
      )
    }

    let cloudinaryResponse: Response | null = null

for (const publicIdCandidate of getPublicIdCandidates(doc.publicId, doc.fileType)) {
  for (const resourceType of getResourceTypes(doc.fileType)) {
    const signedUrl =
  doc.fileType === 'application/pdf'
    ? generatePrivateDownloadUrl(publicIdCandidate, 'pdf', 'image')
    : generateSignedFileUrl(publicIdCandidate, resourceType)

    const res = await fetch(signedUrl, {
      cache: 'no-store',
    })

    const contentType = res.headers.get('content-type') || ''

    if (
      res.ok &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/json')
    ) {
      cloudinaryResponse = res
      break
    }
  }

  if (cloudinaryResponse) break
}

if (!cloudinaryResponse) {
  return NextResponse.json(
    { message: 'تعذر تحميل المستند من التخزين' },
    { status: 404 }
  )
}

const finalResponse = cloudinaryResponse


    const arrayBuffer = await finalResponse.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': doc.fileType || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  })
}