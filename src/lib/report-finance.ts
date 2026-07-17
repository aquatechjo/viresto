import { DateTime } from "luxon";
import { roundMoney } from "@/lib/finance";

export const DEFAULT_REPORT_TIME_ZONE = "Asia/Amman";

type MonetaryValue = number | string | { toString(): string };

type ReportType = "monthly" | "yearly";

interface ReportPeriodInput {
  type: ReportType;
  year: number;
  month: number;
  timeZone: string;
}

export function normalizeReportTimeZone(value?: string | null) {
  const requested = value?.trim() || DEFAULT_REPORT_TIME_ZONE;
  const candidate = DateTime.now().setZone(requested);

  return candidate.isValid ? requested : DEFAULT_REPORT_TIME_ZONE;
}

export function getReportPeriod({
  type,
  year,
  month,
  timeZone,
}: ReportPeriodInput) {
  const zone = normalizeReportTimeZone(timeZone);
  const startInZone = DateTime.fromObject(
    {
      year,
      month: type === "monthly" ? month + 1 : 1,
      day: 1,
    },
    { zone },
  ).startOf("day");

  const endInZone =
    type === "monthly"
      ? startInZone.plus({ months: 1 })
      : startInZone.plus({ years: 1 });

  return {
    timeZone: zone,
    start: startInZone.toUTC().toJSDate(),
    end: endInZone.toUTC().toJSDate(),
  };
}

interface PaidPaymentInput {
  amount: MonetaryValue;
  paidAt: Date | null;
}

export function buildRollingMonthlyRevenue(
  payments: PaidPaymentInput[],
  now: Date,
  timeZone: string,
  monthsCount = 6,
) {
  const zone = normalizeReportTimeZone(timeZone);
  const count = Math.min(Math.max(Math.trunc(monthsCount), 1), 24);
  const currentMonth = DateTime.fromJSDate(now).setZone(zone).startOf("month");

  const buckets = Array.from({ length: count }, (_, index) => {
    const monthDate = currentMonth.minus({
      months: count - index - 1,
    });

    return {
      key: `${monthDate.year}-${String(monthDate.month).padStart(2, "0")}`,
      year: monthDate.year,
      month: monthDate.month,
      revenue: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const payment of payments) {
    if (!payment.paidAt) continue;

    const paidAt = DateTime.fromJSDate(payment.paidAt).setZone(zone);
    if (!paidAt.isValid) continue;

    const key = `${paidAt.year}-${String(paidAt.month).padStart(2, "0")}`;
    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.revenue = roundMoney(
        bucket.revenue + Number(payment.amount || 0),
      );
    }
  }

  return buckets;
}

export function buildMonthlyRevenue(
  payments: PaidPaymentInput[],
  year: number,
  timeZone: string,
) {
  const zone = normalizeReportTimeZone(timeZone);
  const buckets = Array.from({ length: 12 }, (_, month) => ({
    month,
    revenue: 0,
  }));

  for (const payment of payments) {
    if (!payment.paidAt) continue;

    const paidAt = DateTime.fromJSDate(payment.paidAt).setZone(zone);
    if (!paidAt.isValid || paidAt.year !== year) continue;

    const bucket = buckets[paidAt.month - 1];
    bucket.revenue = roundMoney(bucket.revenue + Number(payment.amount || 0));
  }

  return buckets;
}

export type InvoiceFinancialInput = {
  total: MonetaryValue;
  status: string;
  dueDate: Date | null;
  payments: Array<{ amount: MonetaryValue }>;
};

const NON_COLLECTIBLE_STATUSES = new Set(["DRAFT", "CANCELLED"]);

export function getInvoicePaidAmount(invoice: InvoiceFinancialInput) {
  const total = roundMoney(Number(invoice.total || 0));
  const paid = roundMoney(
    invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    ),
  );

  return roundMoney(Math.min(Math.max(paid, 0), Math.max(total, 0)));
}

export function getInvoiceRemainingAmount(invoice: InvoiceFinancialInput) {
  if (NON_COLLECTIBLE_STATUSES.has(invoice.status)) return 0;

  const total = roundMoney(Math.max(Number(invoice.total || 0), 0));
  return roundMoney(Math.max(total - getInvoicePaidAmount(invoice), 0));
}

export function isInvoiceOverdue(
  invoice: InvoiceFinancialInput,
  now = new Date(),
) {
  return Boolean(
    !NON_COLLECTIBLE_STATUSES.has(invoice.status) &&
      invoice.dueDate &&
      invoice.dueDate.getTime() < now.getTime() &&
      getInvoiceRemainingAmount(invoice) > 0,
  );
}

export function calculateInvoiceFinancialSummary(
  invoices: InvoiceFinancialInput[],
  now = new Date(),
) {
  let totalInvoicesAmount = 0;
  let paidInvoicesAmount = 0;
  let unpaidInvoicesAmount = 0;
  let overdueInvoicesAmount = 0;

  for (const invoice of invoices) {
    if (NON_COLLECTIBLE_STATUSES.has(invoice.status)) continue;

    const total = roundMoney(Math.max(Number(invoice.total || 0), 0));
    const paid = getInvoicePaidAmount(invoice);
    const remaining = getInvoiceRemainingAmount(invoice);

    totalInvoicesAmount = roundMoney(totalInvoicesAmount + total);
    paidInvoicesAmount = roundMoney(paidInvoicesAmount + paid);
    unpaidInvoicesAmount = roundMoney(unpaidInvoicesAmount + remaining);

    if (isInvoiceOverdue(invoice, now)) {
      overdueInvoicesAmount = roundMoney(overdueInvoicesAmount + remaining);
    }
  }

  const collectionRate =
    totalInvoicesAmount > 0
      ? Math.round((paidInvoicesAmount / totalInvoicesAmount) * 100)
      : 0;

  return {
    totalInvoicesAmount,
    paidInvoicesAmount,
    unpaidInvoicesAmount,
    overdueInvoicesAmount,
    collectionRate,
  };
}
