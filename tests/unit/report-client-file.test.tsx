import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildClientFileHtml,
  clientFileTotals,
  splitAppointments,
  type ClientFileData,
} from "../../src/lib/reports/client-file";

// The client file report (PDF reports plan, phase 2).

const issuedAt = new Date("2026-11-10T09:00:00Z");
const options = { issuedAt, assetBaseUrl: "https://app.example.com" };

const data: ClientFileData = {
  publicId: 42,
  name: "أحمد العبادي",
  phone: "+962791234567",
  email: "ahmad@example.com",
  address: "عمّان، الشميساني",
  nationalId: "9861234567",
  notes: "يفضّل التواصل مساءً",
  archivedAt: null,
  office: { name: "مكتب الحديدي", phone: "+962790000000", email: "office@example.com", address: "عمّان", logoUrl: null },
  access: { contact: true, finance: true },
  cases: [
    { id: "c1", title: "قضية إيجار", caseNumber: "155/2026", court: "محكمة صلح عمّان", status: "OPEN", feeAgreed: "500.000" },
    { id: "c2", title: "قضية عمالية", caseNumber: null, court: null, status: "IN_PROGRESS", feeAgreed: "250.250" },
  ],
  appointments: [
    {
      id: "a1", title: "جلسة بينات", description: "إحضار الشهود", startTime: "2026-11-20T07:00:00Z", endTime: "2026-11-20T08:00:00Z",
      location: null, type: "COURT_SESSION", status: "SCHEDULED", case: { title: "قضية إيجار", caseNumber: "155/2026", court: "محكمة صلح عمّان" },
    },
    {
      id: "a2", title: "اجتماع أولي", description: null, startTime: "2026-10-01T07:00:00Z", endTime: null,
      location: "مقر المكتب", type: "MEETING", status: "COMPLETED", case: null,
    },
    {
      id: "a3", title: "جلسة مؤجلة", description: null, startTime: "2026-10-15T07:00:00Z", endTime: null,
      location: null, type: "COURT_SESSION", status: "CANCELLED", case: null,
    },
  ],
  payments: [
    { id: "p1", amount: "300.000", method: "BANK_TRANSFER", status: "PAID", paidAt: "2026-10-02T10:00:00Z", createdAt: "2026-10-02T10:00:00Z", notes: "الدفعة الأولى", reference: "TRX-1", receiptNumber: "R-2026-0001", cancelledAt: null },
    { id: "p2", amount: "100.000", method: "CASH", status: "PAID", paidAt: "2026-10-05T10:00:00Z", createdAt: "2026-10-05T10:00:00Z", notes: null, reference: null, receiptNumber: null, cancelledAt: "2026-10-06T10:00:00Z" },
    { id: "p3", amount: "50.000", method: "CHECK", status: "PENDING", paidAt: null, createdAt: "2026-11-01T10:00:00Z", notes: null, reference: null, receiptNumber: null, cancelledAt: null },
  ],
};

/** The text a reader sees: no tags, no stylesheet. */
function visibleText(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
}

test("totals: agreed fees, paid without cancelled or pending, remaining", () => {
  assert.deepEqual(clientFileTotals(data), { agreed: 750.25, paid: 300, remaining: 450.25 });
  assert.deepEqual(clientFileTotals({ cases: [], payments: [] }), { agreed: 0, paid: 0, remaining: 0 });
});

test("sessions split at the issue moment: upcoming soonest first, past latest first", () => {
  const { upcoming, past } = splitAppointments(data.appointments, issuedAt);
  assert.deepEqual(upcoming.map((item) => item.id), ["a1"]);
  assert.deepEqual(past.map((item) => item.id), ["a3", "a2"]);
});

test("the full report: sections in order, Arabic labels, never a raw enum", () => {
  const html = buildClientFileHtml(data, options);
  const text = visibleText(html);

  assert.match(html, /<title>ملف الموكل - أحمد العبادي<\/title>/);
  assert.match(text, /ملف الموكل: أحمد العبادي/);
  assert.match(text, /CF-42-20261110/);
  assert.match(text, /مكتب الحديدي/);

  const order = ["البيانات الشخصية", "الملخص المالي", "القضايا", "الجلسات والمواعيد", "المدفوعات"].map((title) =>
    text.indexOf(title),
  );
  assert.ok(order.every((index) => index > 0), "every section is there");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "sections in order");

  assert.match(text, /الأتعاب المتفق عليها/);
  assert.match(text, /750\.25 د\.أ/);
  assert.match(text, /450\.25 د\.أ/);
  assert.match(text, /نشطة/);
  assert.match(text, /قيد المتابعة/);
  assert.match(text, /تحويل بنكي/);
  assert.match(text, /معلقة/);
  assert.match(text, /سند R-2026-0001 · مرجع TRX-1/);
  assert.match(text, /القضية: قضية إيجار \(155\/2026\)/);
  assert.match(text, /ملغى/);
  assert.doesNotMatch(
    text,
    /\b(OPEN|IN_PROGRESS|CLOSED|ARCHIVED|COURT_SESSION|MEETING|BANK_TRANSFER|CASH|CHECK|SCHEDULED|COMPLETED|CANCELLED|PAID|PENDING)\b/,
  );
});

test("national ID masked by default, in full on request", () => {
  assert.match(buildClientFileHtml(data, options), /986\*\*\*\*567/);
  assert.doesNotMatch(buildClientFileHtml(data, options), /9861234567/);
  assert.match(buildClientFileHtml(data, { ...options, revealNationalId: true }), /9861234567/);
});

test("empty client: titles with short messages, no rows of dashes", () => {
  const text = visibleText(
    buildClientFileHtml({ ...data, cases: [], appointments: [], payments: [], email: null, notes: null }, options),
  );
  assert.match(text, /لا توجد أتعاب أو دفعات مسجلة/);
  assert.match(text, /لا توجد قضايا مسجلة/);
  assert.match(text, /لا توجد جلسات أو مواعيد مسجلة/);
  assert.match(text, /لا توجد دفعات مسجلة/);
  assert.match(text, /غير مسجل/);
});

test("only upcoming sessions: the past part says so", () => {
  const text = visibleText(buildClientFileHtml({ ...data, appointments: [data.appointments[0]] }, options));
  assert.match(text, /لا توجد جلسات سابقة/);
  assert.doesNotMatch(text, /لا توجد جلسات قادمة/);
});

test("without finance access: no money sections; without contact access: hidden, not empty", () => {
  const text = visibleText(
    buildClientFileHtml(
      { ...data, payments: [], phone: null, email: null, nationalId: null, address: null, notes: null, access: { contact: false, finance: false } },
      options,
    ),
  );
  assert.doesNotMatch(text, /الملخص المالي/);
  assert.doesNotMatch(text, /المدفوعات/);
  assert.match(text, /غير متاح بصلاحياتك/);
  assert.doesNotMatch(text, /غير مسجل/);
});

test("archived client: marked under the title", () => {
  const text = visibleText(buildClientFileHtml({ ...data, archivedAt: "2026-11-01T10:00:00Z" }, options));
  assert.match(text, /موكل مؤرشف منذ/);
});
