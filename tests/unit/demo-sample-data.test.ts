import assert from "node:assert/strict";
import test from "node:test";
import { DateTime } from "luxon";
import {
  DEMO_ZONE,
  buildDemoSampleData,
  demoNationalId,
  demoPhone,
} from "../../src/lib/demo/sample-data";
import { isDemoEmail } from "../../src/lib/demo/constants";

const NOW = new Date("2026-10-18T09:00:00.000Z");

function build(now = NOW) {
  let next = 0;
  return buildDemoSampleData({
    tenantId: "demo-tenant",
    users: { admin: "u-admin", lawyer: "u-lawyer", staff: "u-staff" },
    now,
    newId: () => `id-${++next}`,
    // Reversible stand-ins, so the test can read what would be encrypted.
    encrypt: (value) => `enc(${value})`,
    hash: (value) => `hash(${value})`,
    normalizePhone: (value) => value,
    normalizeEmail: (value) => value.trim().toLowerCase(),
  });
}

const plain = (value: unknown) => String(value).replace(/^enc\((.*)\)$/, "$1");

test("the sample office has the promised volume of data", () => {
  const data = build();

  assert.equal(data.clients.length, 15);
  assert.equal(data.cases.length, 20);
  assert.ok(data.appointments.length >= 20);
  assert.ok(data.tasks.length >= 15);
  assert.ok(data.documents.length >= 10);
  assert.ok(data.invoices.length >= 8);
});

test("cases cover civil, criminal, labour and commercial matters in Jordanian courts", () => {
  const titles = build().cases.map((item) => item.title);

  for (const kind of ["مدنية", "جزائية", "عمالية", "تجارية"]) {
    assert.ok(titles.some((title) => title.includes(kind)), kind);
  }

  for (const item of build().cases) {
    assert.match(String(item.court), /محكمة|المحكمة/);
    assert.match(String(item.caseNumber), /^\d+\/2026$/);
  }
});

test("phones, national IDs and emails are fake by construction", () => {
  const data = build();

  for (const client of data.clients) {
    const phone = plain(client.phone);
    const nationalId = plain(client.nationalId);

    // 10 digits like the form requires, but on the unallocated 070 prefix
    // (Jordanian mobiles are 077/078/079).
    assert.match(phone, /^0700000\d{3}$/);
    assert.doesNotMatch(phone, /^07[789]/);
    // Real national numbers never start with 0.
    assert.match(nationalId, /^00000000\d{2}$/);

    if (client.email) assert.ok(isDemoEmail(plain(client.email)), plain(client.email));
  }

  assert.equal(demoPhone(7), "0700000007");
  assert.equal(demoNationalId(12), "0000000012");
});

test("client contact fields are stored encrypted with their search hashes", () => {
  for (const client of build().clients) {
    assert.match(String(client.phone), /^enc\(/);
    assert.match(String(client.nationalId), /^enc\(/);
    assert.equal(client.phoneHash, `hash(${plain(client.phone)})`);
    assert.equal(client.nationalIdHash, `hash(${plain(client.nationalId)})`);
  }
});

test("every row belongs to the sandbox office and every id is unique", () => {
  const data = build();
  const rows = [
    ...data.clients, ...data.cases, ...data.caseMembers, ...data.appointments,
    ...data.tasks, ...data.documents, ...data.invoices, ...data.payments,
  ];

  for (const row of rows) assert.equal(row.tenantId, "demo-tenant");

  const ids = [...rows, ...data.invoiceItems].map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("appointments fall in this month and next, with several types and statuses", () => {
  const data = build();
  const start = DateTime.fromJSDate(NOW).setZone(DEMO_ZONE).startOf("month");
  const end = start.plus({ months: 2 }).plus({ days: 2 });
  const types = new Set(data.appointments.map((item) => item.type));

  for (const item of data.appointments) {
    const at = (item.startTime as Date).getTime();
    assert.ok(at >= start.toMillis() && at < end.toMillis(), String(item.startTime));
    // Past sessions are done (or cancelled), future ones are scheduled.
    assert.equal(item.status === "SCHEDULED", at >= NOW.getTime(), item.title);
  }

  for (const type of ["COURT_SESSION", "MEETING", "PHONE_CALL", "DEADLINE"]) {
    assert.ok(types.has(type as never), type);
  }
});

test("tasks include done, overdue and upcoming work", () => {
  const tasks = build().tasks;
  const due = (item: (typeof tasks)[number]) => (item.dueDate as Date).getTime();

  assert.ok(tasks.some((item) => item.completed && item.status === "COMPLETED"));
  assert.ok(tasks.some((item) => !item.completed && due(item) < NOW.getTime()));
  assert.ok(tasks.some((item) => !item.completed && due(item) > NOW.getTime()));
});

test("invoices are paid, partially paid and unpaid, and agree with their payments", () => {
  const data = build();
  const statuses = new Set(data.invoices.map((item) => item.status));

  for (const status of ["PAID", "PARTIALLY_PAID", "UNPAID", "OVERDUE"]) {
    assert.ok(statuses.has(status as never), status);
  }

  for (const invoice of data.invoices) {
    const paid = data.payments
      .filter((item) => item.invoiceId === invoice.id && item.status === "PAID")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const total = Number(invoice.total);

    if (invoice.status === "PAID") assert.equal(paid, total);
    if (invoice.status === "PARTIALLY_PAID") assert.ok(paid > 0 && paid < total);
    if (invoice.status === "UNPAID" || invoice.status === "OVERDUE") assert.equal(paid, 0);
  }

  assert.equal(data.invoiceSequence.nextNumber, data.invoices.length + 1);
  assert.ok(data.payments.some((item) => item.status === "PENDING"));
});

test("documents are records only, never pointing at a stored file", () => {
  for (const document of build().documents) {
    assert.equal(document.publicId, null);
    assert.equal(document.fileUrl, "");
  }
});

test("the dashboard has something in every section", () => {
  const data = build();
  const today = DateTime.fromJSDate(NOW).setZone(DEMO_ZONE).startOf("day");
  const weekEnd = today.plus({ days: 7 }).toMillis();

  // Court sessions spread over the next seven days, the next one soon
  // (within 48 hours except across the Friday-Saturday weekend).
  const upcomingSessions = data.appointments.filter(
    (item) =>
      item.type === "COURT_SESSION" &&
      item.status === "SCHEDULED" &&
      (item.startTime as Date).getTime() < weekEnd,
  );
  const sessionDays = new Set(
    upcomingSessions.map((item) => DateTime.fromJSDate(item.startTime as Date).setZone(DEMO_ZONE).toISODate()),
  );
  assert.ok(sessionDays.size >= 4, `${sessionDays.size} days with sessions`);
  assert.ok(
    upcomingSessions.some((item) => (item.startTime as Date).getTime() < NOW.getTime() + 72 * 3600 * 1000),
  );

  // Invoices and payments over the last six months.
  const months = (dates: Date[]) =>
    new Set(dates.map((date) => DateTime.fromJSDate(date).setZone(DEMO_ZONE).toFormat("yyyy-MM")));
  assert.ok(months(data.invoices.map((item) => item.issueDate as Date)).size >= 6);
  assert.ok(months(data.payments.filter((item) => item.paidAt).map((item) => item.paidAt as Date)).size >= 5);

  // Every case status, and open cases idle for 30+ days.
  const statuses = new Set(data.cases.map((item) => item.status));
  for (const status of ["OPEN", "IN_PROGRESS", "CLOSED", "ARCHIVED"]) {
    assert.ok(statuses.has(status as never), status);
  }
  const staleBefore = NOW.getTime() - 30 * 24 * 3600 * 1000;
  assert.ok(
    data.cases.some(
      (item) =>
        (item.status === "OPEN" || item.status === "IN_PROGRESS") &&
        (item.updatedAt as Date).getTime() < staleBefore,
    ),
  );
  for (const item of data.cases) {
    assert.ok((item.updatedAt as Date).getTime() <= NOW.getTime(), item.title);
    assert.ok((item.updatedAt as Date).getTime() >= (item.createdAt as Date).getTime(), item.title);
  }

  // More than one kind of document.
  assert.ok(new Set(data.documents.map((item) => item.fileType)).size >= 3);
});

test("the activity log is the office's own history, none of it in the future", () => {
  const data = build();

  assert.ok(data.activities.length >= 20);
  for (const type of ["CLIENT_CREATED", "CASE_CREATED", "DOCUMENT_UPLOADED", "PAYMENT_CREATED"]) {
    assert.ok(data.activities.some((item) => item.type === type), type);
  }
  for (const item of data.activities) {
    assert.equal(item.tenantId, "demo-tenant");
    assert.ok((item.createdAt as Date).getTime() <= NOW.getTime(), item.type);
  }
});
