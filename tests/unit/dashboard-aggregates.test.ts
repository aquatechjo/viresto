import assert from "node:assert/strict";
import test from "node:test";
import {
  agingBuckets,
  buildAgenda,
  casesByCourtLevel,
  courtLevel,
  lastMonthKeys,
  monthlyTotals,
  percentChange,
} from "../../src/lib/dashboard/aggregates";

const ZONE = "Asia/Amman";
// 2026-10-23 12:00 in Amman (UTC+3).
const NOW = new Date("2026-10-23T09:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

test("the last six months end with the current one, in the office zone", () => {
  assert.deepEqual(lastMonthKeys(NOW, ZONE, 6), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  // 23:30 UTC on 31 Oct is already November in Amman.
  assert.deepEqual(lastMonthKeys(new Date("2026-10-31T23:30:00Z"), ZONE, 1), ["2026-11"]);
});

test("monthly totals bucket invoices by issue date and payments by paid date", () => {
  const months = lastMonthKeys(NOW, ZONE, 3);
  const totals = monthlyTotals(
    months,
    [
      { issueDate: new Date("2026-10-02T10:00:00Z"), total: 1000 },
      { issueDate: new Date("2026-10-20T10:00:00Z"), total: 500.5 },
      { issueDate: new Date("2026-08-15T10:00:00Z"), total: 200 },
      { issueDate: new Date("2026-01-15T10:00:00Z"), total: 999 },
    ],
    [
      { paidAt: new Date("2026-09-30T22:30:00Z"), amount: 300 },
      { paidAt: null, amount: 50 },
    ],
    ZONE,
  );

  assert.deepEqual(totals, [
    { month: "2026-08", invoiced: 200, collected: 0 },
    { month: "2026-09", invoiced: 0, collected: 0 },
    { month: "2026-10", invoiced: 1500.5, collected: 300 },
  ]);
});

test("receivables age by days since the invoice date", () => {
  const buckets = agingBuckets(
    [
      { issueDate: daysAgo(5), outstanding: 100 },
      { issueDate: daysAgo(30), outstanding: 50 },
      { issueDate: daysAgo(31), outstanding: 200 },
      { issueDate: daysAgo(75), outstanding: 300 },
      { issueDate: daysAgo(120), outstanding: 400 },
      { issueDate: daysAgo(200), outstanding: 0 },
    ],
    NOW,
  );

  assert.deepEqual(buckets, { d0_30: 150, d31_60: 200, d61_90: 300, d90_plus: 400 });
});

test("month-over-month change needs a base", () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(50, 200), -75);
  assert.equal(percentChange(100, 0), null);
});

test("court names map to Jordanian court levels", () => {
  assert.equal(courtLevel("محكمة صلح حقوق عمّان"), "MAGISTRATE");
  assert.equal(courtLevel("محكمة صلح جزاء المفرق"), "MAGISTRATE");
  assert.equal(courtLevel("محكمة بداية حقوق إربد"), "FIRST_INSTANCE");
  assert.equal(courtLevel("محكمة استئناف عمّان"), "APPEAL");
  assert.equal(courtLevel("محكمة التمييز"), "CASSATION");
  assert.equal(courtLevel("محكمة الجنايات الكبرى"), "CRIMINAL");
  assert.equal(courtLevel("محكمة السلط الشرعية"), "SHARIA");
  assert.equal(courtLevel("المحكمة الإدارية"), "ADMINISTRATIVE");
  assert.equal(courtLevel("Amman Court of Appeal"), "APPEAL");
  assert.equal(courtLevel("هيئة تحكيم"), "OTHER");
  assert.equal(courtLevel("  "), "UNSPECIFIED");
  assert.equal(courtLevel(null), "UNSPECIFIED");
});

test("cases by court level merge courts and keep the top five", () => {
  const rows = casesByCourtLevel([
    { court: "محكمة صلح حقوق عمّان", count: 3 },
    { court: "محكمة صلح حقوق الكرك", count: 2 },
    { court: "محكمة بداية حقوق عمّان", count: 4 },
    { court: "محكمة التمييز", count: 1 },
    { court: "محكمة استئناف عمّان", count: 2 },
    { court: "المحكمة الإدارية", count: 1 },
    { court: null, count: 1 },
  ]);

  assert.equal(rows.length, 5);
  assert.deepEqual(rows.slice(0, 2), [
    { level: "MAGISTRATE", count: 5 },
    { level: "FIRST_INSTANCE", count: 4 },
  ]);
});

test("the agenda mixes appointments and task deadlines in time order", () => {
  const agenda = buildAgenda(
    [
      { id: "a1", title: "جلسة", type: "COURT_SESSION", startTime: new Date("2026-10-24T06:30:00Z"), location: null, case: null, client: null },
      { id: "a2", title: "اجتماع", type: "MEETING", startTime: new Date("2026-10-23T11:00:00Z"), location: "مقر المكتب", case: null, client: null },
    ],
    [
      // Midnight in Amman: a date-only deadline, sorted to the end of its day.
      { id: "t1", title: "مهمة بلا وقت", dueDate: new Date("2026-10-22T21:00:00Z"), case: null, client: null },
      { id: "t2", title: "مهمة", dueDate: new Date("2026-10-24T05:00:00Z"), case: null, client: null },
      { id: "t3", title: "بلا تاريخ", dueDate: null, case: null, client: null },
    ],
    ZONE,
  );

  assert.deepEqual(
    agenda.map((item) => [item.id, item.kind, item.day, item.hasTime]),
    [
      ["appointment-a2", "MEETING", "2026-10-23", true],
      ["task-t1", "TASK", "2026-10-23", false],
      ["task-t2", "TASK", "2026-10-24", true],
      ["appointment-a1", "COURT_SESSION", "2026-10-24", true],
    ],
  );
});
