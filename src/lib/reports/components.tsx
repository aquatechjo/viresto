// The building blocks of every printed report. Plain React elements with
// no hooks, no state and no browser APIs: render.ts turns a tree of them
// into a standalone HTML document, so the same report can be printed from
// the browser today or rendered on the server (Puppeteer) later.
//
// Text goes through React, which escapes it: data never becomes markup.

import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/theme/status";
import { buildReportCss, cssString, REPORT_FONT_STACK } from "./styles";
import { REPORT_EMPTY, reportDate, type ReportLocale } from "./format";
import { formatPhoneForDisplay } from "@/lib/phone";

export type ReportOffice = {
  name: string;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export type ReportMeta = {
  /** Window title; browsers use it as the PDF's file name. */
  documentTitle: string;
  /** e.g. "CF-1024-20261110". */
  number: string;
  issuedAt: Date;
  office: ReportOffice;
  /** Absolute origin the fonts (and a relative logo) load from. */
  assetBaseUrl: string;
  /** "ar" (the default, RTL) or "en" (LTR: invoices and receipts). */
  locale?: ReportLocale;
  /**
   * The header's key/value lines. Default: the report number and the
   * issue date; an invoice shows its own number and date instead.
   */
  headerRows?: { label: string; value: string; numeric?: boolean }[];
};

const LAYOUT_COPY = {
  ar: { number: "رقم التقرير", issued: "تاريخ الإصدار", page: "صفحة ", of: " من " },
  en: { number: "Report number", issued: "Issue date", page: "Page ", of: " of " },
} as const;

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

export function ReportLayout({ meta, children }: { meta: ReportMeta; children: ReactNode }) {
  const locale = meta.locale ?? "ar";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      {/* eslint-disable-next-line @next/next/no-head-element -- a standalone print document, not a Next page */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{meta.documentTitle}</title>
        <style dangerouslySetInnerHTML={{ __html: buildReportCss(meta.assetBaseUrl) }} />
      </head>
      <body>
        <ReportHeader meta={meta} />
        <main>{children}</main>
        <ReportFooter locale={locale} />
      </body>
    </html>
  );
}

/* ------------------------------------------------------------------ */
/* Header and footer                                                   */
/* ------------------------------------------------------------------ */

export function ReportHeader({ meta }: { meta: ReportMeta }) {
  const { office } = meta;
  const initial = office.name.trim().slice(0, 1) || "V";
  const contact = officeContactLine(office);
  const locale = meta.locale ?? "ar";
  const rows = meta.headerRows ?? [
    { label: LAYOUT_COPY[locale].number, value: meta.number, numeric: true },
    { label: LAYOUT_COPY[locale].issued, value: reportDate(meta.issuedAt, locale) },
  ];

  return (
    <header className="report-header">
      <div className="report-office">
        <div className="report-logo">
          {office.logoUrl ? (
            <img src={office.logoUrl} alt={office.name} />
          ) : (
            <span className="report-logo-initial">{initial}</span>
          )}
        </div>
        <div>
          <div className="report-office-name">{office.name}</div>
          {contact ? <div className="report-office-contact">{contact}</div> : null}
          <div className="report-powered">Powered by Viresto</div>
        </div>
      </div>
      <dl className="report-meta">
        {rows.map((row) => (
          <div key={row.label} className="report-meta-row">
            <dt>{row.label}</dt>
            <dd className={row.numeric ? "num" : undefined}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

/** "phone · email · address": the office's contact line, in the header. */
export function officeContactLine(office: ReportOffice): string {
  return [office.phone ? formatPhoneForDisplay(office.phone) : null, office.email, office.address]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("  ·  ");
}

/**
 * "صفحة X من Y" / "Page X of Y" at the bottom of every page, in the page
 * margin. Margin boxes are drawn by Chrome and Edge (131+); other browsers
 * print without page numbers, and lose nothing else (the office's contact
 * details are in the header).
 */
export function ReportFooter({ locale = "ar" }: { locale?: ReportLocale }) {
  const copy = LAYOUT_COPY[locale];
  const css = `@page {
  @bottom-center {
    content: ${cssString(copy.page)} counter(page) ${cssString(copy.of)} counter(pages);
    font-family: ${REPORT_FONT_STACK};
    font-size: 7.5pt;
    color: var(--muted);
    direction: ${locale === "ar" ? "rtl" : "ltr"};
    vertical-align: middle;
  }
}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/* ------------------------------------------------------------------ */
/* Title and sections                                                  */
/* ------------------------------------------------------------------ */

export function ReportTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <>
      <h1 className="report-title">{children}</h1>
      {subtitle ? <p className="report-subtitle">{subtitle}</p> : null}
    </>
  );
}

export type ReportSectionProps = {
  title: string;
  /** Shown beside the title, e.g. the number of rows. */
  count?: number;
  /** A short line under the title: what the numbers cover, "10 of 23". */
  note?: string;
  /** No data: show the title and `emptyMessage` instead of the content. */
  isEmpty?: boolean;
  emptyMessage?: string;
  /** No data: leave the whole section out. */
  hideWhenEmpty?: boolean;
  children?: ReactNode;
};

export function ReportSection({
  title,
  count,
  note,
  isEmpty = false,
  emptyMessage = "لا توجد بيانات",
  hideWhenEmpty = false,
  children,
}: ReportSectionProps) {
  if (isEmpty && hideWhenEmpty) return null;

  return (
    <section className="report-section">
      <h2 className="report-section-title">
        <span>{title}</span>
        {count !== undefined && !isEmpty ? <span className="report-section-count num">{count}</span> : null}
      </h2>
      {note && !isEmpty ? <p className="report-section-note">{note}</p> : null}
      {isEmpty ? <p className="report-empty">{emptyMessage}</p> : children}
    </section>
  );
}

/** A titled part of a section, e.g. "upcoming" and "past" sessions. */
export function ReportSubsection({
  title,
  isEmpty = false,
  emptyMessage = "لا توجد بيانات",
  children,
}: {
  title: string;
  isEmpty?: boolean;
  emptyMessage?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <h3 className="report-subsection-title">{title}</h3>
      {isEmpty ? <p className="report-empty">{emptyMessage}</p> : children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export type ReportColumn<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** CSS width, e.g. "18%". */
  width?: string;
  align?: "start" | "center" | "end";
  /** Numbers, amounts, codes: laid out left to right, never wrapped. */
  numeric?: boolean;
  strong?: boolean;
};

/**
 * Rows never split across pages, and the header row repeats on each new
 * page. The first column is the row's main identifier: in RTL it is the
 * rightmost.
 */
export function ReportTable<Row>({
  columns,
  rows,
  rowKey,
}: {
  columns: ReportColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
}) {
  return (
    <table className="report-table">
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={column.width ? { width: column.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col" className={alignClass(column.align)}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={rowKey(row, index)}>
            {columns.map((column) => {
              const className = [alignClass(column.align), column.strong ? "cell-strong" : ""]
                .filter(Boolean)
                .join(" ");
              const value = column.cell(row);
              return (
                <td key={column.key} className={className || undefined}>
                  {column.numeric ? <span className="num">{value}</span> : value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function alignClass(align: ReportColumn<unknown>["align"]) {
  return align === "center" ? "align-center" : align === "end" ? "align-end" : "";
}

/** A main line with a smaller muted note under it. */
export function CellWithNote({ children, note }: { children: ReactNode; note?: string | null }) {
  return (
    <>
      {children}
      {note ? <div className="cell-note">{note}</div> : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Info grid, summary cards, badges                                    */
/* ------------------------------------------------------------------ */

export type InfoItem = {
  label: string;
  value: string | null | undefined;
  /** Phone numbers, IDs: left to right. */
  numeric?: boolean;
  /** Spans both columns (addresses, notes). */
  wide?: boolean;
};

export function InfoGrid({ items, emptyValue = "غير مسجل" }: { items: InfoItem[]; emptyValue?: string }) {
  return (
    <dl className="info-grid">
      {items.map((item) => {
        const empty = !item.value || item.value === REPORT_EMPTY;
        const className = ["info-item", item.wide ? "wide" : "", empty ? "is-empty" : ""].filter(Boolean).join(" ");
        return (
          <div key={item.label} className={className}>
            <dt>{item.label}</dt>
            <dd>{empty ? emptyValue : item.numeric ? <span className="num">{item.value}</span> : item.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export type SummaryCard = {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "accent";
  /**
   * Amounts, counts and codes are laid out left to right (the default).
   * Set false for words, such as an Arabic date ("6 تشرين الثاني 2026"),
   * which a left-to-right run would scramble.
   */
  numeric?: boolean;
};

export function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="summary-cards" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
      {cards.map((card) => (
        <div key={card.label} className={`summary-card${card.tone === "accent" ? " tone-accent" : ""}`}>
          <div className="summary-card-label">{card.label}</div>
          <div className="summary-card-value">
            {card.numeric === false ? card.value : <span className="num">{card.value}</span>}
          </div>
          {card.hint ? <div className="summary-card-hint">{card.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

/** A status chip. Takes a label, never a raw enum: see labels.ts. */
export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

/* ------------------------------------------------------------------ */
/* Documents: invoice and receipt                                      */
/* ------------------------------------------------------------------ */

/** A large tilted mark across the first page, e.g. "cancelled". */
export function Stamp({ children }: { children: ReactNode }) {
  return (
    <div className="report-stamp" aria-hidden="true">
      {children}
    </div>
  );
}

/** A highlighted note, e.g. why a document was cancelled. */
export function NoticeBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="report-notice">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/** Label / amount lines ending in a highlighted grand total. */
export function TotalsList({ rows }: { rows: { label: string; value: string; grand?: boolean }[] }) {
  return (
    <dl className="report-totals">
      {rows.map((row) => (
        <div key={row.label} className={`report-totals-row${row.grand ? " grand" : ""}`}>
          <dt>{row.label}</dt>
          <dd>
            <span className="num">{row.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Free text in a bordered box (notes). */
export function TextBox({ children }: { children: ReactNode }) {
  return <p className="report-text-box">{children}</p>;
}

/** Signature lines with their captions. */
export function SignatureLines({ labels }: { labels: string[] }) {
  return (
    <div className="report-signatures">
      {labels.map((label) => (
        <div key={label} className="report-signature">
          {label}
        </div>
      ))}
    </div>
  );
}

/** A short centred closing line, e.g. who generated the document. */
export function ClosingLine({ children }: { children: ReactNode }) {
  return <p className="report-closing">{children}</p>;
}
