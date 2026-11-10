import { test } from "node:test";
import assert from "node:assert/strict";
import {
  InfoGrid,
  ReportLayout,
  ReportSection,
  ReportTable,
  StatusBadge,
  SummaryCards,
  type ReportMeta,
} from "../../src/lib/reports/components";
import { renderReportHtml } from "../../src/lib/reports/render";
import { cssString } from "../../src/lib/reports/styles";
import {
  maskNationalId,
  REPORT_EMPTY,
  reportDateStamp,
  reportMoney,
  sumMoney,
} from "../../src/lib/reports/format";
import {
  APPOINTMENT_STATUS_LABELS,
  CASE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  reportStatus,
  paymentMethodLabel,
  UNKNOWN_LABEL,
} from "../../src/lib/reports/labels";
import { formatJOD } from "../../src/lib/money";
import { themeTokens } from "../../src/lib/theme/tokens";

// The shared report foundation (PDF reports plan, phase 1): formatters,
// labels, and the components rendered to a standalone print document.

const meta: ReportMeta = {
  documentTitle: "تقرير تجريبي",
  number: "CF-7-20261110",
  issuedAt: new Date("2026-11-10T08:00:00Z"),
  office: { name: "مكتب العبادي", phone: "+962791234567", email: "office@example.com", address: "عمّان" },
  assetBaseUrl: "https://app.example.com",
};

test("national ID: masked by default, shown in full on request", () => {
  assert.equal(maskNationalId("9861234567"), "986****567");
  assert.equal(maskNationalId("9861234567", { reveal: true }), "9861234567");
  assert.equal(maskNationalId("9861234567", { keepStart: 2, keepEnd: 2 }), "98******67");
  // Keeping 8 of 10 digits would hide too little: all hidden.
  assert.equal(maskNationalId("9861234567", { keepStart: 4, keepEnd: 4 }), "**********");
  assert.equal(maskNationalId("12345"), "*****");
  assert.equal(maskNationalId(null), REPORT_EMPTY);
  assert.equal(maskNationalId("  "), REPORT_EMPTY);
});

test("money: formatJOD as in the app, sums exact in fils", () => {
  assert.equal(reportMoney("1000"), formatJOD(1000));
  assert.equal(reportMoney(null), formatJOD(0));
  assert.equal(sumMoney(["0.1", "0.2"]), 0.3);
  assert.equal(sumMoney(["500.000", 250.5, null, "x"]), 750.5);
});

test("report number date stamp is the Amman day", () => {
  // 23:30 UTC on Nov 9 is already Nov 10 in Amman (UTC+3).
  assert.equal(reportDateStamp("2026-11-09T23:30:00Z"), "20261110");
});

test("statuses: Arabic labels and tones, never a raw enum value", () => {
  assert.deepEqual(reportStatus("case", "OPEN"), { label: "نشطة", tone: "green" });
  assert.deepEqual(reportStatus("payment", "CANCELLED"), { label: "ملغاة", tone: "gray" });
  assert.deepEqual(reportStatus("appointment", "SCHEDULED"), { label: "مجدول", tone: "blue" });
  assert.equal(reportStatus("case", "SOMETHING_NEW").label, UNKNOWN_LABEL);
  assert.equal(reportStatus("case", null).label, UNKNOWN_LABEL);
  assert.equal(paymentMethodLabel("BANK_TRANSFER"), "تحويل بنكي");
  assert.equal(paymentMethodLabel("WIRE"), UNKNOWN_LABEL);
  for (const labels of [CASE_STATUS_LABELS, PAYMENT_STATUS_LABELS, APPOINTMENT_STATUS_LABELS]) {
    for (const [value, label] of Object.entries(labels)) {
      assert.notEqual(label, value);
      assert.match(label, /[؀-ۿ]/);
    }
  }
});

test("cssString cannot close the string or the style element", () => {
  const value = cssString('a"b\\c</style><script>\nx');
  assert.ok(value.startsWith('"') && value.endsWith('"'));
  assert.doesNotMatch(value.slice(1, -1), /["<>\n]/);
});

test("layout: RTL A4 document with header, fonts, footer and escaped office data", () => {
  const html = renderReportHtml(
    <ReportLayout meta={{ ...meta, office: { ...meta.office, name: 'مكتب "x"</style><script>alert(1)</script>' } }}>
      <p>محتوى</p>
    </ReportLayout>,
  );

  assert.ok(html.startsWith("<!DOCTYPE html><html lang=\"ar\" dir=\"rtl\">"));
  assert.match(html, /size: A4/);
  assert.match(html, /https:\/\/app\.example\.com\/fonts\/cairo\/cairo-arabic-700-normal\.woff2/);
  assert.match(html, /Powered by Viresto/);
  assert.match(html, /CF-7-20261110/);
  assert.match(html, /رقم التقرير/);
  assert.match(html, /counter\(page\) " من " counter\(pages\)/);
  // Contact details in the header (every browser), not in a page margin box.
  assert.match(html, /report-office-contact">079 123 4567  ·  office@example\.com  ·  عمّان</);
  assert.doesNotMatch(html, /@bottom-(right|left)/);
  assert.match(html, new RegExp(themeTokens.light.sidebar));
  // Data never becomes markup, in the body or in the footer's CSS.
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /Vireto\b/);
});

test("header shows the logo when given, else the office's initial", () => {
  const withLogo = renderReportHtml(
    <ReportLayout meta={{ ...meta, office: { ...meta.office, logoUrl: "https://res.cloudinary.com/x/logo.png" } }}>
      {null}
    </ReportLayout>,
  );
  assert.match(withLogo, /<img src="https:\/\/res\.cloudinary\.com\/x\/logo\.png"/);

  const withoutLogo = renderReportHtml(<ReportLayout meta={meta}>{null}</ReportLayout>);
  assert.doesNotMatch(withoutLogo, /<img/);
  assert.match(withoutLogo, /report-logo-initial">م</);
});

test("section: empty message instead of a table of dashes, or hidden", () => {
  const empty = renderReportHtml(
    <ReportSection title="الجلسات" isEmpty emptyMessage="لا توجد جلسات مسجلة">
      <table />
    </ReportSection>,
  );
  assert.match(empty, /الجلسات/);
  assert.match(empty, /لا توجد جلسات مسجلة/);
  assert.doesNotMatch(empty, /<table/);

  const hidden = renderReportHtml(
    <ReportSection title="الجلسات" isEmpty hideWhenEmpty>
      <table />
    </ReportSection>,
  );
  assert.equal(hidden, "<!DOCTYPE html>");

  const full = renderReportHtml(
    <ReportSection title="القضايا" count={3}>
      <p>x</p>
    </ReportSection>,
  );
  assert.match(full, /report-section-count num">3</);
});

test("table: header row that repeats, numeric cells left to right, escaped cells", () => {
  type Row = { id: string; name: string; amount: string };
  const html = renderReportHtml(
    <ReportTable<Row>
      columns={[
        { key: "name", header: "الاسم", cell: (row) => row.name, strong: true },
        { key: "amount", header: "المبلغ", cell: (row) => row.amount, numeric: true, align: "end" },
      ]}
      rows={[
        { id: "1", name: "<b>أحمد</b>", amount: "100 د.أ" },
        { id: "2", name: "سارة", amount: "50 د.أ" },
      ]}
      rowKey={(row) => row.id}
    />,
  );
  assert.match(html, /<thead><tr><th scope="col" class="">الاسم<\/th>/);
  assert.match(html, /<td class="align-end"><span class="num">100 د\.أ<\/span><\/td>/);
  assert.match(html, /&lt;b&gt;أحمد&lt;\/b&gt;/);
  assert.equal((html.match(/<tr>/g) ?? []).length, 3);
});

test("info grid, summary cards and badges", () => {
  const html = renderReportHtml(
    <>
      <InfoGrid
        items={[
          { label: "الاسم", value: "أحمد" },
          { label: "البريد", value: null },
          { label: "رقم الهوية", value: "986****567", numeric: true },
          { label: "العنوان", value: "عمّان", wide: true },
        ]}
      />
      <SummaryCards
        cards={[
          { label: "المدفوع", value: "100 د.أ" },
          { label: "المتبقي", value: "50 د.أ", tone: "accent" },
        ]}
      />
      <StatusBadge label="نشطة" tone="green" />
    </>,
  );
  assert.match(html, /info-item is-empty"><dt>البريد<\/dt><dd>غير مسجل<\/dd>/);
  assert.match(html, /<span class="num">986\*\*\*\*567<\/span>/);
  assert.match(html, /info-item wide"/);
  assert.match(html, /grid-template-columns:repeat\(2, 1fr\)/);
  assert.match(html, /summary-card tone-accent/);
  assert.match(html, /<span class="badge badge-green">نشطة<\/span>/);
});
