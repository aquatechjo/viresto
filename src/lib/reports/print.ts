// Printing a report from the browser: a new window gets the report's HTML,
// waits for the Tajawal font and the logo, then opens the print dialog
// ("Save as PDF"). Browser only.
//
// The window inherits the app's Content-Security-Policy (no inline scripts
// or event handlers), so everything is driven from this side: no <script>
// or onerror= in the report.

import { themeTokens } from "@/lib/theme/tokens";

const FONT_TIMEOUT_MS = 5000;
const LOGO_TIMEOUT_MS = 4000;

const P = themeTokens.light;

const LOADING_HTML = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>جارٍ تجهيز التقرير…</title></head>
<body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;font-family:Tahoma,Arial,sans-serif;color:${P["text-3"]};background:${P.bg}">جارٍ تجهيز التقرير…</body></html>`;

/**
 * Opens the report window. Call it straight from the click, before any
 * request: a window opened after an await is blocked as a pop-up.
 */
export function openReportWindow(): Window | null {
  const win = window.open("", "_blank", "width=1000,height=900");
  if (win) writeDocument(win, LOADING_HTML);
  return win;
}

/** A URL the report window can load: relative paths become absolute. */
export function absoluteUrl(url: string, base: string = window.location.origin): string {
  return /^(https?:|data:|blob:)/i.test(url) ? url : new URL(url, base).href;
}

/**
 * The logo if it loads, else null (the header then shows the office's
 * initial). Checked here because the report cannot carry an onerror.
 */
export async function usableLogoUrl(url: string | null | undefined): Promise<string | null> {
  if (!url?.trim()) return null;
  const src = absoluteUrl(url.trim());

  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(null), LOGO_TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image.naturalWidth > 0 ? src : null);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    image.src = src;
  });
}

function writeDocument(win: Window, html: string) {
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function withTimeout(promise: Promise<unknown>, ms: number) {
  return Promise.race([promise, new Promise((resolve) => window.setTimeout(resolve, ms))]);
}

async function waitForAssets(win: Window) {
  const fonts = win.document.fonts;
  // Ask for each face the report uses, so loading starts now and not at
  // first paint; then wait for everything pending.
  await withTimeout(
    Promise.all([
      fonts.load('500 12px "Tajawal Report"', "عربي"),
      fonts.load('700 12px "Tajawal Report"', "عربي"),
      fonts.load('500 12px "Tajawal Report"', "Viresto 0123456789"),
      fonts.load('700 12px "Tajawal Report"', "Viresto 0123456789"),
    ]).then(() => fonts.ready),
    FONT_TIMEOUT_MS,
  ).catch(() => undefined);

  const images = Array.from(win.document.images).filter((image) => !image.complete);
  await withTimeout(
    Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    ),
    LOGO_TIMEOUT_MS,
  );
}

/** Writes the report into the window and opens the print dialog. */
export async function printReportInWindow(win: Window, html: string): Promise<void> {
  writeDocument(win, html);
  await waitForAssets(win);
  if (win.closed) return;
  win.focus();
  win.print();
}
