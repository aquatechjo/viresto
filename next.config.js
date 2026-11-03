const { withSentryConfig } = require('@sentry/nextjs/config')
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

const allowedOrigins = process.env.ALLOWED_SERVER_ACTION_ORIGINS
  ? process.env.ALLOWED_SERVER_ACTION_ORIGINS.split(',').map((origin) => origin.trim())
  : []

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  images: {
    // The server-side image optimizer stays out of the request path: the
    // application only serves small local logo files, so it adds attack
    // surface (sharp/libvips) for no benefit. Originally disabled while
    // Next 16.2.11 bundled a vulnerable sharp; Next 16.3.8 uses sharp 0.35.5.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
}

// Source maps go to Sentry only when all three are set (Vercel build env);
// without them the build skips the upload instead of failing.
const uploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
)

const config = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !uploadSourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
})

// The development server refuses a production database or production keys
// (scripts/check-dev-keys.mjs), also when started with a bare `next dev`.
// Only in this phase: builds (on Vercel or locally) never run the check.
module.exports = async (phase) => {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const { checkDevelopmentEnvironment } = await import('./scripts/check-dev-keys.mjs')
    if (!checkDevelopmentEnvironment()) process.exit(1)
  }
  return config
}
