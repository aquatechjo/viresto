// Builds public/email/viresto-logo.png, the logo in emails.
//
//   node scripts/build-email-logo.mjs
//
// The project has no transparent or SVG logo, only the square app icon on
// its own dark background (public/icon-512.png). Emails get the same lockup
// as the landing page header (VirestoLogo in src/app/page.tsx): the icon in
// a rounded tile next to "Viresto" in the brand's light text colour, on a
// transparent background. Rendered at 2x for retina screens; the email shows
// it at half size (EMAIL_LOGO in src/lib/email/verification-email.ts, which
// must match what this prints).

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SCALE = 2;
const HEIGHT = 40 * SCALE; // shown 40px tall
const TILE = HEIGHT;
const RADIUS = 10 * SCALE;
const GAP = 10 * SCALE;
const TEXT = "#f8fbfa"; // --brand-text
const FONT_SIZE = 25 * SCALE;

const tileMask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}"><rect width="${TILE}" height="${TILE}" rx="${RADIUS}" ry="${RADIUS}"/></svg>`,
);

const tile = await sharp("public/icon-512.png")
  .resize(TILE, TILE)
  .ensureAlpha()
  .composite([{ input: tileMask, blend: "dest-in" }])
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
await sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: tile, left: 0, top: 0 },
    { input: word.data, left: TILE + GAP, top: Math.round((height - word.info.height) / 2) },
  ])
  .png({ compressionLevel: 9 })
  .toFile("public/email/viresto-logo.png");

console.log(`public/email/viresto-logo.png ${width}x${height} (shown at ${width / SCALE}x${height / SCALE})`);
