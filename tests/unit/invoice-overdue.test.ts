import assert from "node:assert/strict";
import test from "node:test";
import { isPastDue, overdueFrom, pastDueBefore } from "@/lib/datetime";
import { calculateInvoiceStatus } from "@/lib/finance";
import { isInvoiceOverdue } from "@/lib/report-finance";

// An invoice due on 26 Oct is late only from 27 Oct 00:00 in Amman, never
// during the 26th. Amman is UTC+3: 26 Oct 00:00 Amman = 25 Oct 21:00Z.
// Run under TZ=UTC and TZ=Asia/Amman (see PROJECT_STATUS): the result must
// not depend on the machine zone.

const machineZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// What POST/PATCH /api/invoices store for "2026-10-26".
const dueDate = new Date("2026-10-26");

const ammanMoments = {
  "25 Oct 23:59": new Date("2026-10-25T20:59:00.000Z"),
  "26 Oct 00:00": new Date("2026-10-25T21:00:00.000Z"),
  "26 Oct 03:00": new Date("2026-10-26T00:00:00.000Z"),
  "26 Oct 03:01": new Date("2026-10-26T00:01:00.000Z"),
  "26 Oct 10:00": new Date("2026-10-26T07:00:00.000Z"),
  "26 Oct 23:59": new Date("2026-10-26T20:59:59.999Z"),
  "27 Oct 00:00": new Date("2026-10-26T21:00:00.000Z"),
  "27 Oct 12:00": new Date("2026-10-27T09:00:00.000Z"),
};

const expected: Record<keyof typeof ammanMoments, boolean> = {
  "25 Oct 23:59": false,
  "26 Oct 00:00": false,
  "26 Oct 03:00": false,
  "26 Oct 03:01": false,
  "26 Oct 10:00": false,
  "26 Oct 23:59": false,
  "27 Oct 00:00": true,
  "27 Oct 12:00": true,
};

const unpaid = { status: "UNPAID", total: 100, dueDate, payments: [] };

for (const [label, now] of Object.entries(ammanMoments) as [keyof typeof ammanMoments, Date][]) {
  const late = expected[label];

  test(`due 26 Oct, Amman ${label}: ${late ? "overdue" : "not overdue"} (machine zone ${machineZone})`, () => {
    assert.equal(isPastDue(dueDate, now), late);

    // The database filter (reports, notifications) agrees with isPastDue.
    assert.equal(dueDate.getTime() < pastDueBefore(now).getTime(), late);

    // Invoice status written after payment changes.
    assert.equal(
      calculateInvoiceStatus({ currentStatus: "UNPAID", total: 100, paidTotal: 0, dueDate, now }),
      late ? "OVERDUE" : "UNPAID",
    );

    // Reports' overdue amount.
    assert.equal(isInvoiceOverdue(unpaid, now), late);
  });
}

test("the overdue moment is Amman midnight after the due day", () => {
  assert.equal(overdueFrom(dueDate)?.toISOString(), "2026-10-26T21:00:00.000Z");
});

test("no due date, an invalid one, or a paid invoice is never overdue", () => {
  const later = new Date("2027-01-01T00:00:00.000Z");
  assert.equal(isPastDue(null, later), false);
  assert.equal(isPastDue(undefined, later), false);
  assert.equal(isPastDue("not a date", later), false);
  assert.equal(
    calculateInvoiceStatus({ currentStatus: "UNPAID", total: 100, paidTotal: 100, dueDate, now: later }),
    "PAID",
  );
});
