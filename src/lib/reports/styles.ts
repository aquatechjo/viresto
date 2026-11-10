// The stylesheet of every printed report: A4, right to left, the Cairo
// font served from /fonts/cairo, and the app's light palette (tokens.ts is
// the one source of colors). Mostly white paper: the brand color is kept to
// the header band, table heads and small accents, so pages read and print
// well in black and white too.

import { themeTokens } from "@/lib/theme/tokens";
import type { StatusTone } from "@/lib/theme/status";

const P = themeTokens.light;

const TONES: StatusTone[] = ["green", "amber", "blue", "red", "gray"];

/** Cairo's Arabic and Latin subsets (unicode ranges from Fontsource 5.3.0). */
const ARABIC_RANGE =
  "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC";
const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

/**
 * A value for a CSS `content: "..."` string: quotes, backslashes, line
 * breaks and "<" escaped, so office data can never close the string or the
 * <style> element.
 */
export function cssString(value: string): string {
  const escaped = value.replace(/[\\"<>\n\r\f]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `);
  return `"${escaped}"`;
}

function fontFaces(assetBaseUrl: string): string {
  const base = `${assetBaseUrl.replace(/\/+$/, "")}/fonts/cairo`;
  return (["arabic", "latin"] as const)
    .flatMap((subset) =>
      ([400, 700] as const).map(
        (weight) => `@font-face {
  font-family: "Cairo Report";
  font-style: normal;
  font-weight: ${weight};
  font-display: block;
  src: url("${base}/cairo-${subset}-${weight}-normal.woff2") format("woff2");
  unicode-range: ${subset === "arabic" ? ARABIC_RANGE : LATIN_RANGE};
}`,
      ),
    )
    .join("\n");
}

const toneVariables = TONES.map(
  (tone) =>
    `  --tone-${tone}-fg: ${P[`tone-${tone}-fg`]};\n  --tone-${tone}-bg: ${P[`tone-${tone}-bg`]};\n  --tone-${tone}-border: ${P[`tone-${tone}-border`]};`,
).join("\n");

const toneClasses = TONES.map(
  (tone) =>
    `.badge-${tone} { color: var(--tone-${tone}-fg); background: var(--tone-${tone}-bg); border-color: var(--tone-${tone}-border); }`,
).join("\n");

export const REPORT_FONT_STACK = `"Cairo Report", "Cairo", Tahoma, Arial, sans-serif`;

export function buildReportCss(assetBaseUrl: string): string {
  return `${fontFaces(assetBaseUrl)}
:root {
  --brand: ${P.sidebar};
  --brand-muted: ${P["sidebar-muted"]};
  --accent: ${P.gold};
  --accent-soft: ${P["gold-soft"]};
  --accent-border: ${P["gold-border"]};
  --ink: ${P.text};
  --ink-2: ${P["text-2"]};
  --muted: ${P["text-3"]};
  --line: ${P.border};
  --line-strong: ${P["border-dark"]};
  --soft: ${P["surface-2"]};
  --head: ${P["green-soft"]};
  --paper: #ffffff;
${toneVariables}
}

@page {
  size: A4;
  margin: 14mm 13mm 17mm;
}

* { box-sizing: border-box; }

html {
  color-scheme: light only;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: ${REPORT_FONT_STACK};
  font-size: 10pt;
  line-height: 1.65;
  direction: rtl;
  text-align: right;
}

@media screen {
  html { background: #e9eeed; }
  body {
    width: 210mm;
    min-height: 297mm;
    margin: 24px auto;
    padding: 14mm 13mm;
    box-shadow: 0 10px 40px rgba(8, 44, 45, 0.16);
  }
}

.num {
  direction: ltr;
  unicode-bidi: isolate;
  white-space: nowrap;
}

.muted { color: var(--muted); }

/* Header: the one place with a colored background. */
.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 10px;
  border-bottom: 3px solid var(--accent);
  background: var(--brand);
  color: #ffffff;
  break-inside: avoid;
}
.report-office { display: flex; align-items: center; gap: 12px; min-width: 0; }
.report-logo {
  flex: 0 0 auto;
  width: 50px;
  height: 50px;
  border-radius: 10px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.report-logo img { width: 100%; height: 100%; object-fit: contain; padding: 5px; }
.report-logo-initial { color: var(--brand); font-size: 22pt; font-weight: 700; line-height: 1; }
.report-office-name { font-size: 14pt; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.report-powered { font-size: 7.5pt; color: var(--brand-muted); direction: ltr; unicode-bidi: isolate; }
.report-meta { flex: 0 0 auto; display: grid; grid-template-columns: auto auto; gap: 2px 10px; font-size: 8.5pt; }
.report-meta dt { color: var(--brand-muted); }
.report-meta dd { margin: 0; font-weight: 700; }

.report-title {
  margin: 18px 0 4px;
  font-size: 17pt;
  font-weight: 700;
  line-height: 1.4;
  color: var(--brand);
}
.report-subtitle { margin: 0 0 6px; color: var(--muted); font-size: 9pt; }

/* Sections */
.report-section { margin-top: 18px; }
.report-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  padding-inline-start: 9px;
  border-inline-start: 3px solid var(--accent);
  font-size: 11.5pt;
  font-weight: 700;
  line-height: 1.5;
  color: var(--brand);
  break-after: avoid;
  page-break-after: avoid;
}
.report-section-count {
  padding: 0 7px;
  border-radius: 999px;
  background: var(--soft);
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 8pt;
  font-weight: 700;
}
.report-subsection-title {
  margin: 12px 0 6px;
  font-size: 9.5pt;
  font-weight: 700;
  color: var(--ink-2);
  break-after: avoid;
  page-break-after: avoid;
}
.report-empty {
  margin: 0;
  padding: 8px 12px;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  color: var(--muted);
  font-size: 9pt;
  break-inside: avoid;
}

/* Key / value grid */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 22px;
  margin: 0;
}
.info-item {
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  break-inside: avoid;
  min-width: 0;
}
.info-item.wide { grid-column: 1 / -1; }
.info-item dt { color: var(--muted); font-size: 8.5pt; }
.info-item dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; white-space: pre-wrap; }
.info-item.is-empty dd { color: var(--muted); font-weight: 400; }

/* Summary cards */
.summary-cards { display: grid; gap: 10px; break-inside: avoid; }
.summary-card {
  min-width: 0;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--soft);
}
.summary-card-label { color: var(--muted); font-size: 8.5pt; }
.summary-card-value { font-size: 13.5pt; font-weight: 700; line-height: 1.5; }
.summary-card-hint { color: var(--muted); font-size: 7.5pt; }
.summary-card.tone-accent { background: var(--accent-soft); border-color: var(--accent-border); }
.summary-card.tone-accent .summary-card-value { color: var(--brand); }

/* Tables */
.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
}
.report-table thead { display: table-header-group; }
.report-table tr { break-inside: avoid; page-break-inside: avoid; }
.report-table th {
  padding: 6px 8px;
  background: var(--head);
  color: var(--brand);
  border-bottom: 1.5px solid var(--brand);
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
}
.report-table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
  overflow-wrap: anywhere;
}
.report-table tbody tr:nth-child(even) td { background: var(--soft); }
.report-table .align-center { text-align: center; }
.report-table .align-end { text-align: left; }
.report-table .cell-strong { font-weight: 700; }
.cell-note { color: var(--muted); font-size: 8pt; white-space: pre-wrap; }

/* Status badges */
.badge {
  display: inline-block;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 8pt;
  font-weight: 700;
  line-height: 1.7;
  white-space: nowrap;
}
${toneClasses}
`;
}
