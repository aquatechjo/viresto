import { test } from "node:test";
import assert from "node:assert/strict";
import { isTaskOverdue, overdueTaskBefore } from "@/lib/task-overdue";
import { zonedDayStart } from "@/lib/datetime";

// Amman is UTC+3 all year. 2026-11-01 14:00 in Amman = 11:00 UTC.
const NOW = new Date("2026-11-01T11:00:00.000Z");
const open = (dueDate: string) => ({ status: "PENDING", dueDate });

test("today's Amman day starts at 21:00 UTC the evening before", () => {
  assert.equal(zonedDayStart(NOW).toISOString(), "2026-10-31T21:00:00.000Z");
  assert.equal(overdueTaskBefore(NOW).toISOString(), "2026-10-31T21:00:00.000Z");
});

test("a task due today is not overdue, even at an hour already past", () => {
  // 00:00, 09:00 and 13:59 Amman time today.
  for (const due of ["2026-10-31T21:00:00.000Z", "2026-11-01T06:00:00.000Z", "2026-11-01T10:59:00.000Z"]) {
    assert.equal(isTaskOverdue(open(due), NOW), false, due);
  }
});

test("a task due yesterday in Amman is overdue, up to its last minute", () => {
  // 23:59 Amman yesterday, which is still 2026-10-31 in UTC as well.
  assert.equal(isTaskOverdue(open("2026-10-31T20:59:00.000Z"), NOW), true);
});

test("just after Amman midnight, yesterday's tasks turn overdue", () => {
  // 00:05 Amman on 2026-11-01 is still 2026-10-31 in UTC.
  const justAfterMidnight = new Date("2026-10-31T21:05:00.000Z");
  assert.equal(isTaskOverdue(open("2026-10-31T20:00:00.000Z"), justAfterMidnight), true);
  assert.equal(isTaskOverdue(open("2026-10-31T21:01:00.000Z"), justAfterMidnight), false);
});

test("completed, cancelled and undated tasks are never overdue", () => {
  const past = "2026-10-01T06:00:00.000Z";
  assert.equal(isTaskOverdue({ status: "COMPLETED", dueDate: past }, NOW), false);
  assert.equal(isTaskOverdue({ status: "CANCELLED", dueDate: past }, NOW), false);
  assert.equal(isTaskOverdue({ status: "PENDING", dueDate: null }, NOW), false);
});
