import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrintableReceipt } from "../../src/lib/receipt-print";
import { buildReceiptPrintHtml } from "../../src/lib/reports/receipt-document";
import { themeTokens } from "../../src/lib/theme/tokens";

// The receipt printout (finance plan, batch 6): always light, colors from
// tokens.ts as the invoice print, the amount in figures and words.

const base: PrintableReceipt = {
  id: "pay-1",
  receiptNumber: "R-2026-0007",
  status: "PAID",
  amount: 250.5,
  method: "BANK_TRANSFER",
  reference: "TRX-991",
  paidAt: "2026-11-08T07:30:00Z",
  client: { name: "محمد <b>العبادي</b>", phone: "+962790000000" },
  case: { title: "قضية إيجار", caseNumber: "155/2026" },
  invoice: { invoiceNumber: "INV-2026-0012" },
  collectedBy: { name: "سارة" },
  tenant: { name: "مكتب العبادي" },
};

test("an issued receipt: number, date, amount in figures and Arabic words, details", () => {
  const html = buildReceiptPrintHtml(base, "ar");
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /سند قبض/);
  assert.match(html, /R-2026-0007/);
  assert.match(html, /250\.5 د\.أ/);
  assert.match(html, /مئتان وخمسون ديناراً وخمسمئة فلس/);
  assert.match(html, /قضية إيجار - 155\/2026/);
  assert.match(html, /INV-2026-0012/);
  assert.match(html, /تحويل بنكي/);
  assert.match(html, /TRX-991/);
  assert.match(html, /سارة/);
  assert.match(html, /توقيع المستلم/);
  assert.doesNotMatch(html, /class="report-stamp"/);
  // Escaped, never raw markup from the data.
  assert.doesNotMatch(html, /<b>العبادي<\/b>/);
  assert.match(html, /&lt;b&gt;العبادي&lt;\/b&gt;/);
});

test("English print: words in English", () => {
  const html = buildReceiptPrintHtml(base, "en");
  assert.match(html, /<html lang="en" dir="ltr">/);
  assert.match(html, /Two hundred fifty dinars and five hundred fils/);
  assert.match(html, /Bank transfer/);
});

test("a cancelled receipt with its number: the number and the stamp", () => {
  const html = buildReceiptPrintHtml({ ...base, status: "CANCELLED", cancellationReason: "سُجّلت مرتين", cancelledAt: "2026-11-08T09:00:00Z" }, "ar");
  assert.match(html, /class="report-stamp"[^>]*>ملغى</);
  assert.match(html, /R-2026-0007/);
  assert.match(html, /سُجّلت مرتين/);
});

test("a cancelled receipt without a number: the stamp, and no number", () => {
  const html = buildReceiptPrintHtml({ ...base, receiptNumber: null, status: "CANCELLED", paidAt: null }, "ar");
  assert.match(html, /class="report-stamp"/);
  assert.match(html, /بدون رقم/);
  assert.doesNotMatch(html, /R-\d{4}-\d{4}/);
  const en = buildReceiptPrintHtml({ ...base, receiptNumber: null, status: "CANCELLED" }, "en");
  assert.match(en, /No number/);
});

test("no recorded collector (older payments) and no link print a dash and the client account", () => {
  const html = buildReceiptPrintHtml({ ...base, collectedBy: null, case: null, invoice: null }, "ar");
  assert.match(html, /دفعة على حساب الموكل/);
  assert.match(html, /<dt>سجّل التحصيل<\/dt><dd>-<\/dd>/);
});

test("colors come from the light tokens: no hex of its own but white", () => {
  const html = buildReceiptPrintHtml(base, "ar");
  const light = new Set(Object.values(themeTokens.light).map((v) => String(v).toLowerCase()));
  const hexes = html.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  for (const hex of hexes) {
    assert.ok(hex.toLowerCase() === "#ffffff" || light.has(hex.toLowerCase()), `own color ${hex}`);
  }
  assert.match(html, /color-scheme: light only/);
});
