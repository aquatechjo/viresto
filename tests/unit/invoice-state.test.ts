import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateInvoiceStatus,
  collectedTotal,
  effectiveInvoiceState,
  invoiceStatusWhere,
  withInvoiceState,
} from "@/lib/finance";
import { pastDueBefore } from "@/lib/datetime";
import { invoiceStatusText, invoiceStatusTone } from "@/lib/invoice-status-display";

// "Overdue" is computed from the due date when read, never stored
// (decision of 2026-11-06). A legacy stored OVERDUE (rows saved before) is
// read from its collected payments: the old code could write OVERDUE over a
// partly paid invoice.

const NOW = new Date("2026-11-06T09:00:00.000Z"); // 6 Nov, 12:00 in Amman
const PAST_DUE = new Date("2026-10-01");
const FUTURE_DUE = new Date("2026-12-01");

const AR = {
  DRAFT: "مسودة",
  UNPAID: "غير مدفوعة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
  PAID: "مدفوعة",
  OVERDUE: "متأخرة",
  CANCELLED: "ملغاة",
};

const state = (status: string, paidTotal: number, dueDate: Date | null, total = 100) =>
  effectiveInvoiceState({ status, total, paidTotal, dueDate }, NOW);

test("the stored status after a payment change is never OVERDUE", () => {
  for (const [paidTotal, expected] of [
    [0, "UNPAID"],
    [40, "PARTIALLY_PAID"],
    [100, "PAID"],
  ] as const) {
    for (const currentStatus of ["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const) {
      assert.equal(
        calculateInvoiceStatus({ currentStatus, total: 100, paidTotal }),
        expected,
        `${currentStatus} paid ${paidTotal}`,
      );
    }
  }
  assert.equal(calculateInvoiceStatus({ currentStatus: "DRAFT", total: 100, paidTotal: 100 }), "DRAFT");
  assert.equal(calculateInvoiceStatus({ currentStatus: "CANCELLED", total: 100, paidTotal: 0 }), "CANCELLED");
});

test("a legacy stored OVERDUE takes the status its collected payments give", () => {
  assert.deepEqual(state("OVERDUE", 0, PAST_DUE), { status: "UNPAID", isOverdue: true });
  assert.deepEqual(state("OVERDUE", 30, PAST_DUE), { status: "PARTIALLY_PAID", isOverdue: true });
  assert.deepEqual(state("OVERDUE", 100, PAST_DUE), { status: "PAID", isOverdue: false });
  // Not overdue any more if its due date is still ahead.
  assert.deepEqual(state("OVERDUE", 0, FUTURE_DUE), { status: "UNPAID", isOverdue: false });
  assert.deepEqual(state("OVERDUE", 0, null), { status: "UNPAID", isOverdue: false });
});

test("a stored OVERDUE invoice with a partial payment shows 'partially paid • overdue'", () => {
  const invoice = withInvoiceState(
    {
      status: "OVERDUE",
      total: 100,
      dueDate: PAST_DUE,
      payments: [
        { status: "PAID", amount: 30 },
        { status: "CANCELLED", amount: 70 }, // not collected
        { status: "PENDING", amount: 10 }, // not collected
      ],
    },
    NOW,
  );
  assert.equal(invoice.status, "PARTIALLY_PAID");
  assert.equal(invoice.isOverdue, true);
  assert.equal(invoiceStatusText(invoice.status, invoice.isOverdue, AR), "مدفوعة جزئيًا • متأخرة");
  assert.equal(invoiceStatusTone(invoice.status, invoice.isOverdue), "OVERDUE");
});

test("overdue: unpaid or partly paid, from the Amman day after the due date", () => {
  assert.equal(state("UNPAID", 0, PAST_DUE).isOverdue, true);
  assert.equal(state("PARTIALLY_PAID", 40, PAST_DUE).isOverdue, true);
  assert.equal(state("UNPAID", 0, new Date("2026-11-06")).isOverdue, false); // due today
  assert.equal(state("UNPAID", 0, new Date("2026-11-05")).isOverdue, true);
  for (const status of ["PAID", "DRAFT", "CANCELLED"]) {
    assert.equal(state(status, 0, PAST_DUE).isOverdue, false, status);
  }
});

test("labels: overdue on top of the status", () => {
  assert.equal(invoiceStatusText("UNPAID", true, AR), "متأخرة");
  assert.equal(invoiceStatusText("UNPAID", false, AR), "غير مدفوعة");
  assert.equal(invoiceStatusText("PARTIALLY_PAID", false, AR), "مدفوعة جزئيًا");
  assert.equal(invoiceStatusText("PAID", false, AR), "مدفوعة");
  assert.equal(invoiceStatusTone("UNPAID", false), "UNPAID");
});

test("collected total: PAID payments only, or a list of PAID payments without status", () => {
  assert.equal(
    collectedTotal([
      { status: "PAID", amount: 10.0004 },
      { status: "PENDING", amount: 5 },
      { status: "PAID", amount: "2.5" },
    ]),
    12.5,
  );
  assert.equal(collectedTotal([{ amount: 7 }, { amount: 3 }]), 10);
  assert.equal(collectedTotal(undefined), 0);
});

test("status filters match the effective status", () => {
  assert.deepEqual(invoiceStatusWhere("", NOW), {});
  assert.deepEqual(invoiceStatusWhere("OVERDUE", NOW), {
    status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
    dueDate: { lt: pastDueBefore(NOW) },
  });
  assert.deepEqual(invoiceStatusWhere("UNPAID", NOW), {
    OR: [
      { status: "UNPAID" },
      { status: "OVERDUE", payments: { none: { status: "PAID" } } },
    ],
  });
  assert.deepEqual(invoiceStatusWhere("PARTIALLY_PAID", NOW), {
    OR: [
      { status: "PARTIALLY_PAID" },
      { status: "OVERDUE", payments: { some: { status: "PAID" } } },
    ],
  });
  assert.deepEqual(invoiceStatusWhere("PAID", NOW), { status: "PAID" });
  assert.deepEqual(invoiceStatusWhere("DRAFT", NOW), { status: "DRAFT" });
});
