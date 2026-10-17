import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import speakeasy from "speakeasy";

// AUDIT_REPORT.md H4: an office behind one public IP must be able to sign
// in together, a 2FA login must count once against that shared budget, and
// code guessing must stay tightly limited per account. The real login
// route runs; the DB, bcrypt, logging and the limiter store are mocked
// (the limiter by a counter with the same allow/deny semantics).

process.env.JWT_SECRET ??= "unit-test-jwt-secret-0000000000000000001";

const TOTP_SECRET = speakeasy.generateSecret({ length: 20 }).base32;

const counters = new Map<string, number>();

function bucketCount(prefix: string, identifier: string) {
  return counters.get(`${prefix}:${identifier}`) ?? 0;
}

mock.module("@/lib/rate-limit", {
  namedExports: {
    checkRateLimit: async (identifier: string, options: { keyPrefix: string; max: number }) => {
      const key = `${options.keyPrefix}:${identifier}`;
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      return { allowed: count <= options.max, remaining: Math.max(0, options.max - count), resetAt: Date.now() };
    },
  },
});

let twoFactor = false;

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: {
        findFirst: async ({ where }: { where: { email: string } }) => ({
          id: `user-${where.email}`,
          tenantId: "tenant-1",
          phone: null,
          name: "User",
          email: where.email,
          role: "LAWYER",
          passwordHash: "unused",
          isActive: true,
          isSystemAdmin: false,
          twoFactorEnabled: twoFactor,
          twoFactorSecret: twoFactor ? "encrypted" : null,
          emailVerifiedAt: new Date(),
          tenant: { isSuspended: false, status: "ACTIVE" },
        }),
      },
      session: {
        create: async () => ({ id: "session-1" }),
        findFirst: async () => null,
      },
    },
  },
});
mock.module("bcryptjs", {
  defaultExport: { compare: async () => true, hash: async () => "unused" },
});
mock.module("@/lib/encryption", {
  namedExports: { decryptText: () => TOTP_SECRET },
});
mock.module("@/lib/log-activity", {
  namedExports: { logActivity: async () => undefined },
});

let POST: (typeof import("../../src/app/api/auth/login/route"))["POST"];
let limits: typeof import("../../src/lib/login-rate-limits");

before(async () => {
  ({ POST } = await import("../../src/app/api/auth/login/route"));
  limits = await import("../../src/lib/login-rate-limits");
});

beforeEach(() => {
  counters.clear();
  twoFactor = false;
});

const OFFICE_IP = "203.0.113.7";

function loginRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password: "Right#Password1", ...body }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "x-real-ip": OFFICE_IP,
    },
  });
}

test("a whole office behind one IP can sign in (the old limit allowed 5)", async () => {
  for (let i = 0; i < 20; i++) {
    const res = await POST(loginRequest({ email: `lawyer${i}@office.jo` }));
    assert.equal(res.status, 200, `login ${i + 1}`);
  }

  assert.equal(bucketCount("login", OFFICE_IP), 20);
});

test("the per-IP budget still ends: request 31 in the window is refused", async () => {
  for (let i = 0; i < limits.LOGIN_IP_LIMIT.max; i++) {
    assert.equal((await POST(loginRequest({ email: `u${i}@office.jo` }))).status, 200);
  }

  assert.equal((await POST(loginRequest({ email: "one-more@office.jo" }))).status, 429);
});

test("the per-account limit is unchanged: 15 tries per 15 minutes", async () => {
  assert.equal(limits.LOGIN_ACCOUNT_LIMIT.max, 15);

  for (let i = 0; i < 15; i++) {
    assert.equal((await POST(loginRequest({ email: "target@office.jo" }))).status, 200);
  }

  assert.equal((await POST(loginRequest({ email: "target@office.jo" }))).status, 429);
});

test("a 2FA login counts once against the office's IP budget", async () => {
  twoFactor = true;

  const first = await POST(loginRequest({ email: "twofa@office.jo" }));
  assert.equal(first.status, 200);
  assert.equal((await first.json()).requiresTwoFactor, true);

  const code = speakeasy.totp({ secret: TOTP_SECRET, encoding: "base32" });
  const second = await POST(loginRequest({ email: "twofa@office.jo", code }));
  assert.equal(second.status, 200, await second.clone().text());
  assert.equal((await second.json()).success, true);

  assert.equal(bucketCount("login", OFFICE_IP), 1);
  assert.equal(bucketCount("login-2fa", OFFICE_IP), 1);
});

test("code guessing is held to 5 tries per account", async () => {
  twoFactor = true;

  for (let i = 0; i < limits.LOGIN_2FA_ACCOUNT_LIMIT.max; i++) {
    const res = await POST(loginRequest({ email: "victim@office.jo", code: "000000" }));
    assert.equal(res.status, 401, `wrong code ${i + 1}`);
  }

  const blocked = await POST(loginRequest({ email: "victim@office.jo", code: "000000" }));
  assert.equal(blocked.status, 429);
});
