import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthlyRevenue,
  calculateInvoiceFinancialSummary,
  getInvoiceRemainingAmount,
  getReportPeriod,
  isInvoiceOverdue,
} from "../../src/lib/report-finance";

test("uses Amman midnight for monthly report boundaries", () => {
  const period = getReportPeriod({
    type: "monthly",
    year: 2026,
    month: 6,
    timeZone: "Asia/Amman",
  });

  assert.equal(period.start.toISOString(), "2026-06-30T21:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-07-31T21:00:00.000Z");
});

test("places payments in months using the report time zone", () => {
  const revenue = buildMonthlyRevenue(
    [
      { amount: 10, paidAt: new Date("2026-06-30T22:00:00.000Z") },
      { amount: 15, paidAt: new Date("2026-07-31T20:30:00.000Z") },
      { amount: 20, paidAt: new Date("2026-07-31T21:30:00.000Z") },
    ],
    2026,
    "Asia/Amman",
  );

  assert.equal(revenue[6].revenue, 25);
  assert.equal(revenue[7].revenue, 20);
});

test("calculates partial payments from actual paid records", () => {
  const invoice = {
    total: 100,
    status: "PARTIALLY_PAID",
    dueDate: new Date("2026-07-01T00:00:00.000Z"),
    payments: [{ amount: 30 }],
  };

  const summary = calculateInvoiceFinancialSummary(
    [invoice],
    new Date("2026-07-17T00:00:00.000Z"),
  );

  assert.equal(getInvoiceRemainingAmount(invoice), 70);
  assert.equal(summary.totalInvoicesAmount, 100);
  assert.equal(summary.paidInvoicesAmount, 30);
  assert.equal(summary.unpaidInvoicesAmount, 70);
  assert.equal(summary.overdueInvoicesAmount, 70);
  assert.equal(summary.collectionRate, 30);
  assert.equal(
    isInvoiceOverdue(invoice, new Date("2026-07-17T00:00:00.000Z")),
    true,
  );
});

test("excludes draft and cancelled invoices and caps legacy overpayments", () => {
  const summary = calculateInvoiceFinancialSummary(
    [
      {
        total: 50,
        status: "PAID",
        dueDate: null,
        payments: [{ amount: 75 }],
      },
      {
        total: 100,
        status: "DRAFT",
        dueDate: null,
        payments: [],
      },
      {
        total: 100,
        status: "CANCELLED",
        dueDate: null,
        payments: [],
      },
    ],
  );

  assert.deepEqual(summary, {
    totalInvoicesAmount: 50,
    paidInvoicesAmount: 50,
    unpaidInvoicesAmount: 0,
    overdueInvoicesAmount: 0,
    collectionRate: 100,
  });
});
