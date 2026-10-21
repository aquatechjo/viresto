import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// reset-password handles its own errors instead of apiHandler. When the
// rate-limit store is down it must answer like apiHandler does (503, "try
// again shortly") before touching any account; every other error keeps
// its 500. The real route runs; the DB, bcrypt, the code check, logging
// and the limiter store are mocked.

class RateLimitUnavailableError extends Error {
  constructor() {
    super("Distributed rate-limit storage is unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

let limiterDown: string | null = null;

mock.module("@/lib/rate-limit", {
  namedExports: {
    RateLimitUnavailableError,
    hashRateLimitIdentifier: (value: string) => `hash(${value})`,
    checkRateLimit: async (_identifier: string, options: { keyPrefix: string; max: number }) => {
      if (limiterDown && options.keyPrefix === `reset-password-${limiterDown}`) {
        throw new RateLimitUnavailableError();
      }
      return { allowed: true, remaining: options.max, resetAt: Date.now() };
    },
  },
});

let lookups = 0;
let lookupError: Error | null = null;

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: {
        findFirst: async () => {
          lookups++;
          if (lookupError) throw lookupError;
          return null;
        },
      },
    },
  },
});
mock.module("@/lib/encryption", {
  namedExports: {
    normalizeEmail: (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : ""),
  },
});
mock.module("@/lib/password-reset", {
  namedExports: { verifyPasswordResetCode: async () => ({ ok: false, message: "x" }) },
});
mock.module("@/lib/api-auth", {
  namedExports: { invalidateAuthCacheForUser: () => undefined },
});
mock.module("@/lib/log-activity", {
  namedExports: { logActivity: async () => undefined },
});
mock.module("bcryptjs", {
  defaultExport: { hash: async () => "hash", compare: async () => true },
});

let errors: string[] = [];
mock.method(console, "error", (...args: unknown[]) => errors.push(args.map(String).join(" ")));

let POST: (typeof import("../../src/app/api/auth/reset-password/route"))["POST"];
let apiHandler: (typeof import("../../src/lib/api-handler"))["apiHandler"];

before(async () => {
  ({ POST } = await import("../../src/app/api/auth/reset-password/route"));
  ({ apiHandler } = await import("../../src/lib/api-handler"));
});

beforeEach(() => {
  limiterDown = null;
  lookups = 0;
  lookupError = null;
  errors = [];
});

function resetRequest() {
  return new NextRequest("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email: "owner@office.jo", code: "123456", password: "Strong#Pass123" }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "x-real-ip": "203.0.113.9",
    },
  });
}

test("limiter store down: 503 like apiHandler, before any account lookup", async () => {
  const fromApiHandler = await apiHandler(async () => {
    throw new RateLimitUnavailableError();
  });
  const expected = await fromApiHandler.json();

  assert.equal(fromApiHandler.status, 503);
  assert.equal(expected.message, "خدمة الحماية غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.");

  for (const limiter of ["ip", "account"]) {
    limiterDown = limiter;
    errors = [];

    const res = await POST(resetRequest());

    assert.equal(res.status, 503, limiter);
    assert.deepEqual(await res.json(), expected, limiter);
    assert.deepEqual(errors, ["[API_RATE_LIMIT_UNAVAILABLE] Request blocked safely."], limiter);
  }

  assert.equal(lookups, 0);
});

test("other errors keep their 500", async () => {
  lookupError = new Error("database down");

  const res = await POST(resetRequest());

  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { success: false, message: "تعذر تغيير كلمة المرور" });
  assert.equal(lookups, 1);
});
