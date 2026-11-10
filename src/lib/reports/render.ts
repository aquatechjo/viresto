// A report element tree → a standalone HTML document. Renderer-agnostic:
// the browser prints the string (print.ts); a server could hand the same
// string to Puppeteer for a PDF.

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export function renderReportHtml(element: ReactElement): string {
  return `<!DOCTYPE html>${renderToStaticMarkup(element)}`;
}
