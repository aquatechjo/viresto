import { test } from "node:test";
import assert from "node:assert/strict";
import { appointmentListWhere } from "@/lib/appointment-query";

const from = new Date("2026-11-01T21:00:00.000Z");
const to = new Date("2026-11-02T21:00:00.000Z");

const archivedRules = [
  { OR: [{ clientId: null }, { client: { archivedAt: null } }] },
  { OR: [{ caseId: null }, { case: { client: { archivedAt: null } } }] },
];
const rangeRules = [
  { startTime: { lt: to } },
  { OR: [{ endTime: { gt: from } }, { endTime: null, startTime: { gte: from } }] },
];

test("archived clients stay out when a date range is given too (was dropped)", () => {
  const where = appointmentListWhere({ userId: "u1", includeArchivedClients: false, from, to });
  assert.deepEqual(where, { AND: [...archivedRules, ...rangeRules] });
});

test("archived clients stay out without a range", () => {
  const where = appointmentListWhere({ userId: "u1", includeArchivedClients: false });
  assert.deepEqual(where, { AND: archivedRules });
});

test("includeArchivedClients keeps only the range", () => {
  const where = appointmentListWhere({ userId: "u1", includeArchivedClients: true, from, to });
  assert.deepEqual(where, { AND: rangeRules });
});

test("assignee filter: 'me' is the caller, otherwise the given id", () => {
  assert.deepEqual(
    appointmentListWhere({ userId: "u1", assignedToId: "me", includeArchivedClients: true }),
    { AND: [{ assignedToId: "u1" }] },
  );
  assert.deepEqual(
    appointmentListWhere({ userId: "u1", assignedToId: "u2", includeArchivedClients: true }),
    { AND: [{ assignedToId: "u2" }] },
  );
  assert.deepEqual(appointmentListWhere({ userId: "u1", includeArchivedClients: true }), {});
});
