import type { InvoiceStatus, Prisma } from "@prisma/client";
import { MONEY_EPSILON, roundJod } from "@/lib/money";
import { isPastDue, pastDueBefore } from "@/lib/datetime";

export const roundMoney = roundJod;

// Stored invoice statuses: DRAFT, UNPAID, PARTIALLY_PAID, PAID, CANCELLED.
// "Overdue" is never stored (decision of 2026-11-06): it is computed when
// read, from the due date (effectiveInvoiceState). OVERDUE stays in the
// database enum because rows saved before then may hold it; their real
// status is derived from their collected payments, since the old code could
// write OVERDUE over a partly paid invoice.

/** A status as shown and filtered: never OVERDUE. */
export type InvoiceState = Exclude<InvoiceStatus, "OVERDUE">;

/** UNPAID, PARTIALLY_PAID or PAID from the collected (PAID) payments. */
export function invoiceStatusFromPayments(
  total: number,
  paidTotal: number,
): "UNPAID" | "PARTIALLY_PAID" | "PAID" {
  const normalizedTotal = roundMoney(total);
  const normalizedPaidTotal = roundMoney(paidTotal);

  if (
    normalizedTotal > 0 &&
    normalizedPaidTotal + MONEY_EPSILON >= normalizedTotal
  ) {
    return "PAID";
  }

  if (normalizedPaidTotal > MONEY_EPSILON) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
}

interface CalculateInvoiceStatusInput {
  currentStatus: InvoiceStatus;
  total: number;
  paidTotal: number;
}

/** The status to store after a payment of the invoice changes. */
export function calculateInvoiceStatus({
  currentStatus,
  total,
  paidTotal,
}: CalculateInvoiceStatusInput): InvoiceState {
  // الفاتورة المسودة أو الملغاة لا تتغير تلقائيًا.
  if (currentStatus === "DRAFT" || currentStatus === "CANCELLED") {
    return currentStatus;
  }

  return invoiceStatusFromPayments(total, paidTotal);
}

export interface InvoiceStateInput {
  status: InvoiceStatus | string;
  total: unknown;
  dueDate: Date | string | null | undefined;
  /** The total of the invoice's collected (PAID) payments. */
  paidTotal: number;
}

export interface EffectiveInvoiceState {
  status: InvoiceState;
  /** Unpaid or partly paid, and past due (from the next Amman day). */
  isOverdue: boolean;
}

/**
 * What an invoice is now: its stored status (or, for a legacy stored
 * OVERDUE, the status its collected payments give), plus whether it is
 * overdue. Pages, filters, figures and the printout all go through this.
 */
export function effectiveInvoiceState(
  invoice: InvoiceStateInput,
  now: Date = new Date(),
): EffectiveInvoiceState {
  const status: InvoiceState =
    invoice.status === "OVERDUE"
      ? invoiceStatusFromPayments(Number(invoice.total || 0), invoice.paidTotal)
      : (invoice.status as InvoiceState);

  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const isOverdue =
    (status === "UNPAID" || status === "PARTIALLY_PAID") &&
    isPastDue(dueDate, now);

  return { status, isOverdue };
}

/** The total of the PAID payments in a list (any other status is ignored). */
export function collectedTotal(
  payments: ReadonlyArray<{ status?: string | null; amount: unknown }> | null | undefined,
): number {
  return roundMoney(
    (payments ?? [])
      .filter((payment) => payment.status === undefined || payment.status === "PAID")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
  );
}

/**
 * An invoice with its effective status in `status` and `isOverdue` added,
 * for API responses. `payments` must hold the invoice's payments (with
 * their status), or only its PAID ones (without a status).
 */
export function withInvoiceState<
  T extends {
    status: InvoiceStatus | string;
    total: unknown;
    dueDate: Date | string | null;
    payments?: ReadonlyArray<{ status?: string | null; amount: unknown }>;
  },
>(invoice: T, now: Date = new Date()): Omit<T, "status"> & EffectiveInvoiceState {
  const state = effectiveInvoiceState(
    { ...invoice, paidTotal: collectedTotal(invoice.payments) },
    now,
  );
  return { ...invoice, ...state };
}

/**
 * The Prisma filter for an invoice-status filter value, matching
 * effectiveInvoiceState: OVERDUE is computed from the due date, and a legacy
 * stored OVERDUE counts as UNPAID without a collected payment and as
 * PARTIALLY_PAID with one. (A legacy row fully paid would show as PAID but be
 * filtered as PARTIALLY_PAID; the old code never stored OVERDUE on a paid
 * invoice.)
 */
export function invoiceStatusWhere(
  status: string,
  now: Date = new Date(),
): Prisma.InvoiceWhereInput {
  switch (status) {
    case "":
      return {};
    case "OVERDUE":
      return {
        status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
        dueDate: { lt: pastDueBefore(now) },
      };
    case "UNPAID":
      return {
        OR: [
          { status: "UNPAID" },
          { status: "OVERDUE", payments: { none: { status: "PAID" } } },
        ],
      };
    case "PARTIALLY_PAID":
      return {
        OR: [
          { status: "PARTIALLY_PAID" },
          { status: "OVERDUE", payments: { some: { status: "PAID" } } },
        ],
      };
    default:
      return { status: status as InvoiceStatus };
  }
}

interface SyncInvoiceStatusInput {
  tenantId: string;
  invoiceId: string;
}

export async function syncInvoiceStatus(
  tx: Prisma.TransactionClient,
  { tenantId, invoiceId }: SyncInvoiceStatusInput,
) {
  const invoice = await tx.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId,
    },
    select: {
      id: true,
      status: true,
      total: true,
      dueDate: true,
      payments: {
        where: {
          status: "PAID",
        },
        select: {
          amount: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("INVOICE_NOT_FOUND");
  }

  const paidTotal = roundMoney(
    invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    ),
  );

  const total = roundMoney(Number(invoice.total));
  const remaining = roundMoney(Math.max(0, total - paidTotal));

  const nextStatus = calculateInvoiceStatus({
    currentStatus: invoice.status,
    total,
    paidTotal,
  });

  if (nextStatus !== invoice.status) {
    await tx.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        status: nextStatus,
      },
    });
  }

  return {
    invoiceId: invoice.id,
    previousStatus: invoice.status,
    status: nextStatus,
    total,
    paidTotal,
    remaining,
  };
}
