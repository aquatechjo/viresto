import { test } from "node:test";
import assert from "node:assert/strict";
import { pastDueBefore } from "../../src/lib/datetime";
import { roundMoney } from "../../src/lib/finance";
import {
  ISSUED_INVOICE_STATUSES,
  OPEN_INVOICE_STATUSES,
  combineInvoiceStats,
  summarizeInvoiceStats,
  type InvoiceStatParts,
  type InvoiceStatRow,
} from "../../src/lib/invoice-stats";

// combineInvoiceStats (the database aggregates) must give the stat cards
// the same figures as summarizeInvoiceStats over every invoice row. Each
// part below is what its query in invoice-stats-query.ts returns,
// computed here from the same rows.

const NOW = new Date("2026-11-13T10:00:00.000Z");

function partsFrom(rows: InvoiceStatRow[], now: Date): InvoiceStatParts {
  const paid = (row: InvoiceStatRow) =>
    row.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const isIn = (list: readonly string[], row: InvoiceStatRow) => list.includes(row.status);
  const byStatus = new Map<string, { status: string; count: number; total: number }>();
  for (const row of rows) {
    const entry = byStatus.get(row.status) ?? { status: row.status, count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(row.total);
    byStatus.set(row.status, entry);
  }
  const cutoff = pastDueBefore(now).getTime();
  return {
    byStatus: [...byStatus.values()],
    paidOnIssued: rows.filter((r) => isIn(ISSUED_INVOICE_STATUSES, r)).reduce((s, r) => s + paid(r), 0),
    paidOnOpen: rows.filter((r) => isIn(OPEN_INVOICE_STATUSES, r)).reduce((s, r) => s + paid(r), 0),
    overdueOpen: rows.filter(
      (r) => isIn(OPEN_INVOICE_STATUSES, r) && r.dueDate && new Date(r.dueDate).getTime() < cutoff,
    ).length,
    archived: rows.filter((r) => r.client?.archivedAt || r.case?.client?.archivedAt).length,
    legacyOverdue: summarizeInvoiceStats(rows.filter((r) => r.status === "OVERDUE"), now),
  };
}

function expected(rows: InvoiceStatRow[], now: Date) {
  const s = summarizeInvoiceStats(rows, now);
  return {
    ...s,
    totalAmount: roundMoney(s.totalAmount),
    paidAmount: roundMoney(s.paidAmount),
    unpaidAmount: roundMoney(s.unpaidAmount),
  };
}

// Small deterministic PRNG so failures can be replayed.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const ARCHIVED = new Date("2026-10-01T00:00:00.000Z");
const DUE_DATES = [
  null,
  new Date("2026-11-12T00:00:00.000Z"), // yesterday in Amman: overdue
  new Date("2026-11-13T00:00:00.000Z"), // today: not overdue yet
  new Date("2026-11-14T00:00:00.000Z"),
  new Date("2026-01-01T00:00:00.000Z"),
];

function randomRow(next: () => number): InvoiceStatRow {
  const total = roundMoney(1 + Math.floor(next() * 1000000) / 1000);
  const statuses = ["DRAFT", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];
  const status = statuses[Math.floor(next() * statuses.length)];
  const split = (amount: number) => {
    const first = roundMoney(Math.floor(next() * amount * 1000) / 1000);
    return first > 0 && first < amount ? [first, roundMoney(amount - first)] : [amount];
  };
  let payments: number[] = [];
  if (status === "PAID") payments = split(total);
  if (status === "PARTIALLY_PAID") payments = [roundMoney(Math.max(0.001, total * next() * 0.9))];
  if (status === "OVERDUE") {
    const kind = next();
    payments = kind < 0.33 ? [] : kind < 0.66 ? [roundMoney(total * 0.5)] : split(total);
  }
  const archivedHow = next();
  return {
    total,
    status,
    dueDate: DUE_DATES[Math.floor(next() * DUE_DATES.length)],
    client: { archivedAt: archivedHow < 0.15 ? ARCHIVED : null },
    case: next() < 0.5 ? { client: { archivedAt: archivedHow > 0.9 ? ARCHIVED : null } } : null,
    payments: payments.map((amount) => ({ amount })),
  };
}

test("no invoices: every figure is zero", () => {
  assert.deepEqual(combineInvoiceStats(partsFrom([], NOW)), expected([], NOW));
});

test("each status on its own, including legacy OVERDUE unpaid, partial and fully paid", () => {
  const due = new Date("2026-11-01T00:00:00.000Z");
  const rows: InvoiceStatRow[] = [
    { total: 100, status: "DRAFT", dueDate: due, payments: [] },
    { total: 200, status: "CANCELLED", dueDate: due, payments: [] },
    { total: 300, status: "UNPAID", dueDate: due, payments: [] },
    { total: 400, status: "PARTIALLY_PAID", dueDate: due, payments: [{ amount: 150 }] },
    { total: 500, status: "PAID", dueDate: due, payments: [{ amount: 500 }] },
    { total: 600, status: "OVERDUE", dueDate: due, payments: [] },
    { total: 700, status: "OVERDUE", dueDate: due, payments: [{ amount: 200 }] },
    { total: 800, status: "OVERDUE", dueDate: due, payments: [{ amount: 800 }] },
  ];
  const stats = combineInvoiceStats(partsFrom(rows, NOW));
  assert.deepEqual(stats, expected(rows, NOW));
  assert.deepEqual(stats, {
    totalAmount: 3300,
    paidAmount: 1650,
    unpaidAmount: 300 + 250 + 600 + 500,
    overdueCount: 4,
    paidCount: 2,
    archivedCount: 0,
    totalCount: 8,
  });
});

test("archived clients count once, directly or through the case, and stay in the money figures", () => {
  const rows: InvoiceStatRow[] = [
    { total: 100, status: "UNPAID", dueDate: null, client: { archivedAt: ARCHIVED }, payments: [] },
    { total: 50, status: "OVERDUE", dueDate: null, case: { client: { archivedAt: ARCHIVED } }, payments: [] },
    { total: 10, status: "DRAFT", dueDate: null, client: { archivedAt: ARCHIVED }, case: { client: { archivedAt: ARCHIVED } }, payments: [] },
  ];
  const stats = combineInvoiceStats(partsFrom(rows, NOW));
  assert.deepEqual(stats, expected(rows, NOW));
  assert.equal(stats.archivedCount, 3);
  assert.equal(stats.unpaidAmount, 150);
});

test("2,000 random invoice sets give the same figures as the row-by-row summary", () => {
  const next = rng(20261113);
  for (let i = 0; i < 2000; i++) {
    const rows = Array.from({ length: Math.floor(next() * 40) }, () => randomRow(next));
    assert.deepEqual(combineInvoiceStats(partsFrom(rows, NOW)), expected(rows, NOW), `set ${i}`);
  }
});
