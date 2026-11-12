import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInvoicePrintHtml, invoicePaymentTotals } from "../../src/lib/reports/invoice-document";
import { buildReceiptPrintHtml } from "../../src/lib/reports/receipt-document";
import type { PrintableInvoice } from "../../src/lib/invoice-print";

// Invoice and receipt on the shared report system (PDF reports plan,
// phase 3): the shared header and footer, Arabic or English.

const invoice: PrintableInvoice = {
  id: "inv-1",
  invoiceNumber: "INV-2026-0018",
  status: "PARTIALLY_PAID",
  isOverdue: true,
  issueDate: "2026-10-01T00:00:00Z",
  dueDate: "2026-10-31T00:00:00Z",
  subtotal: 1000,
  tax: 160,
  discount: 60,
  total: 1100,
  notes: "تُدفع على قسطين",
  client: { name: "سارة الخطيب", phone: "+962791234567", email: "sara@example.com" },
  case: { title: "قضية إيجار", caseNumber: "155/2026" },
  items: [
    { id: "a", description: "أتعاب المرافعة", quantity: 1, unitPrice: 800 },
    { id: "b", description: "رسوم", quantity: 2, unitPrice: 100 },
  ],
  payments: [
    { id: "p1", amount: 500, status: "PAID" },
    { id: "p2", amount: 200, status: "CANCELLED" },
  ],
  tenant: { name: "مكتب الحديدي", phone: "+962790000000", email: "office@example.com" },
};

function visibleText(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

test("invoice: paid counts collected payments only; remaining never below zero", () => {
  assert.deepEqual(invoicePaymentTotals(invoice), { paid: 500, remaining: 600 });
  assert.deepEqual(invoicePaymentTotals({ ...invoice, payments: [{ amount: 2000, status: "PAID" }] }), { paid: 2000, remaining: 0 });
});

test("invoice (Arabic): shared header with the invoice's number and date, items, totals, status", () => {
  const html = buildInvoicePrintHtml(invoice, "ar", { assetBaseUrl: "https://app.example.com" });
  const text = visibleText(html);

  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /class="report-header"/);
  assert.match(html, /fonts\/tajawal\/tajawal-arabic-500-normal\.woff2/);
  assert.match(html, /counter\(page\) " من " counter\(pages\)/);
  assert.match(text, /Powered by Viresto/);
  assert.match(text, /رقم الفاتورة #INV-2026-0018/);
  assert.doesNotMatch(text, /رقم التقرير/);
  assert.match(text, /مدفوعة جزئيًا • متأخرة/);
  assert.match(text, /أتعاب المرافعة/);
  assert.match(text, /المجموع الفرعي 1,000 د\.أ/);
  assert.match(text, /الإجمالي النهائي 1,100 د\.أ/);
  assert.match(text, /المحصّل 500 د\.أ/);
  assert.match(text, /المتبقي 600 د\.أ/);
  assert.match(text, /قضية إيجار - 155\/2026/);
  // An Arabic date in a card is not forced left to right ("1 2026 تشرين الأول").
  assert.match(html, /class="summary-card-value">1 تشرين الأول 2026</);
  assert.match(html, /class="summary-card-value"><span class="num">1,100 د\.أ<\/span>/);
  assert.match(text, /توقيع الموكل/);
  assert.doesNotMatch(text, /\b(PARTIALLY_PAID|OVERDUE|PAID|CANCELLED|UNPAID|DRAFT)\b/);
});

test("invoice (English): LTR, English labels and page counter", () => {
  const html = buildInvoicePrintHtml({ ...invoice, status: "PAID", isOverdue: false }, "en");
  const text = visibleText(html);
  assert.match(html, /<html lang="en" dir="ltr">/);
  assert.match(html, /counter\(page\) " of " counter\(pages\)/);
  assert.match(html, /direction: ltr/);
  assert.match(text, /Invoice number #INV-2026-0018/);
  assert.match(text, /Final total 1,100 د\.أ/);
  assert.match(text, /Paid/);
});

test("invoice: a draft shows 'draft' instead of a number; no items gives a message", () => {
  const text = visibleText(buildInvoicePrintHtml({ ...invoice, invoiceNumber: null, status: "DRAFT", items: [], payments: [] }, "ar"));
  assert.match(text, /فاتورة مسودة/);
  assert.match(text, /لا توجد بنود/);
  assert.doesNotMatch(text, /الدفعات المرتبطة \d/);
});

test("receipt (English): shared header with the receipt's number, method in words", () => {
  const html = buildReceiptPrintHtml(
    {
      id: "pay-1",
      receiptNumber: "R-2026-0007",
      status: "PAID",
      amount: 250.5,
      method: "CHECK",
      paidAt: "2026-11-08T07:30:00Z",
      client: { name: "Ahmad" },
      tenant: { name: "Office" },
    },
    "en",
  );
  const text = visibleText(html);
  assert.match(html, /<html lang="en" dir="ltr">/);
  assert.match(text, /Receipt number R-2026-0007/);
  assert.match(text, /Cheque/);
  assert.match(text, /Payment on the client&#x27;s account/);
  assert.doesNotMatch(text, /\bCHECK\b/);
});
