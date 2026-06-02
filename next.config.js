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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
}

module.exports = nextConfig