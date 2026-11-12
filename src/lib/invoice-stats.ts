// The figures of the invoice list's stat cards (GET /api/invoices).

import { collectedTotal, effectiveInvoiceState, roundMoney } from "@/lib/finance";

/** Still to collect: the "unpaid" card and its OUTSTANDING filter. */
export const OUTSTANDING_INVOICE_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "OVERDUE",
] as const;

export type InvoiceStatRow = {
  total: unknown;
  status: string;
  dueDate: Date | string | null;
  client?: { archivedAt: Date | null } | null;
  case?: { client?: { archivedAt: Date | null } | null } | null;
  /** PAID payments only. */
  payments: Array<{ amount: unknown }>;
};

export type InvoiceStats = {
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  overdueCount: number;
  paidCount: number;
  archivedCount: number;
  totalCount: number;
};

/**
 * Invoices of archived clients are records: they count in every figure
 * (a debt must not vanish from "uncollected"), and archivedCount is the
 * subset behind the "archived clients" card.
 *
 * Drafts are not issued and cancelled invoices are void, so neither is in
 * the money figures. They still count in totalCount and archivedCount,
 * whose cards open lists that show them.
 */
export function summarizeInvoiceStats(
  rows: InvoiceStatRow[],
  now: Date = new Date(),
): InvoiceStats {
  const stats: InvoiceStats = {
    totalAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    overdueCount: 0,
    paidCount: 0,
    archivedCount: 0,
    totalCount: rows.length,
  };

  for (const invoice of rows) {
    const invoiceTotal = Number(invoice.total || 0);
    const paid = collectedTotal(invoice.payments);
    // Effective status: a legacy stored OVERDUE is read from its payments,
    // and "overdue" comes from the due date (finance.ts).
    const { status, isOverdue } = effectiveInvoiceState(
      { status: invoice.status, total: invoice.total, dueDate: invoice.dueDate, paidTotal: paid },
      now,
    );

    if (status !== "DRAFT" && status !== "CANCELLED") {
      stats.totalAmount += invoiceTotal;
      stats.paidAmount += paid;
    }
    if ((OUTSTANDING_INVOICE_STATUSES as readonly string[]).includes(status)) {
      stats.unpaidAmount += Math.max(0, invoiceTotal - paid);
    }
    if (isOverdue) stats.overdueCount += 1;
    if (status === "PAID") stats.paidCount += 1;
    if (invoice.client?.archivedAt || invoice.case?.client?.archivedAt) {
      stats.archivedCount += 1;
    }
  }

  return stats;
}

/** Invoice statuses stored by current code that are still to collect. */
export const OPEN_INVOICE_STATUSES = ["UNPAID", "PARTIALLY_PAID"] as const;
/** Stored statuses that count in the money figures (issued, not void). */
export const ISSUED_INVOICE_STATUSES = ["PAID", "UNPAID", "PARTIALLY_PAID"] as const;

/**
 * The stat cards' inputs as the database aggregates them
 * (src/lib/server/invoice-stats-query.ts). Every figure is over the
 * invoices the user can see.
 *
 * A legacy stored OVERDUE invoice takes its status from its payments, which
 * an aggregate cannot express, so those rows (few, and never written by
 * current code) are summarised one by one with summarizeInvoiceStats and
 * kept out of every other part.
 */
export type InvoiceStatParts = {
  /** Count and summed total per stored status, all statuses. */
  byStatus: Array<{ status: string; count: number; total: number }>;
  /** PAID payments on PAID, UNPAID and PARTIALLY_PAID invoices. */
  paidOnIssued: number;
  /** PAID payments on UNPAID and PARTIALLY_PAID invoices. */
  paidOnOpen: number;
  /** UNPAID or PARTIALLY_PAID invoices past their due date (pastDueBefore). */
  overdueOpen: number;
  /** Invoices of an archived client (directly or through the case), all statuses. */
  archived: number;
  /** summarizeInvoiceStats over the stored OVERDUE invoices only. */
  legacyOverdue: InvoiceStats;
};

/**
 * Same figures as summarizeInvoiceStats over every row, from aggregates.
 *
 * "Still to collect" is total minus collected per open invoice, summed.
 * Summing the two sides separately is the same because an open invoice
 * always has collected < total: syncInvoiceStatus makes it PAID once
 * collected reaches the total, and its amounts cannot be edited after a
 * collected payment (PATCH /api/invoices/[id]).
 */
export function combineInvoiceStats(parts: InvoiceStatParts): InvoiceStats {
  const issued = ISSUED_INVOICE_STATUSES as readonly string[];
  const open = OPEN_INVOICE_STATUSES as readonly string[];
  let totalCount = 0;
  let issuedTotal = 0;
  let openTotal = 0;
  let paidCount = 0;

  for (const row of parts.byStatus) {
    totalCount += row.count;
    if (issued.includes(row.status)) issuedTotal += row.total;
    if (open.includes(row.status)) openTotal += row.total;
    if (row.status === "PAID") paidCount += row.count;
  }

  const legacy = parts.legacyOverdue;
  return {
    totalAmount: roundMoney(issuedTotal + legacy.totalAmount),
    paidAmount: roundMoney(parts.paidOnIssued + legacy.paidAmount),
    unpaidAmount: roundMoney(Math.max(0, openTotal - parts.paidOnOpen) + legacy.unpaidAmount),
    overdueCount: parts.overdueOpen + legacy.overdueCount,
    paidCount: paidCount + legacy.paidCount,
    // Already over every status, legacy rows included.
    archivedCount: parts.archived,
    totalCount,
  };
}
