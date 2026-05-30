import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const res = NextResponse.next()

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

  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline';"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval';"

  res.headers.set(
    'Content-Security-Policy',
    `
      default-src 'self';
      worker-src 'self' blob:;
      ${scriptSrc}
      img-src 'self' data: blob: https://res.cloudinary.com;
      connect-src 'self' https://api.openai.com https://*.vercel-insights.com https://*.vercel-analytics.com;
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

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}