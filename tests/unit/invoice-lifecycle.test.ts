import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INVOICE_MESSAGES,
  canEditInvoice,
  invoiceCancelBlock,
  invoiceDeleteBlock,
  invoiceStatusChangeBlock,
  parseCancelReason,
} from "@/lib/invoice-lifecycle";
import { hasPermission } from "@/lib/permissions";

// Invoice decisions of 2026-11-06 (finance plan, batch 5).

test("cancelling: the office admin only", () => {
  assert.equal(hasPermission("ADMIN", "invoice.cancel"), true);
  assert.equal(hasPermission("LAWYER", "invoice.cancel"), false);
  assert.equal(hasPermission("STAFF", "invoice.cancel"), false);
});

test("cancelling: an issued invoice without pending or collected payments", () => {
  assert.equal(invoiceCancelBlock({ status: "UNPAID", payments: [] }), null);
  assert.equal(
    invoiceCancelBlock({ status: "UNPAID", payments: [{ status: "CANCELLED", amount: 10 }] }),
    null,
  );
  // A legacy stored OVERDUE is an issued invoice too.
  assert.equal(invoiceCancelBlock({ status: "OVERDUE", payments: [] }), null);
});

test("cancelling is refused for drafts, cancelled invoices and invoices with payments", () => {
  assert.equal(invoiceCancelBlock({ status: "DRAFT" }), INVOICE_MESSAGES.draftNotCancelled);
  assert.equal(invoiceCancelBlock({ status: "CANCELLED" }), INVOICE_MESSAGES.alreadyCancelled);
  assert.equal(
    invoiceCancelBlock({ status: "UNPAID", payments: [{ status: "PENDING", amount: 5 }] }),
    INVOICE_MESSAGES.pendingPayments,
  );
  assert.equal(
    invoiceCancelBlock({ status: "UNPAID", payments: [{ status: "OVERDUE", amount: 5 }] }),
    INVOICE_MESSAGES.pendingPayments,
  );
  assert.equal(
    invoiceCancelBlock({ status: "PARTIALLY_PAID", payments: [{ status: "PAID", amount: 5 }] }),
    INVOICE_MESSAGES.collectedPayments,
  );
});

test("cancel reason: required, trimmed, 5 to 500 characters", () => {
  assert.deepEqual(parseCancelReason("  خطأ في البنود  "), { ok: true, reason: "خطأ في البنود" });
  for (const value of [undefined, null, "", "    ", "abc", 42]) {
    assert.deepEqual(
      parseCancelReason(value),
      { ok: false, message: INVOICE_MESSAGES.reasonRequired },
      String(value),
    );
  }
  assert.deepEqual(parseCancelReason("x".repeat(501)), {
    ok: false,
    message: INVOICE_MESSAGES.reasonTooLong,
  });
  assert.equal(parseCancelReason("x".repeat(500)).ok, true);
});

test("deleting: drafts only", () => {
  assert.equal(invoiceDeleteBlock({ status: "DRAFT" }), null);
  for (const status of ["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]) {
    assert.equal(invoiceDeleteBlock({ status }), INVOICE_MESSAGES.deleteDraftOnly, status);
  }
});

test("status changes by edit: only issuing a draft", () => {
  assert.equal(invoiceStatusChangeBlock("DRAFT", "UNPAID"), null);
  assert.equal(invoiceStatusChangeBlock("UNPAID", "UNPAID"), null);
  assert.equal(invoiceStatusChangeBlock("UNPAID", "DRAFT"), INVOICE_MESSAGES.noBackToDraft);
  assert.equal(invoiceStatusChangeBlock("UNPAID", "CANCELLED"), INVOICE_MESSAGES.useCancel);
  assert.equal(invoiceStatusChangeBlock("DRAFT", "CANCELLED"), INVOICE_MESSAGES.useCancel);
  assert.equal(invoiceStatusChangeBlock("CANCELLED", "UNPAID"), INVOICE_MESSAGES.cancelledLocked);
  assert.equal(invoiceStatusChangeBlock("CANCELLED", "DRAFT"), INVOICE_MESSAGES.cancelledLocked);
  assert.notEqual(invoiceStatusChangeBlock("UNPAID", "PAID"), null);
});

test("a cancelled invoice is not edited", () => {
  assert.equal(canEditInvoice("CANCELLED"), false);
  assert.equal(canEditInvoice("DRAFT"), true);
  assert.equal(canEditInvoice("UNPAID"), true);
});

test("print: a cancelled invoice carries the stamp and the reason, escaped", async () => {
  const { buildInvoicePrintHtml } = await import("@/lib/reports/invoice-document");
  const base = {
    id: "inv-1",
    invoiceNumber: "INV-2026-0001",
    issueDate: "2026-11-01",
    subtotal: 100,
    tax: 0,
    discount: 0,
    total: 100,
    client: { name: "c" },
    items: [{ description: "x", quantity: 1, unitPrice: 100 }],
  };
  const cancelled = buildInvoicePrintHtml(
    {
      ...base,
      status: "CANCELLED",
      cancelledAt: "2026-11-06T09:00:00.000Z",
      cancellationReason: "أُصدرت <بالخطأ>",
    },
    "ar",
  );
  assert.match(cancelled, /class="report-stamp"[^>]*>ملغاة</);
  assert.match(cancelled, /سبب الإلغاء/);
  assert.match(cancelled, /أُصدرت &lt;بالخطأ&gt;/);
  assert.doesNotMatch(cancelled, /<بالخطأ>/);

  const issued = buildInvoicePrintHtml({ ...base, status: "UNPAID" }, "ar");
  assert.doesNotMatch(issued, /class="report-stamp"/);
  assert.doesNotMatch(issued, /class="report-notice"/);
});

test("invoice page buttons match the server rules", async () => {
  const { invoicePageActions } = await import("@/lib/invoice-lifecycle");
  // Lawyer: never cancels or deletes; issues own drafts; edits until cancelled.
  assert.deepEqual(invoicePageActions("LAWYER", "UNPAID"), { issue: false, cancel: false, delete: false, edit: true });
  assert.deepEqual(invoicePageActions("LAWYER", "DRAFT"), { issue: true, cancel: false, delete: false, edit: true });
  // Admin: cancel on issued only, delete on drafts only.
  assert.deepEqual(invoicePageActions("ADMIN", "UNPAID"), { issue: false, cancel: true, delete: false, edit: true });
  assert.deepEqual(invoicePageActions("ADMIN", "OVERDUE"), { issue: false, cancel: true, delete: false, edit: true });
  assert.deepEqual(invoicePageActions("ADMIN", "PAID"), { issue: false, cancel: true, delete: false, edit: true });
  assert.deepEqual(invoicePageActions("ADMIN", "DRAFT"), { issue: true, cancel: false, delete: true, edit: true });
  assert.deepEqual(invoicePageActions("ADMIN", "CANCELLED"), { issue: false, cancel: false, delete: false, edit: false });
  // Before the session loads: nothing.
  assert.deepEqual(invoicePageActions(null, "UNPAID"), { issue: false, cancel: false, delete: false, edit: false });
});
