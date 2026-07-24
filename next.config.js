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
    // Next 16.2.11 currently installs sharp 0.34.5 internally. Keep the
    // server-side image optimizer out of the request path until Next ships a
    // patched transitive version. The application only uses local logo files.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
}

module.exports = nextConfig
