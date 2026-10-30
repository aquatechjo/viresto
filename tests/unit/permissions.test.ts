import assert from "node:assert/strict";
import test from "node:test";
import { canChangeCaseTeam } from "../../src/lib/permissions";

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
