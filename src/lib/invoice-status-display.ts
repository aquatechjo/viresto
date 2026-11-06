// How an invoice's status reads on a page or a printout. The API sends the
// effective status (never OVERDUE) and `isOverdue` (finance.ts,
// effectiveInvoiceState); "overdue" is shown on top of the status.

/** The key of the badge colour: OVERDUE (red) when overdue. */
export function invoiceStatusTone(status: string, isOverdue?: boolean | null) {
  return isOverdue ? "OVERDUE" : status;
}

/**
 * The status label: "Overdue" for an unpaid overdue invoice, "Partially
 * paid • Overdue" for a partly paid one, otherwise the status itself.
 * `labels` holds the label of every status, OVERDUE included.
 */
export function invoiceStatusText(
  status: string,
  isOverdue: boolean | null | undefined,
  labels: Record<string, string>,
) {
  if (isOverdue && status === "PARTIALLY_PAID") {
    return `${labels.PARTIALLY_PAID} • ${labels.OVERDUE}`;
  }
  if (isOverdue) return labels.OVERDUE;
  return labels[status] ?? status;
}
