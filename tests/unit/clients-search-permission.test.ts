import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// GET /api/clients?q= must only match the encrypted contact fields (phone,
// email, national ID, through their HMAC hashes) for roles holding
// client.contact.read. Name and publicId search stay open to every role.

process.env.SEARCH_HASH_SECRET ||= "test-search-hash-secret";

type Role = "ADMIN" | "LAWYER" | "STAFF";
let currentRole: Role = "ADMIN";

const requirePermissionMock = mock.fn(async () => ({
  error: null,
  user: { userId: "user-1", tenantId: "tenant-1", role: currentRole },
}));
const findManyMock = mock.fn(async (_args: { where: unknown }) => []);
const countMock = mock.fn(async () => 0);

mock.module("@/lib/api-auth", {
  namedExports: {
    requirePermission: requirePermissionMock,
    getRequestMeta: () => ({}),
  },
});
mock.module("@/lib/csrf", { namedExports: { verifySameOrigin: () => null } });
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: { client: { findMany: findManyMock, count: countMock } },
  },
});

let GET: (typeof import("../../src/app/api/clients/route"))["GET"];

before(async () => {
  ({ GET } = await import("../../src/app/api/clients/route"));
});

async function searchWhere(role: Role, q: string) {
  currentRole = role;
  findManyMock.mock.resetCalls();
  const res = await GET(
    new NextRequest(`https://app.test/api/clients?q=${encodeURIComponent(q)}`),
  );
  assert.equal(res.status, 200);
  return JSON.stringify(findManyMock.mock.calls[0].arguments[0].where);
}

test("staff can't match a client by phone, email or national ID", async () => {
  for (const q of ["0791234567", "client@example.com", "9876543210"]) {
    const where = await searchWhere("STAFF", q);
    assert.ok(!where.includes("phoneHash"), q);
    assert.ok(!where.includes("emailHash"), q);
    assert.ok(!where.includes("nationalIdHash"), q);
  }
});

test("roles with client.contact.read still match by phone and national ID", async () => {
  for (const role of ["ADMIN", "LAWYER"] as const) {
    const where = await searchWhere(role, "0791234567");
    assert.ok(where.includes("phoneHash"), role);
    assert.ok(where.includes("nationalIdHash"), role);
  }
});

test("name and publicId search work for every role", async () => {
  for (const role of ["ADMIN", "LAWYER", "STAFF"] as const) {
    assert.ok((await searchWhere(role, "أحمد")).includes('"name"'), role);
    assert.ok((await searchWhere(role, "42")).includes('"publicId":42'), role);
  }
});

test("every way to type a phone searches the same hash, and so does a spaced national ID", async () => {
  const { hashSearchValue } = await import("../../src/lib/encryption");
  const phoneHash = hashSearchValue("+962791234567")!;
  for (const q of ["0791234567", "+962791234567", "00962791234567", "962791234567", "٠٧٩١٢٣٤٥٦٧", "079 123 4567"]) {
    assert.ok((await searchWhere("ADMIN", q)).includes(phoneHash), q);
  }

  const nationalIdHash = hashSearchValue("9991234567")!;
  for (const q of ["9991234567", "٩٩٩١٢٣٤٥٦٧", "999 123 4567"]) {
    assert.ok((await searchWhere("ADMIN", q)).includes(nationalIdHash), q);
  }

  // Text that is no national ID is not hashed as one.
  assert.ok(!(await searchWhere("ADMIN", "أحمد")).includes("nationalIdHash"));
});
