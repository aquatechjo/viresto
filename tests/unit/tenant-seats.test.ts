import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateSeats } from "../../src/lib/tenant-seats";
import { isSeatLimitExemptPath } from "../../src/lib/request-path-policy";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

const owner = { id: "owner", name: "Owner", role: "LAWYER", createdAt: day(1) };
const lawyer = { id: "lawyer", name: "Lawyer", role: "LAWYER", createdAt: day(2) };
const staff = { id: "staff", name: "Staff", role: "STAFF", createdAt: day(3) };
const admin = { id: "admin", name: "Admin", role: "ADMIN", createdAt: day(4) };

test("under or at the limit: nobody is read-only", () => {
  assert.deepEqual(allocateSeats([owner, lawyer], 5).readOnlyUsers, []);
  assert.deepEqual(allocateSeats([owner, lawyer], 2).readOnlyUsers, []);
  assert.deepEqual(allocateSeats([owner, lawyer, staff], null).readOnlyUsers, []);
});

test("over the limit: the owner, then other admins, then the oldest members keep seats", () => {
  const ids = (limit: number) =>
    allocateSeats([staff, admin, lawyer, owner], limit).readOnlyUsers.map((user) => user.id);

  // The owner is the earliest-created user, whatever the role.
  assert.deepEqual(ids(1), ["admin", "lawyer", "staff"]);
  // A later admin beats older non-admins.
  assert.deepEqual(ids(2), ["lawyer", "staff"]);
  assert.deepEqual(ids(3), ["staff"]);
});

test("the owner always keeps a seat, even with a zero limit", () => {
  const result = allocateSeats([lawyer, owner], 0);
  assert.equal(result.ownerId, "owner");
  assert.deepEqual(result.readOnlyUsers.map((user) => user.id), ["lawyer"]);
});

test("ties on createdAt are broken by id, so the order is stable", () => {
  const a = { id: "a", name: "A", role: "STAFF", createdAt: day(5) };
  const b = { id: "b", name: "B", role: "STAFF", createdAt: day(5) };
  assert.equal(allocateSeats([b, a], 1).ownerId, "a");
});

test("read-only seats may still sign out, manage billing, read notifications and request data", () => {
  assert.equal(isSeatLimitExemptPath("/api/auth/logout", "POST"), true);
  assert.equal(isSeatLimitExemptPath("/api/auth/session/activity", "POST"), true);
  assert.equal(isSeatLimitExemptPath("/api/billing/checkout", "POST"), true);
  assert.equal(isSeatLimitExemptPath("/api/notifications/abc/read", "PATCH"), true);
  assert.equal(isSeatLimitExemptPath("/api/data-requests/deletion", "POST"), true);

  assert.equal(isSeatLimitExemptPath("/api/clients", "POST"), false);
  assert.equal(isSeatLimitExemptPath("/api/team/abc", "PATCH"), false);
  assert.equal(isSeatLimitExemptPath("/api/notifications", "POST"), false);
});
