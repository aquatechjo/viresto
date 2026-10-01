import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Login must do the same bcrypt work whether or not the email exists, so
// response time does not reveal which emails have accounts. The real route
// runs; only the DB, the rate limiter and bcrypt itself are mocked.

const compareMock = mock.fn<(...args: unknown[]) => Promise<boolean>>(async () => false);
const findFirstMock = mock.fn<(...args: unknown[]) => Promise<unknown>>(async () => null);

mock.module("bcryptjs", {
  defaultExport: { compare: compareMock, hash: async () => "unused" },
});
mock.module("@/lib/prisma", {
  namedExports: { prisma: { user: { findFirst: findFirstMock } } },
});
mock.module("@/lib/rate-limit", {
  namedExports: {
    checkRateLimit: async () => ({ allowed: true, remaining: 10, resetAt: Date.now() }),
  },
});
mock.module("@/lib/log-activity", {
  namedExports: { logActivity: async () => undefined },
});

let POST: (typeof import("../../src/app/api/auth/login/route"))["POST"];

before(async () => {
  ({ POST } = await import("../../src/app/api/auth/login/route"));
});

beforeEach(() => {
  compareMock.mock.resetCalls();
  findFirstMock.mock.resetCalls();
});

function loginRequest(email: string) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "Wrong#Password1" }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
    },
  });
}

test("login: an unknown email still runs a full-cost bcrypt compare", async () => {
  findFirstMock.mock.mockImplementation(async () => null);

  const res = await POST(loginRequest("nobody@example.com"));

  assert.equal(res.status, 401);
  assert.equal(compareMock.mock.callCount(), 1);
  const [password, hash] = compareMock.mock.calls[0].arguments as [string, string];
  assert.equal(password, "Wrong#Password1");
  // Same algorithm and cost (12) as real password hashes.
  assert.match(hash, /^\$2[aby]\$12\$.{53}$/);
});

test("login: a known email with a wrong password does exactly the same bcrypt work", async () => {
  findFirstMock.mock.mockImplementation(async () => ({
    id: "user-1",
    tenantId: "tenant-1",
    email: "known@example.com",
    passwordHash: "$2a$12$abcdefghijklmnopqrstuuBf5H2c0XlKqv4qkGJ8hY0j7nHnm8pXK",
    isActive: true,
    tenant: { isSuspended: false, status: "ACTIVE" },
  }));

  const res = await POST(loginRequest("known@example.com"));

  assert.equal(res.status, 401);
  assert.equal(compareMock.mock.callCount(), 1);
});
