import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INVOICE_ZERO_TOTAL_MESSAGE,
  calculateInvoiceTotals,
} from "@/lib/invoice-totals";
import { summarizeInvoiceStats, type InvoiceStatRow } from "@/lib/invoice-stats";

const item = (quantity: number, unitPrice: number) => ({
  description: " Item ",
  quantity,
  unitPrice,
});

test("invoice totals: items, tax and discount rounded to the fils", () => {
  const totals = calculateInvoiceTotals([item(2, 10.1234), item(1, 5)], 1.5, 0.5);
  assert.equal(totals.error, null);
  assert.deepEqual(
    totals.items.map((row) => [row.description, row.unitPrice, row.total]),
    [
      ["Item", 10.123, 20.246],
      ["Item", 5, 5],
    ],
  );
  assert.equal(totals.subtotal, 25.246);
  assert.equal(totals.total, 26.246);
});

test("a zero invoice is refused", () => {
  for (const [items, tax, discount] of [
    [[item(1, 0)], 0, 0],
    [[item(3, 0), item(1, 0)], 0, 0],
    [[item(1, 100)], 0, 100], // discount takes the whole total
    [[item(1, 90)], 10, 100],
    [[item(1, 0.0004)], 0, 0], // rounds to zero fils
  ] as const) {
    const totals = calculateInvoiceTotals([...items], tax, discount);
    assert.equal(totals.error, INVOICE_ZERO_TOTAL_MESSAGE, JSON.stringify(items));
    assert.equal(totals.total, 0);
  }
});

test("a total of one fils is accepted", () => {
  const totals = calculateInvoiceTotals([item(1, 0.001)]);
  assert.equal(totals.error, null);
  assert.equal(totals.total, 0.001);
});

test("the earlier checks keep their own message", () => {
  assert.equal(
    calculateInvoiceTotals([item(1, 10)], 0, 11).error,
    "الخصم لا يمكن أن يكون أكبر من المجموع مع الضريبة",
  );
  assert.equal(
    calculateInvoiceTotals([item(1, 1e12)]).error,
    "إجمالي الفاتورة أكبر من الحد المالي المسموح",
  );
});

const NOW = new Date("2026-11-06T09:00:00.000Z");
const PAST_DUE = new Date("2026-10-01");

const row = (
  status: string,
  total: number,
  paid: number[] = [],
  archived = false,
  dueDate: Date | null = null,
): InvoiceStatRow => ({
  status,
  dueDate,
  total,
  payments: paid.map((amount) => ({ amount })),
  client: { archivedAt: archived ? new Date("2026-01-01") : null },
  case: null,
});

test("list stats: drafts and cancelled invoices are not money billed", () => {
  const stats = summarizeInvoiceStats([
    row("UNPAID", 100),
    row("PARTIALLY_PAID", 50, [20]),
    row("PAID", 30, [30]),
    row("UNPAID", 10, [], false, PAST_DUE),
    row("DRAFT", 1000),
    row("CANCELLED", 500),
  ], NOW);
  assert.equal(stats.totalAmount, 190);
  assert.equal(stats.paidAmount, 50);
  assert.equal(stats.unpaidAmount, 100 + 30 + 10);
  assert.equal(stats.paidCount, 1);
  assert.equal(stats.overdueCount, 1);
  // The "all invoices" card opens a list that includes drafts and cancelled.
  assert.equal(stats.totalCount, 6);
});

test("list stats: archived clients' invoices count, drafts included in archivedCount only", () => {
  const stats = summarizeInvoiceStats([
    row("UNPAID", 40, [], true),
    row("DRAFT", 60, [], true),
    row("UNPAID", 10),
  ]);
  assert.equal(stats.totalAmount, 50);
  assert.equal(stats.unpaidAmount, 50);
  assert.equal(stats.archivedCount, 2);
  assert.equal(stats.totalCount, 3);
});

test("list stats: overdue is counted from the due date, and a legacy stored OVERDUE from its payments", () => {
  const stats = summarizeInvoiceStats([
    row("UNPAID", 100, [], false, PAST_DUE), // overdue
    row("PARTIALLY_PAID", 100, [40], false, PAST_DUE), // overdue
    row("OVERDUE", 100, [30], false, PAST_DUE), // legacy: partly paid, overdue
    row("OVERDUE", 100, [100], false, PAST_DUE), // legacy: fully paid, not overdue
    row("OVERDUE", 100, [], false, new Date("2026-12-01")), // legacy: not yet due
    row("UNPAID", 100, [], false, new Date("2026-11-06")), // due today: not late
    row("DRAFT", 100, [], false, PAST_DUE), // a draft is never overdue
  ], NOW);
  assert.equal(stats.overdueCount, 3);
  assert.equal(stats.paidCount, 1);
  assert.equal(stats.unpaidAmount, 100 + 60 + 70 + 100 + 100);
});
