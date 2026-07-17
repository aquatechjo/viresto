import assert from "node:assert/strict";
import test from "node:test";
import { calculateInvoiceStatus, roundMoney } from "@/lib/finance";
import {
  formatJodNumber,
  hasValidJodPrecision,
  jodToFils,
  moneyExceeds,
} from "@/lib/money";
import { caseSchema, invoiceCreateSchema, paymentSchema } from "@/lib/validations";
import { calculateCaseFinancialSnapshot } from "@/lib/server/case-finance-integrity";

test("rounds Jordanian dinar values to the nearest fils", () => {
  assert.equal(roundMoney(1.2344), 1.234);
  assert.equal(roundMoney(1.2345), 1.235);
  assert.equal(jodToFils(12.345), 12_345);
});

test("formats JOD consistently with three decimal places", () => {
  assert.equal(formatJodNumber(25), "25.000");
  assert.equal(formatJodNumber(25.5), "25.500");
});

test("validates monetary precision at API boundaries", () => {
  assert.equal(hasValidJodPrecision(10.125), true);
  assert.equal(hasValidJodPrecision(10.1254), false);

  assert.equal(
    caseSchema.safeParse({
      clientId: "client-1",
      title: "Case",
      feeAgreed: 600.125,
    }).success,
    true,
  );

  assert.equal(
    paymentSchema.safeParse({ caseId: "case-1", amount: 10.1254 }).success,
    false,
  );

  assert.equal(
    invoiceCreateSchema.safeParse({
      clientId: "client-1",
      items: [{ description: "Fee", quantity: 1, unitPrice: 10.1254 }],
    }).success,
    false,
  );
});

test("compares balances using fils precision", () => {
  assert.equal(moneyExceeds(10.001, 10), true);
  assert.equal(moneyExceeds(10, 10), false);

  assert.equal(
    calculateInvoiceStatus({
      currentStatus: "UNPAID",
      total: 10,
      paidTotal: 9.999,
      dueDate: null,
    }),
    "PARTIALLY_PAID",
  );
});

test("combines active invoices and direct payments under the case fee", () => {
  assert.deepEqual(
    calculateCaseFinancialSnapshot({
      caseId: "case-1",
      feeAgreed: 600,
      activeInvoicesTotal: 400.125,
      directPaidTotal: 99.875,
    }),
    {
      caseId: "case-1",
      feeAgreed: 600,
      activeInvoicesTotal: 400.125,
      directPaidTotal: 99.875,
      committedTotal: 500,
      available: 100,
    },
  );
});
