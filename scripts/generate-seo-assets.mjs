import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = process.cwd()
const publicDir = path.join(root, 'public')

const sourceLogo = path.join(publicDir, 'logo.png')

const icon48 = path.join(publicDir, 'icon-48.png')
const icon192 = path.join(publicDir, 'icon-192.png')
const icon512 = path.join(publicDir, 'icon-512.png')
const appleIcon = path.join(publicDir, 'apple-touch-icon.png')
const ogImage = path.join(publicDir, 'og-image.png')
const favicon = path.join(publicDir, 'favicon.ico')
const manifest = path.join(publicDir, 'site.webmanifest')

async function ensureSourceLogo() {
  try {
    await fs.access(sourceLogo)
  } catch {
    throw new Error('Missing public/logo.png. Add the square Viresto logo first.')
  }
}

async function makeIcon(size, outputPath) {
  await sharp(sourceLogo)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPath)
}

async function makeAppleIcon() {
  const icon = await sharp(sourceLogo)
    .resize(132, 132, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: '#052018',
    },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(appleIcon)
}

async function makeFavicon() {
  const faviconBuffer = await pngToIco([icon48, icon192])
  await fs.writeFile(favicon, faviconBuffer)
}

async function makeOgImage() {
  const logo = await sharp(sourceLogo)
    .resize(190, 190, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const svg = `
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="45%" r="65%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
        <stop offset="45%" stop-color="#064e3b" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#03150f"/>
        <stop offset="50%" stop-color="#052018"/>
        <stop offset="100%" stop-color="#020617"/>
      </linearGradient>
    </defs>

    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="600" cy="285" r="360" fill="url(#glow)"/>

    <rect x="70" y="70" width="1060" height="490" rx="44" fill="#061b14" opacity="0.82"/>
    <rect x="70.5" y="70.5" width="1059" height="489" rx="43.5" fill="none" stroke="#34d399" stroke-opacity="0.18"/>

    <text x="420" y="250" fill="#f8fafc" font-size="82" font-weight="800" font-family="Arial, sans-serif">
      Viresto
    </text>

    <text x="420" y="318" fill="#6ee7b7" font-size="38" font-weight="700" font-family="Arial, sans-serif">
      Legal Practice Management Platform
    </text>

    <text x="420" y="382" fill="#cbd5e1" font-size="30" font-weight="500" font-family="Arial, sans-serif">
      Cases • Clients • Documents • Appointments • Invoices
    </text>

    <text x="420" y="442" fill="#94a3b8" font-size="24" font-weight="500" font-family="Arial, sans-serif">
      Manage your law firm from one secure workspace.
    </text>
  </svg>
  `

  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: '#03150f',
    },
  })
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
      {
        input: logo,
        top: 220,
        left: 185,
      },
    ])
    .png()
    .toFile(ogImage)
}

async function makeManifest() {
  const data = {
    name: 'Viresto',
    short_name: 'Viresto',
    description:
      'Legal practice management platform for law firms.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#03150f',
    theme_color: '#10b981',
    dir: 'rtl',
    lang: 'ar',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }

  await fs.writeFile(manifest, JSON.stringify(data, null, 2))
}

async function main() {
  await ensureSourceLogo()

  await makeIcon(48, icon48)
  await makeIcon(192, icon192)
  await makeIcon(512, icon512)
  await makeAppleIcon()
  await makeFavicon()
  await makeOgImage()
  await makeManifest()

  console.log('SEO assets generated successfully:')
  console.log('public/favicon.ico')
  console.log('public/icon-48.png')
  console.log('public/icon-192.png')
  console.log('public/icon-512.png')
  console.log('public/apple-touch-icon.png')
  console.log('public/og-image.png')
  console.log('public/site.webmanifest')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})