import { test, before, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// Exercises src/lib/rate-limit.ts with @upstash/ratelimit and @upstash/redis
// mocked (node:test mock.module, --experimental-test-module-mocks). Proves an
// Upstash timeout — which @upstash/ratelimit reports as success: true with
// reason "timeout" — is treated exactly like a failed request: fail closed in
// production, in-memory fallback elsewhere.

type LimitResponse = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  reason?: "timeout" | "cacheBlock" | "denyList";
  pending: Promise<unknown>;
};

const limitMock = mock.fn<(identifier: string) => Promise<LimitResponse>>(
  async () => ({
    success: true,
    limit: 5,
    remaining: 4,
    reset: Date.now() + 60_000,
    pending: Promise.resolve(),
  }),
);

const constructedConfigs: Array<Record<string, unknown>> = [];

class FakeRatelimit {
  static slidingWindow(tokens: number, window: string) {
    return { kind: "slidingWindow", tokens, window };
  }

  constructor(config: Record<string, unknown>) {
    constructedConfigs.push(config);
  }

  limit(identifier: string) {
    return limitMock(identifier);
  }
}

mock.module("@upstash/ratelimit", {
  namedExports: { Ratelimit: FakeRatelimit },
});

mock.module("@upstash/redis", {
  namedExports: { Redis: { fromEnv: () => ({ fake: true }) } },
});

// The module builds its Redis client at import time from these.
process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.invalid";
process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

let rateLimit: typeof import("../../src/lib/rate-limit");

before(async () => {
  rateLimit = await import("../../src/lib/rate-limit");
});

const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;
let errorLog: ReturnType<typeof mock.method>;
let warnLog: ReturnType<typeof mock.method>;

beforeEach(() => {
  limitMock.mock.resetCalls();
  errorLog = mock.method(console, "error", () => {});
  warnLog = mock.method(console, "warn", () => {});
});

afterEach(() => {
  env.NODE_ENV = originalNodeEnv;
  errorLog.mock.restore();
  warnLog.mock.restore();
});

function timeoutOnce() {
  limitMock.mock.mockImplementationOnce(async () => ({
    success: true,
    limit: 5,
    remaining: 5,
    reset: 0,
    reason: "timeout",
    pending: Promise.resolve(),
  }));
}

let uniqueKey = 0;
const nextKey = () => `timeout-test-${(uniqueKey += 1)}`;

test("limiter is built with an explicit short timeout and without analytics", async () => {
  env.NODE_ENV = "test";
  await rateLimit.checkRateLimit(nextKey(), { keyPrefix: "cfg-check", max: 3 });

  const config = constructedConfigs.find((c) => c.prefix === "cfg-check");
  assert.ok(config, "limiter constructed");
  assert.equal(config.timeout, rateLimit.RATE_LIMIT_TIMEOUT_MS);
  assert.equal(rateLimit.RATE_LIMIT_TIMEOUT_MS, 2_000);
  assert.equal(config.analytics, false);
});

test("in production a timeout fails closed and is logged", async () => {
  env.NODE_ENV = "production";
  timeoutOnce();

  await assert.rejects(
    rateLimit.checkRateLimit(nextKey(), { keyPrefix: "login" }),
    (error: Error) => error instanceof rateLimit.RateLimitUnavailableError,
  );

  const logged = errorLog.mock.calls.map((call) => String(call.arguments[0]));
  assert.ok(
    logged.some((line) => line.includes("[RATE_LIMIT_UNAVAILABLE] reason=timeout prefix=login")),
    `expected a timeout log line, got: ${JSON.stringify(logged)}`,
  );
});

test("every production timeout is logged, not just the first", async () => {
  env.NODE_ENV = "production";

  for (let i = 0; i < 2; i += 1) {
    timeoutOnce();
    await assert.rejects(rateLimit.checkRateLimit(nextKey(), { keyPrefix: "login" }));
  }

  const timeoutLines = errorLog.mock.calls.filter((call) =>
    String(call.arguments[0]).includes("reason=timeout"),
  );
  assert.equal(timeoutLines.length, 2);
});

test("outside production a timeout falls back to the in-memory limiter", async () => {
  env.NODE_ENV = "development";
  const key = nextKey();

  // max 1: the in-memory store must enforce it, which proves the fallback ran
  // (the timed-out Upstash response alone would have said success: true).
  timeoutOnce();
  const first = await rateLimit.checkRateLimit(key, { keyPrefix: "dev-fallback", max: 1 });
  timeoutOnce();
  const second = await rateLimit.checkRateLimit(key, { keyPrefix: "dev-fallback", max: 1 });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
});

test("a thrown Upstash error still fails closed in production", async () => {
  env.NODE_ENV = "production";
  limitMock.mock.mockImplementationOnce(async () => {
    throw new TypeError("fetch failed");
  });

  await assert.rejects(
    rateLimit.checkRateLimit(nextKey(), { keyPrefix: "login-account" }),
    (error: Error) => error instanceof rateLimit.RateLimitUnavailableError,
  );

  const logged = errorLog.mock.calls.map((call) => String(call.arguments[0]));
  assert.ok(
    logged.some((line) => line.includes("reason=error prefix=login-account detail=TypeError")),
    JSON.stringify(logged),
  );
});

test("a normal Upstash answer is passed through unchanged", async () => {
  env.NODE_ENV = "production";
  limitMock.mock.mockImplementationOnce(async () => ({
    success: false,
    limit: 5,
    remaining: 0,
    reset: 123,
    pending: Promise.resolve(),
  }));

  const result = await rateLimit.checkRateLimit(nextKey(), { keyPrefix: "login" });

  assert.deepEqual(result, { allowed: false, remaining: 0, resetAt: 123 });
});
