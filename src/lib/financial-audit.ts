export type PaymentState = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

const PAYMENT_TRANSITIONS: Record<PaymentState, ReadonlySet<PaymentState>> = {
  PENDING: new Set(["PENDING", "PAID", "OVERDUE", "CANCELLED"]),
  OVERDUE: new Set(["OVERDUE", "PENDING", "PAID", "CANCELLED"]),
  PAID: new Set(["PAID", "CANCELLED"]),
  CANCELLED: new Set(["CANCELLED"]),
};

export function canTransitionPayment(
  current: PaymentState,
  next: PaymentState,
) {
  return PAYMENT_TRANSITIONS[current].has(next);
}

export function requiresPaymentCancellationReason(
  current: PaymentState,
  next: PaymentState,
) {
  return current !== "CANCELLED" && next === "CANCELLED";
}

export function isPaymentFinanciallyLocked(status: PaymentState) {
  return status === "PAID" || status === "CANCELLED";
}

export function formatSequentialInvoiceNumber(year: number, sequence: number) {
  if (
    !Number.isSafeInteger(year) ||
    year < 2000 ||
    year > 9999 ||
    !Number.isSafeInteger(sequence) ||
    sequence <= 0
  ) {
    throw new Error("INVALID_INVOICE_SEQUENCE");
  }

  return `INV-${year}-${String(sequence).padStart(4, "0")}`;
}
