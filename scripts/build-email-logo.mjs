// Builds public/email/viresto-logo.png, the logo in emails.
//
//   node scripts/build-email-logo.mjs                 (dark emails: light text)
//   EMAIL_LOGO_VARIANT=light node scripts/build-email-logo.mjs
//                                                     (light emails, the current
//                                                      layout: dark brand text)
//
// The project has no transparent or SVG logo, only the square app icon on
// its own dark background (public/icon-512.png). Emails get the same lockup
// as the landing page header (VirestoLogo in src/app/page.tsx): the icon in
// a rounded tile next to "Viresto" in the brand's light text colour, on a
// transparent background. Rendered at 2x for retina screens; the email shows
// it at half size (EMAIL_LOGO in src/lib/email/layout.ts, which must match
// what this prints). After changing the image, bump EMAIL_LOGO_VERSION there:
// Gmail caches images by URL.

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SCALE = 2;
const HEIGHT = 40 * SCALE; // shown 40px tall
const TILE = HEIGHT;
const RADIUS = 10 * SCALE;
const GAP = 10 * SCALE;
// Emails are light since the color plan (2026-11-07): the wordmark in the
// brand color of the light theme. The dark variant stays for emails sent
// before, which still point at the old file.
const VARIANT = process.env.EMAIL_LOGO_VARIANT === "light" ? "light" : "dark";
const TEXT = VARIANT === "light" ? "#082c2d" : "#f8fbfa"; // tokens.ts light sidebar / --brand-text
const OUT = VARIANT === "light" ? "public/email/viresto-logo-light.png" : "public/email/viresto-logo.png";
// A thin frame inside the tile's edge, so the icon's own dark background
// does not melt into the email's (#041819): --landing-copper, softened.
const FRAME = process.env.EMAIL_LOGO_FRAME ?? "rgba(184, 115, 51, 0.6)";
const FRAME_WIDTH = 1.5 * SCALE; // 1.5px on screen
const FONT_SIZE = 25 * SCALE;

const tileMask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}"><rect width="${TILE}" height="${TILE}" rx="${RADIUS}" ry="${RADIUS}"/></svg>`,
);

const inset = FRAME_WIDTH / 2;
const tileFrame = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}"><rect x="${inset}" y="${inset}" width="${TILE - FRAME_WIDTH}" height="${TILE - FRAME_WIDTH}" rx="${RADIUS - inset}" ry="${RADIUS - inset}" fill="none" stroke="${FRAME}" stroke-width="${FRAME_WIDTH}"/></svg>`,
);

const tile = await sharp(
  await sharp("public/icon-512.png")
    .resize(TILE, TILE)
    .ensureAlpha()
    .composite([{ input: tileMask, blend: "dest-in" }])
    .png()
    .toBuffer(),
)
  .composite([{ input: tileFrame }])
  .png()
  .toBuffer();

// The wordmark, trimmed to its ink so the lockup has no stray padding.
const word = await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FONT_SIZE * 6}" height="${HEIGHT * 2}">
      <text x="10" y="${HEIGHT * 1.3}" font-family="Segoe UI, Arial, sans-serif" font-size="${FONT_SIZE}"
            font-weight="800" letter-spacing="-0.5" fill="${TEXT}">Viresto</text>
    </svg>`,
  ),
)
  .png()
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
  .toBuffer({ resolveWithObject: true });

// Even dimensions, so the 1x size is a whole number.
const even = (n) => n + (n % 2);
const width = even(TILE + GAP + word.info.width);
const height = even(HEIGHT);

mkdirSync("public/email", { recursive: true });
const lockup = await sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: tile, left: 0, top: 0 },
    { input: word.data, left: TILE + GAP, top: Math.round((height - word.info.height) / 2) },
  ])
  .png()
  .toBuffer();

if (VARIANT === "dark") {
  await sharp(lockup).png({ compressionLevel: 9 }).toFile(OUT);
} else {
  // Light emails: the lockup on a solid white rounded tile, same outer size.
  // Gmail's dark mode (Android) darkens backgrounds but not images, so a
  // transparent logo with dark text would vanish there; on its own white
  // tile it stays readable whatever the email background becomes.
  const PAD_Y = 5 * SCALE; // 5px above and below the lockup
  const PAD_X = 8 * SCALE;
  const scale = Math.min((height - 2 * PAD_Y) / height, (width - 2 * PAD_X) / width);
  const inner = await sharp(lockup)
    .resize(Math.round(width * scale), Math.round(height * scale))
    .png()
    .toBuffer({ resolveWithObject: true });
  const plate = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${RADIUS}" ry="${RADIUS}" fill="#ffffff"/></svg>`,
  );
  await sharp(plate)
    .composite([{
      input: inner.data,
      left: Math.round((width - inner.info.width) / 2),
      top: Math.round((height - inner.info.height) / 2),
    }])
    .png({ compressionLevel: 9 })
    .toFile(OUT);
}

console.log(`${OUT} ${width}x${height} (shown at ${width / SCALE}x${height / SCALE})`);
