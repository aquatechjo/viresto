import assert from "node:assert/strict";
import test from "node:test";
import {
  canChangeCaseTeam,
  rolesWithPermission,
  type AppPermission,
  type UserRole,
} from "../../src/lib/permissions";

const A: UserRole = "ADMIN";
const L: UserRole = "LAWYER";
const S: UserRole = "STAFF";

// The whole matrix. Record<AppPermission, …> makes typecheck fail when a
// permission is added without a row here, so every grant change is a
// visible edit to this table.
const EXPECTED: Record<AppPermission, UserRole[]> = {
  "case.read": [A, L, S],
  "case.read.all": [A],
  "case.create": [A, L],
  "case.update": [A, L],
  "case.delete": [A],
  "case.lead": [A, L],
  "case.team.manage": [A],
  "client.read": [A, L, S],
  "client.read.all": [A],
  "client.create": [A, L],
  "client.update": [A, L],
  "client.delete": [A],
  "client.contact.read": [A, L],
  "appointment.read": [A, L, S],
  "appointment.read.all": [A],
  "appointment.create": [A, L, S],
  "appointment.update": [A, L, S],
  "appointment.update.others": [A, L],
  "appointment.assign.any": [A, L],
  "appointment.delete": [A, L],
  "task.read": [A, L, S],
  "task.read.all": [A],
  "task.create": [A, L, S],
  "task.update": [A, L, S],
  "task.update.others": [A, L],
  "task.assign.any": [A, L],
  "task.edit.details": [A, L],
  "task.delete": [A, L],
  "document.read": [A, L, S],
  "document.upload": [A, L, S],
  "document.delete": [A, L],
  "document.summarize": [A, L],
  "finance.read": [A, L],
  "finance.read.all": [A],
  "invoice.create": [A, L],
  "invoice.update": [A, L],
  "invoice.delete": [A],
  "payment.create": [A, L],
  "payment.update": [A, L],
  "payment.cancel.paid": [A],
  "payment.delete": [A],
  "reports.read": [A, L],
  "activity.read.all": [A],
  "team.manage": [A],
  "billing.manage": [A],
  "settings.manage": [A],
  "office.data.manage": [A],
};

test("the permission matrix grants exactly the expected roles", () => {
  for (const [permission, roles] of Object.entries(EXPECTED)) {
    assert.deepEqual(
      rolesWithPermission(permission as AppPermission),
      roles,
      permission,
    );
  }
});

test("only the office admin manages team, billing, settings and office data", () => {
  for (const permission of [
    "team.manage",
    "billing.manage",
    "settings.manage",
    "office.data.manage",
  ] as const) {
    assert.deepEqual(rolesWithPermission(permission), [A], permission);
  }
});

test("an office admin can change any case team", () => {
  assert.equal(
    canChangeCaseTeam({ role: "ADMIN", userId: "admin-a" }, "lawyer-b"),
    true,
  );
});

test("the lead lawyer can change the team of their own case", () => {
  assert.equal(
    canChangeCaseTeam({ role: "LAWYER", userId: "lawyer-a" }, "lawyer-a"),
    true,
  );
});

test("a lawyer who is only a member cannot change the case team", () => {
  assert.equal(
    canChangeCaseTeam({ role: "LAWYER", userId: "lawyer-a" }, "lawyer-b"),
    false,
  );
  assert.equal(
    canChangeCaseTeam({ role: "LAWYER", userId: "lawyer-a" }, null),
    false,
  );
});

test("staff cannot change a case team, even if set as lead", () => {
  assert.equal(
    canChangeCaseTeam({ role: "STAFF", userId: "staff-a" }, "staff-a"),
    false,
  );
});
