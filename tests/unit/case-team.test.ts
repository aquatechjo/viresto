import assert from "node:assert/strict";
import test from "node:test";
import {
  caseMembersAfterEdit,
  caseMembersForCreate,
  isCaseTeamChange,
} from "../../src/lib/case-team";

function sorted(ids: string[] | undefined) {
  return ids ? [...ids].sort() : ids;
}

test("a lawyer who creates a case for another lead is added as a member", () => {
  const members = caseMembersForCreate({
    actor: { role: "LAWYER", userId: "lawyer-a" },
    leadLawyerId: "lawyer-b",
    memberIds: ["lawyer-c"],
  });

  assert.deepEqual(sorted(members), ["lawyer-a", "lawyer-c"]);
});

test("a lawyer who leads the case they create is not also a member", () => {
  const members = caseMembersForCreate({
    actor: { role: "LAWYER", userId: "lawyer-a" },
    leadLawyerId: "lawyer-a",
    memberIds: ["lawyer-a", "lawyer-c"],
  });

  assert.deepEqual(members, ["lawyer-c"]);
});

test("an admin who creates a case picks the team freely", () => {
  const members = caseMembersForCreate({
    actor: { role: "ADMIN", userId: "admin-a" },
    leadLawyerId: "lawyer-b",
    memberIds: undefined,
  });

  assert.deepEqual(members, []);
});

const current = { leadLawyerId: "lead", memberIds: ["m1", "m2"] };

test("resending the same team in another order is not a team change", () => {
  assert.equal(
    isCaseTeamChange(current, { leadLawyerId: "lead", memberIds: ["m2", "m1"] }),
    false,
  );
  assert.equal(
    isCaseTeamChange(current, {
      leadLawyerId: "lead",
      memberIds: ["m1", "m1", "m2", "lead"],
    }),
    false,
  );
  assert.equal(
    isCaseTeamChange(current, { leadLawyerId: "lead", memberIds: undefined }),
    false,
  );
});

test("a new lead, an added member or a removed member is a team change", () => {
  assert.equal(
    isCaseTeamChange(current, { leadLawyerId: "m1", memberIds: undefined }),
    true,
  );
  assert.equal(
    isCaseTeamChange(current, {
      leadLawyerId: "lead",
      memberIds: ["m1", "m2", "m3"],
    }),
    true,
  );
  assert.equal(
    isCaseTeamChange(current, { leadLawyerId: "lead", memberIds: ["m1"] }),
    true,
  );
  assert.equal(
    isCaseTeamChange(current, { leadLawyerId: "lead", memberIds: ["m1", "m3"] }),
    true,
  );
});

test("an edit that keeps the lead and sends no members leaves members alone", () => {
  assert.equal(
    caseMembersAfterEdit(current, { leadLawyerId: "lead", memberIds: undefined }),
    undefined,
  );
});

test("a lead who hands over the case stays on it as a member", () => {
  assert.deepEqual(
    sorted(
      caseMembersAfterEdit(current, { leadLawyerId: "m1", memberIds: undefined }),
    ),
    ["lead", "m2"],
  );
  assert.deepEqual(
    sorted(
      caseMembersAfterEdit(current, { leadLawyerId: "new", memberIds: ["m1"] }),
    ),
    ["lead", "m1"],
  );
});

test("a handover keeps the previous lead even when the edit drops them", () => {
  assert.deepEqual(
    sorted(caseMembersAfterEdit(current, { leadLawyerId: "new", memberIds: [] })),
    ["lead"],
  );
});

test("a case without a lead gains no member from the first lead", () => {
  assert.equal(
    caseMembersAfterEdit(
      { leadLawyerId: null, memberIds: ["m1"] },
      { leadLawyerId: "new", memberIds: undefined },
    ),
    undefined,
  );
  assert.deepEqual(
    caseMembersAfterEdit(
      { leadLawyerId: null, memberIds: ["m1"] },
      { leadLawyerId: "new", memberIds: ["m1"] },
    ),
    ["m1"],
  );
});
