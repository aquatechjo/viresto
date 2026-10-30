import assert from "node:assert/strict";
import test from "node:test";
import { financialRecipients } from "../../src/lib/notification-recipients";

const member = (userId: string, role: "ADMIN" | "LAWYER" | "STAFF", isActive = true) => ({
  userId,
  user: { isActive, role },
});

test("staff on a case never receive a financial reminder", () => {
  const recipients = financialRecipients(
    {
      leadLawyer: { id: "lead", isActive: true, role: "LAWYER" },
      members: [member("staff-a", "STAFF"), member("lawyer-b", "LAWYER")],
    },
    ["admin-a"],
  );

  assert.deepEqual(recipients.sort(), ["admin-a", "lawyer-b", "lead"]);
  assert.equal(recipients.includes("staff-a"), false);
});

test("a staff lead does not receive a financial reminder", () => {
  const recipients = financialRecipients(
    {
      leadLawyer: { id: "staff-lead", isActive: true, role: "STAFF" },
      members: [],
    },
    ["admin-a"],
  );

  assert.deepEqual(recipients, ["admin-a"]);
});

test("inactive users are left out and admins are not duplicated", () => {
  const recipients = financialRecipients(
    {
      leadLawyer: { id: "admin-a", isActive: true, role: "ADMIN" },
      members: [member("lawyer-off", "LAWYER", false), member("admin-a", "ADMIN")],
    },
    ["admin-a"],
  );

  assert.deepEqual(recipients, ["admin-a"]);
});

test("a reminder without a case goes to the admins only", () => {
  assert.deepEqual(financialRecipients(null, ["admin-a", "admin-b"]), [
    "admin-a",
    "admin-b",
  ]);
});
