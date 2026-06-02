import { NextRequest } from 'next/server'
import { err } from '@/lib/api-response'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function normalizeHost(value: string | null) {
  if (!value) return ''
  return value.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function verifySameOrigin(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) {
    return null
  }

  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  const forwardedHost = req.headers.get('x-forwarded-host')

  const requestHost = normalizeHost(forwardedHost || host)

  if (!requestHost) {
    return err('طلب غير موثوق', 403)
  }

  if (!origin) {
    return err('طلب غير موثوق', 403)
  }

  let originHost = ''

  try {
    originHost = normalizeHost(new URL(origin).host)
  } catch {
    return err('طلب غير موثوق', 403)
  }

  if (originHost !== requestHost) {
    return err('طلب غير موثوق', 403)
  }

  return null
}