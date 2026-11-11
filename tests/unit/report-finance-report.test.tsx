import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFinanceReportHtml,
  financeReportTitle,
  financeScopeLine,
  type FinanceReportData,
  type FinanceReportScope,
} from "../../src/lib/reports/finance-report";
import { rankTopClients } from "../../src/lib/report-finance";

// The finance report (PDF reports plan, phase 3): every filter printed,
// numbers labelled by what they cover, top clients by amount paid, no raw
// enum values.

const clients = [
  { id: "c1", name: "أحمد العبادي" },
  { id: "c2", name: "سارة الخطيب" },
];

const yearly: FinanceReportScope = { type: "yearly", year: 2026, month: 10 };
const options = { issuedAt: new Date("2026-11-11T09:00:00Z"), assetBaseUrl: "https://app.example.com" };

const data: FinanceReportData = {
  office: { name: "مكتب الحديدي", phone: "+962790000000" },
  clients,
  summary: {
    periodRevenue: 1550,
    totalPaidAll: 27230,
    pendingPaymentsAmount: 300,
    totalInvoicesAmount: 5000,
    paidInvoicesAmount: 3500,
    unpaidInvoicesAmount: 1500,
    overdueInvoicesAmount: 400,
    collectionRate: 70,
    totalCases: 5,
    upcomingAppointmentsCount: 23,
    overdueTasksCount: 1,
  },
  caseStatus: { OPEN: 2, IN_PROGRESS: 1, CLOSED: 1, ARCHIVED: 1 },
  topClients: [
    { id: "c2", name: "سارة الخطيب", casesCount: 2, paymentsTotal: 1000, invoicesTotal: 1200 },
    { id: "c1", name: "أحمد العبادي", casesCount: 3, paymentsTotal: 550, invoicesTotal: 900 },
  ],
  monthlyRevenue: Array.from({ length: 12 }, (_, month) => ({ month, revenue: month === 9 ? 1550 : 0 })),
  periodPayments: [
    {
      id: "p1", amount: 1000, status: "PAID", method: "BANK_TRANSFER", reportDate: "2026-10-02T10:00:00Z",
      notes: null, reference: "TRX-1", receiptNumber: "R-2026-0001", client: { name: "سارة الخطيب" }, case: { title: "قضية إيجار" },
    },
    {
      id: "p2", amount: 300, status: "PENDING", method: "CHECK", reportDate: "2026-10-05T10:00:00Z",
      notes: "شيك مؤجل", client: { name: "أحمد العبادي" }, case: null,
    },
  ],
  periodInvoices: [
    {
      id: "i1", invoiceNumber: "INV-2026-0018", total: 1200, status: "PARTIALLY_PAID", isOverdue: true,
      issueDate: "2026-09-01T00:00:00Z", dueDate: "2026-09-30T00:00:00Z", paidAmount: 800, remainingAmount: 400,
      client: { name: "سارة الخطيب" }, case: { title: "قضية إيجار" },
    },
    {
      id: "i2", invoiceNumber: null, total: 200, status: "DRAFT", isOverdue: false,
      issueDate: "2026-10-01T00:00:00Z", dueDate: null, paidAmount: 0, remainingAmount: 200, client: { name: "أحمد العبادي" },
    },
  ],
  upcomingAppointments: Array.from({ length: 10 }, (_, i) => ({
    id: `a${i}`, title: `جلسة ${i + 1}`, startTime: `2026-11-${String(12 + i).padStart(2, "0")}T07:00:00Z`, location: "محكمة بداية عمّان",
  })),
  overdueTasks: [{ id: "t1", title: "تقديم لائحة", dueDate: "2026-11-01T00:00:00Z", priority: "URGENT", case: { title: "قضية إيجار" } }],
  detailCounts: { payments: 2, invoices: 2 },
};

function visibleText(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
}

test("top clients: by amount paid, nothing paid left out, ties by billed then name", () => {
  const ranked = rankTopClients([
    { id: "a", name: "ب", casesCount: 9, paymentsTotal: 0, invoicesTotal: 9000 },
    { id: "b", name: "ج", casesCount: 1, paymentsTotal: 500, invoicesTotal: 100 },
    { id: "c", name: "أ", casesCount: 1, paymentsTotal: 500, invoicesTotal: 100 },
    { id: "d", name: "د", casesCount: 1, paymentsTotal: 500, invoicesTotal: 700 },
    { id: "e", name: "هـ", casesCount: 1, paymentsTotal: 1200, invoicesTotal: 0 },
  ]);
  assert.deepEqual(ranked.map((row) => row.id), ["e", "d", "c", "b"]);
  assert.equal(rankTopClients(Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: String(i), casesCount: 0, paymentsTotal: i + 1, invoicesTotal: 0 }))).length, 5);
});

test("title and scope line: the period, then only the filters that are set", () => {
  assert.equal(financeReportTitle(yearly), "التقرير السنوي 2026");
  assert.equal(financeReportTitle({ ...yearly, type: "monthly" }), "تقرير نوفمبر 2026");

  assert.equal(financeScopeLine(yearly, clients), "الفترة: 2026  ·  جميع الموكلين والحالات");
  assert.equal(
    financeScopeLine(
      { type: "monthly", year: 2026, month: 10, clientId: "c1", caseStatus: "OPEN", paymentStatus: "PENDING", invoiceStatus: "OVERDUE" },
      clients,
    ),
    "الفترة: نوفمبر 2026  ·  الموكل: أحمد العبادي  ·  حالة القضية: نشطة  ·  الدفعات: معلقة  ·  الفواتير: متأخرة",
  );
  assert.equal(financeScopeLine({ ...yearly, paymentStatus: "PAID" }, clients), "الفترة: 2026  ·  الدفعات: مدفوعة");
  assert.match(financeScopeLine({ ...yearly, clientId: "gone" }, clients), /الموكل: غير محدد/);
});

test("the full report: sections, Arabic labels, never a raw enum or the activity score", () => {
  const html = buildFinanceReportHtml(data, yearly, options);
  const text = visibleText(html);

  assert.match(html, /<title>التقرير السنوي 2026 - مكتب الحديدي<\/title>/);
  assert.match(text, /FR-2026-20261111/);
  assert.match(text, /الفترة: 2026  ·  جميع الموكلين والحالات/);

  for (const title of ["أرقام الفترة", "الوضع المالي الحالي", "القضايا", "الإيرادات الشهرية 2026", "أعلى الموكلين بالمبلغ المدفوع", "دفعات الفترة", "فواتير الفترة", "المواعيد القادمة", "المهام المتأخرة"]) {
    assert.ok(text.includes(title), title);
  }
  // Numbers say what they cover.
  assert.match(text, /كل الفترات حتى تاريخ الإصدار/);
  assert.match(text, /1,550 د\.أ/);
  assert.match(text, /27,230 د\.أ/);
  assert.match(text, /70%/);

  assert.match(text, /تحويل بنكي/);
  assert.match(text, /شيك/);
  assert.match(text, /سند R-2026-0001 · مرجع TRX-1/);
  assert.match(text, /مدفوعة جزئيًا • متأخرة/);
  assert.match(text, /مسودة/);
  assert.match(text, /الاستحقاق: /);
  assert.match(text, /عاجلة/);
  assert.match(text, /يعرض 10 من 23/);
  assert.doesNotMatch(text, /مؤشر النشاط/);
  assert.doesNotMatch(
    text,
    /\b(OPEN|IN_PROGRESS|CLOSED|ARCHIVED|PAID|PENDING|OVERDUE|CANCELLED|DRAFT|UNPAID|PARTIALLY_PAID|CASH|BANK_TRANSFER|CHECK|ONLINE|URGENT|HIGH|MEDIUM|LOW)\b/,
  );

  // Top clients in the order given (the API ranks), numbered.
  assert.ok(text.indexOf("سارة الخطيب") < text.indexOf("أحمد العبادي", text.indexOf("أعلى الموكلين")));
});

test("a payment filter other than paid: the period revenue is not shown as zero", () => {
  const text = visibleText(buildFinanceReportHtml(data, { ...yearly, paymentStatus: "PENDING" }, options));
  assert.match(text, /لا تُحسب مع فلتر الدفعات الحالي/);
  assert.doesNotMatch(text, /إيرادات الفترة\s+1,550/);
});

test("monthly report: no monthly-revenue table; FR number carries the month", () => {
  const text = visibleText(buildFinanceReportHtml(data, { ...yearly, type: "monthly" }, options));
  assert.doesNotMatch(text, /الإيرادات الشهرية/);
  assert.match(text, /FR-2026-11-20261111/);
});

test("empty office data: short messages instead of tables", () => {
  const text = visibleText(
    buildFinanceReportHtml(
      {
        ...data,
        summary: { ...data.summary, totalCases: 0, upcomingAppointmentsCount: 0, overdueTasksCount: 0 },
        topClients: [],
        periodPayments: [],
        periodInvoices: [],
        upcomingAppointments: [],
        overdueTasks: [],
        detailCounts: { payments: 0, invoices: 0 },
      },
      yearly,
      options,
    ),
  );
  for (const message of [
    "لا توجد قضايا ضمن الفلاتر الحالية",
    "لا توجد دفعات محصّلة ضمن الفلاتر الحالية",
    "لا توجد دفعات ضمن الفلاتر الحالية",
    "لا توجد فواتير ضمن الفلاتر الحالية",
    "لا توجد مواعيد قادمة ضمن الفترة",
    "لا توجد مهام متأخرة ضمن الفترة",
  ]) {
    assert.ok(text.includes(message), message);
  }
});
