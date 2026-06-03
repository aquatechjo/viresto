import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

const publicPaths = [
  '/',
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
]

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

function applySecurityHeaders(res: NextResponse) {
  const isProd = process.env.NODE_ENV === 'production'

  if (isProd) {
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    )
  }

  res.headers.set('X-DNS-Prefetch-Control', 'off')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

const isDev = process.env.NODE_ENV !== 'production'

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval';"
  : "script-src 'self' 'unsafe-inline';"

  
res.headers.set(
  'Content-Security-Policy',
  `
    default-src 'self';
    worker-src 'self' blob:;
    ${scriptSrc}
    img-src 'self' data: blob: https://res.cloudinary.com;
    connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://api.openai.com https://*.upstash.io https://*.vercel-insights.com https://*.vercel-analytics.com;
    frame-src 'self' https://res.cloudinary.com;
    frame-ancestors 'none';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' data: https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `
    .replace(/\s{2,}/g, ' ')
    .trim()
)

  return res
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.')

  if (isAsset) {
    return applySecurityHeaders(NextResponse.next())
  }

  const token = req.cookies.get('ld_token')?.value

  if (!token && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', req.url)
    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  if (!token && isPublicPath(pathname)) {
    return applySecurityHeaders(NextResponse.next())
  }

  if (token) {
    try {
      const payload = await verifyToken(token)

if (!payload) {
  const loginUrl = new URL('/login', req.url)
  const res = NextResponse.redirect(loginUrl)
  res.cookies.delete('ld_token')
  return applySecurityHeaders(res)
}

      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-user-id', String(payload.userId))
      requestHeaders.set('x-tenant-id', String(payload.tenantId))
      requestHeaders.set('x-user-role', String(payload.role))

      if (pathname === '/login' || pathname === '/') {
        return applySecurityHeaders(
          NextResponse.redirect(new URL('/dashboard', req.url))
        )
      }

      return applySecurityHeaders(
        NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        })
      )
    } catch {
      const loginUrl = new URL('/login', req.url)
      const res = NextResponse.redirect(loginUrl)
      res.cookies.delete('ld_token')
      return applySecurityHeaders(res)
    }
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}