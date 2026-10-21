import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { EmailDeliveryError } from "../../src/lib/email/errors";

// forgot-password answers the same way whether or not an account exists,
// so each request leaves one [EMAIL_SEND] line saying what really happened,
// with no personal data. A rate-limited request gets a wait time instead of
// a vague error. The account lookup and the send run after the response.
// The real route runs; the DB, the code store, the email sender, after()
// and the limiter store are mocked.

const RESET_IN_MS = 14 * 60 * 1000;
const counters = new Map<string, number>();

mock.module("@/lib/rate-limit", {
  namedExports: {
    hashRateLimitIdentifier: (value: string) => `hash(${value})`,
    checkRateLimit: async (identifier: string, options: { keyPrefix: string; max: number }) => {
      const key = `${options.keyPrefix}:${identifier}`;
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      return {
        allowed: count <= options.max,
        remaining: Math.max(0, options.max - count),
        resetAt: Date.now() + RESET_IN_MS,
      };
    },
  },
});

const users = new Map<string, { id: string; email: string; isActive: boolean }>();
let lookups = 0;

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: {
        findFirst: async ({ where }: { where: { email: string } }) => {
          lookups++;
          return users.get(where.email) ?? null;
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
  namedExports: { createPasswordResetCode: async () => "123456" },
});

let sendImpl: () => Promise<unknown> = async () => ({ id: "re_msg_1" });
let sendCalls = 0;

mock.module("@/lib/email", {
  namedExports: {
    sendPasswordResetEmail: async () => {
      sendCalls++;
      return sendImpl();
    },
  },
});

// after(): tasks wait here until a test flushes them, as on Vercel where
// they run once the response is sent.
let afterTasks: (() => Promise<void>)[] = [];

mock.module("@/lib/after-response", {
  namedExports: {
    runAfterResponse: async (task: () => Promise<void>) => {
      afterTasks.push(task);
    },
  },
});

async function flushAfter() {
  const tasks = afterTasks;
  afterTasks = [];
  for (const task of tasks) await task();
}

let POST: (typeof import("../../src/app/api/auth/forgot-password/route"))["POST"];
let retryAfter: typeof import("../../src/lib/retry-after");

before(async () => {
  ({ POST } = await import("../../src/app/api/auth/forgot-password/route"));
  retryAfter = await import("../../src/lib/retry-after");
});

const IP = "203.0.113.9";
let logs: { level: "info" | "error"; line: string }[] = [];

beforeEach(() => {
  counters.clear();
  users.clear();
  users.set("owner@office.jo", { id: "user-1", email: "owner@office.jo", isActive: true });
  users.set("left@office.jo", { id: "user-2", email: "left@office.jo", isActive: false });
  sendImpl = async () => ({ id: "re_msg_1" });
  sendCalls = 0;
  lookups = 0;
  afterTasks = [];
  logs = [];
});

// Not restored between tests: mock.restoreAll() would also undo the module
// mocks above.
mock.method(console, "info", (...args: unknown[]) => logs.push({ level: "info", line: args.join(" ") }));
mock.method(console, "error", (...args: unknown[]) => logs.push({ level: "error", line: args.join(" ") }));

function forgotRequest(email: string, ip = IP) {
  return new NextRequest("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "x-real-ip": ip,
    },
  });
}

// One request, then whatever it left for after the response.
async function forgot(email: string, ip = IP) {
  const res = await POST(forgotRequest(email, ip));
  await flushAfter();
  return res;
}

function emailLogs() {
  return logs.filter((entry) => entry.line.startsWith("[EMAIL_SEND]"));
}

function assertNoPersonalData() {
  for (const { line } of logs) {
    assert.ok(!line.includes("@"), `no address in: ${line}`);
    assert.ok(!line.includes(IP), `no IP in: ${line}`);
    assert.ok(!line.includes("123456"), `no code in: ${line}`);
    assert.ok(!line.includes("user-"), `no user id in: ${line}`);
  }
}

test("a sent code logs outcome=sent with Resend's message id", async () => {
  const res = await forgot("owner@office.jo");

  assert.equal(res.status, 200);
  assert.equal(sendCalls, 1);
  assert.deepEqual(emailLogs(), [
    { level: "info", line: "[EMAIL_SEND] flow=forgot-password outcome=sent message_id=re_msg_1" },
  ]);
  assertNoPersonalData();
});

test("the answer is sent before the account lookup and the email, the same for every address", async () => {
  const bodies = [];

  for (const email of ["owner@office.jo", "nobody@office.jo", "left@office.jo"]) {
    const res = await POST(forgotRequest(email));
    assert.equal(res.status, 200);
    bodies.push(await res.json());
  }

  assert.equal(lookups, 0, "no lookup before the response");
  assert.equal(sendCalls, 0, "no send before the response");
  assert.deepEqual(bodies[1], bodies[0]);
  assert.deepEqual(bodies[2], bodies[0]);

  await flushAfter();

  assert.equal(lookups, 3);
  assert.equal(sendCalls, 1);
});

test("no account and an inactive account log no_active_user and answer exactly like a sent code", async () => {
  const sent = await (await forgot("owner@office.jo")).json();
  const unknown = await forgot("nobody@office.jo");
  const inactive = await forgot("left@office.jo");

  assert.equal(unknown.status, 200);
  assert.equal(inactive.status, 200);
  assert.deepEqual(await unknown.json(), sent);
  assert.deepEqual(await inactive.json(), sent);
  assert.equal(sendCalls, 1);
  assert.deepEqual(
    emailLogs().slice(1).map((entry) => entry.line),
    [
      "[EMAIL_SEND] flow=forgot-password outcome=no_active_user",
      "[EMAIL_SEND] flow=forgot-password outcome=no_active_user",
    ],
  );
  assertNoPersonalData();
});

test("a failed send logs the error type to console.error, not Resend's body, and still answers the same", async () => {
  sendImpl = async () => {
    throw new EmailDeliveryError('Failed to send password reset email: 422 {"message":"bad to owner@office.jo"}', 422);
  };

  const res = await forgot("owner@office.jo");
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(emailLogs(), [
    { level: "error", line: "[EMAIL_SEND] flow=forgot-password outcome=error error=EmailDeliveryError status=422" },
  ]);
  assertNoPersonalData();
});

test("an unexpected error logs its type", async () => {
  sendImpl = async () => {
    throw new TypeError("fetch failed");
  };

  await forgot("owner@office.jo");

  assert.deepEqual(emailLogs(), [
    { level: "error", line: "[EMAIL_SEND] flow=forgot-password outcome=error error=TypeError" },
  ]);
});

test("the 4th request for one address in the window is refused with a wait time", async () => {
  for (let i = 0; i < 3; i++) {
    assert.equal((await forgot("owner@office.jo")).status, 200, `request ${i + 1}`);
  }

  const res = await forgot("owner@office.jo");
  const body = await res.json();
  const seconds = RESET_IN_MS / 1000;

  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), String(seconds));
  assert.equal(body.success, false);
  assert.equal(body.code, "RATE_LIMITED");
  assert.equal(body.retryAfterSeconds, seconds);
  assert.equal(body.message, "طلبت عدة رموز خلال وقت قصير. انتظر حوالي 14 دقيقة ثم حاول مرة أخرى.");
  assert.equal(sendCalls, 3);
  assert.equal(
    emailLogs().at(-1)?.line,
    `[EMAIL_SEND] flow=forgot-password outcome=rate_limited limiter=account retry_after_s=${seconds}`,
  );
  assertNoPersonalData();
});

test("the rate-limit answer is the same for an address with no account", async () => {
  for (let i = 0; i < 3; i++) await forgot("owner@office.jo", "198.51.100.1");
  for (let i = 0; i < 3; i++) await forgot("nobody@office.jo", "198.51.100.2");

  const withAccount = await forgot("owner@office.jo", "198.51.100.1");
  const withoutAccount = await forgot("nobody@office.jo", "198.51.100.2");

  assert.equal(withAccount.status, 429);
  assert.equal(withoutAccount.status, 429);
  assert.deepEqual(await withoutAccount.json(), await withAccount.json());
});

test("the per-IP limit (10) logs limiter=ip", async () => {
  for (let i = 0; i < 10; i++) {
    assert.equal((await forgot(`u${i}@office.jo`)).status, 200);
  }

  const res = await forgot("u10@office.jo");

  assert.equal(res.status, 429);
  assert.match(emailLogs().at(-1)?.line ?? "", /outcome=rate_limited limiter=ip /);
});

test("the wait is worded in whole minutes, with Arabic counting", () => {
  const { codeRateLimitMessage } = retryAfter;

  assert.match(codeRateLimitMessage(30), /انتظر حوالي دقيقة ثم/);
  assert.match(codeRateLimitMessage(61), /انتظر حوالي دقيقتين ثم/);
  assert.match(codeRateLimitMessage(5 * 60), /انتظر حوالي 5 دقائق ثم/);
  assert.match(codeRateLimitMessage(15 * 60), /انتظر حوالي 15 دقيقة ثم/);
  assert.equal(
    codeRateLimitMessage(90, "en"),
    "You requested several codes in a short time. Wait about 2 minutes and try again.",
  );
  assert.match(codeRateLimitMessage(20, "en"), /about 1 minute and/);
});

test("retryAfterSeconds is read only from a 429 with a positive number", () => {
  const { readRetryAfterSeconds, retryAfterSeconds } = retryAfter;

  assert.equal(readRetryAfterSeconds(429, { retryAfterSeconds: 120 }), 120);
  assert.equal(readRetryAfterSeconds(429, { retryAfterSeconds: 0.2 }), 1);
  assert.equal(readRetryAfterSeconds(200, { retryAfterSeconds: 120 }), null);
  assert.equal(readRetryAfterSeconds(429, { message: "x" }), null);
  assert.equal(readRetryAfterSeconds(429, null), null);
  assert.equal(readRetryAfterSeconds(429, { retryAfterSeconds: "120" }), null);

  assert.equal(retryAfterSeconds(10_500, 10_000), 1);
  assert.equal(retryAfterSeconds(5_000, 10_000), 1);
  assert.equal(retryAfterSeconds(70_000, 10_000), 60);
});
