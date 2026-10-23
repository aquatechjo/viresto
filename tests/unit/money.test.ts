import assert from "node:assert/strict";
import test from "node:test";
import { calculateInvoiceStatus, roundMoney } from "@/lib/finance";
import {
  formatJOD,
  formatJodNumber,
  formatUSD,
  hasValidJodPrecision,
  jodToFils,
  moneyExceeds,
  parseAmount,
} from "@/lib/money";
import { toLatinDigits, withLatinDigits } from "@/lib/locale";
import {
  appointmentSchema,
  caseSchema,
  invoiceCreateSchema,
  paymentSchema,
} from "@/lib/validations";
import { calculateCaseFinancialSnapshot } from "@/lib/server/case-finance-integrity";

test("rounds Jordanian dinar values to the nearest fils", () => {
  assert.equal(roundMoney(1.2344), 1.234);
  assert.equal(roundMoney(1.2345), 1.235);
  assert.equal(jodToFils(12.345), 12_345);
});

test("formatJOD: Latin digits, up to 3 decimals, dinar sign after the amount", () => {
  assert.equal(formatJOD(1250.5), "1,250.5 د.أ");
  assert.equal(formatJOD(25), "25 د.أ");
  assert.equal(formatJOD(0.125), "0.125 د.أ");
  assert.equal(formatJOD(1.23456), "1.235 د.أ");
  assert.equal(formatJOD("1500.25"), "1,500.25 د.أ");
  assert.equal(formatJOD({ toString: () => "42.1" }), "42.1 د.أ", "Prisma Decimal");
  assert.equal(formatJOD(null), "0 د.أ");
  assert.equal(formatJOD(undefined), "0 د.أ");
  assert.equal(formatJOD("not a number"), "0 د.أ");
  assert.doesNotMatch(formatJOD(1234567.891), /[٠-٩]/, "no Arabic-Indic digits");
});

test("formatUSD: dollar sign first, up to 2 decimals", () => {
  assert.equal(formatUSD(29), "$29");
  assert.equal(formatUSD(290), "$290");
  assert.equal(formatUSD(1299.5), "$1,299.5");
  assert.equal(formatUSD(19.999), "$20");
  assert.equal(formatUSD(null), "$0");
});

test("parseAmount: Arabic or Latin digits, either separator", () => {
  assert.equal(parseAmount("1250.5"), 1250.5);
  assert.equal(parseAmount("١٢٥٠٫٥"), 1250.5);
  assert.equal(parseAmount("١٬٢٥٠٫٥"), 1250.5);
  assert.equal(parseAmount("1,250.5"), 1250.5);
  assert.equal(parseAmount(" 30 "), 30);
  assert.equal(parseAmount("٠٫١٢٥"), 0.125);
  assert.equal(parseAmount(""), 0);
  assert.equal(parseAmount("abc"), 0);
});

test("formats JOD consistently with three decimal places", () => {
  assert.equal(formatJodNumber(25), "25.000");
  assert.equal(formatJodNumber(25.5), "25.500");
  assert.equal(formatJodNumber(25.5, "ar-JO"), "25.500");
});

test("uses Latin digits in Arabic locales and numeric input", () => {
  assert.equal(withLatinDigits("ar-JO"), "ar-JO-u-nu-latn");
  assert.equal(
    toLatinDigits(
      "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669",
    ),
    "0123456789",
  );
  assert.equal(
    toLatinDigits(
      "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9",
    ),
    "0123456789",
  );
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

test("normalizes cleared optional appointment relations", () => {
  const parsed = appointmentSchema.safeParse({
    title: "Meeting",
    startTime: "2026-07-17T10:00:00+03:00",
    clientId: "",
    caseId: null,
  });

  assert.equal(parsed.success, true);

  if (parsed.success) {
    assert.equal(parsed.data.clientId, null);
    assert.equal(parsed.data.caseId, null);
  }
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
