import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionPayment,
  formatSequentialInvoiceNumber,
  isPaymentFinanciallyLocked,
  requiresPaymentCancellationReason,
} from "../../src/lib/financial-audit";

test("collected payments can only remain collected or be cancelled", () => {
  assert.equal(canTransitionPayment("PAID", "PAID"), true);
  assert.equal(canTransitionPayment("PAID", "CANCELLED"), true);
  assert.equal(canTransitionPayment("PAID", "PENDING"), false);
  assert.equal(canTransitionPayment("PAID", "OVERDUE"), false);
});

test("cancelled payments are terminal financial records", () => {
  assert.equal(canTransitionPayment("CANCELLED", "CANCELLED"), true);
  assert.equal(canTransitionPayment("CANCELLED", "PAID"), false);
  assert.equal(isPaymentFinanciallyLocked("CANCELLED"), true);
  assert.equal(isPaymentFinanciallyLocked("PAID"), true);
  assert.equal(isPaymentFinanciallyLocked("PENDING"), false);
});

test("every new cancellation requires an audit reason", () => {
  assert.equal(
    requiresPaymentCancellationReason("PENDING", "CANCELLED"),
    true,
  );
  assert.equal(
    requiresPaymentCancellationReason("PAID", "CANCELLED"),
    true,
  );
  assert.equal(
    requiresPaymentCancellationReason("CANCELLED", "CANCELLED"),
    false,
  );
});

test("invoice numbers use the allocated yearly sequence", () => {
  assert.equal(formatSequentialInvoiceNumber(2026, 1), "INV-2026-0001");
  assert.equal(formatSequentialInvoiceNumber(2026, 12_345), "INV-2026-12345");
  assert.throws(
    () => formatSequentialInvoiceNumber(2026, 0),
    /INVALID_INVOICE_SEQUENCE/,
  );
});
