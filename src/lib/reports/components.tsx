// The building blocks of every printed report. Plain React elements with
// no hooks, no state and no browser APIs: render.ts turns a tree of them
// into a standalone HTML document, so the same report can be printed from
// the browser today or rendered on the server (Puppeteer) later.
//
// Text goes through React, which escapes it: data never becomes markup.

import type { ReactNode } from "react";
import type { StatusTone } from "@/lib/theme/status";
import { buildReportCss, cssString, REPORT_FONT_STACK } from "./styles";
import { REPORT_EMPTY, reportDate } from "./format";
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
};

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

export function ReportLayout({ meta, children }: { meta: ReportMeta; children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
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
        <ReportFooter />
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
        <dt>رقم التقرير</dt>
        <dd className="num">{meta.number}</dd>
        <dt>تاريخ الإصدار</dt>
        <dd>{reportDate(meta.issuedAt)}</dd>
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
 * "صفحة X من Y" at the bottom of every page, in the page margin. Margin
 * boxes are drawn by Chrome and Edge (131+); other browsers print without
 * page numbers, and lose nothing else (the office's contact details are in
 * the header).
 */
export function ReportFooter() {
  const css = `@page {
  @bottom-center {
    content: ${cssString("صفحة ")} counter(page) ${cssString(" من ")} counter(pages);
    font-family: ${REPORT_FONT_STACK};
    font-size: 7.5pt;
    color: var(--muted);
    direction: rtl;
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
};

export function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="summary-cards" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
      {cards.map((card) => (
        <div key={card.label} className={`summary-card${card.tone === "accent" ? " tone-accent" : ""}`}>
          <div className="summary-card-label">{card.label}</div>
          <div className="summary-card-value">
            <span className="num">{card.value}</span>
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
