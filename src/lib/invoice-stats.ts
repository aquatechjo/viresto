// The figures of the invoice list's stat cards (GET /api/invoices).

/** Still to collect: the "unpaid" card and its OUTSTANDING filter. */
export const OUTSTANDING_INVOICE_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "OVERDUE",
] as const;

export type InvoiceStatRow = {
  total: unknown;
  status: string;
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
export function summarizeInvoiceStats(rows: InvoiceStatRow[]): InvoiceStats {
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
    const paid = invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );

    if (invoice.status !== "DRAFT" && invoice.status !== "CANCELLED") {
      stats.totalAmount += invoiceTotal;
      stats.paidAmount += paid;
    }
    if ((OUTSTANDING_INVOICE_STATUSES as readonly string[]).includes(invoice.status)) {
      stats.unpaidAmount += Math.max(0, invoiceTotal - paid);
    }
    if (invoice.status === "OVERDUE") stats.overdueCount += 1;
    if (invoice.status === "PAID") stats.paidCount += 1;
    if (invoice.client?.archivedAt || invoice.case?.client?.archivedAt) {
      stats.archivedCount += 1;
    }
  }

  return stats;
}
