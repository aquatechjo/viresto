import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Runs the real POST handler from src/app/api/auth/register/route.ts with
// its I/O (prisma, rate limit, Turnstile, email, verification codes, CSRF)
// mocked, and asserts that signup creates an explicit in-app trial rather
// than a paid PRO subscription.

process.env.PUBLIC_REGISTER_ENABLED = "true";

const DAY = 24 * 60 * 60 * 1000;

const tenantCreateMock = mock.fn(async (args: { data: Record<string, unknown> }) => ({
  id: "tenant-new",
  ...args.data,
  users: [{ id: "user-new", email: "owner@example.com" }],
}));
const subscriptionCreateMock = mock.fn(async (args: { data: Record<string, unknown> }) => ({
  id: "sub-new",
  ...args.data,
}));

const tx = {
  tenant: { create: tenantCreateMock },
  subscription: { create: subscriptionCreateMock },
};

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: {
        findFirst: async () => null,
        findUnique: async () => null,
      },
      tenant: { findUnique: async () => null },
      billingPlan: {
        findUnique: async () => ({ id: "plan-pro", code: "PRO", name: "Pro" }),
      },
      $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx),
    },
  },
});
mock.module("@/lib/rate-limit", {
  namedExports: { checkRateLimit: async () => ({ allowed: true }) },
});
mock.module("@/lib/turnstile", {
  namedExports: {
    getClientIp: () => "127.0.0.1",
    verifyTurnstileToken: async () => ({ success: true }),
  },
});
mock.module("@/lib/verification", {
  namedExports: { createVerificationCode: async () => "123456" },
});
mock.module("@/lib/email", {
  namedExports: { sendVerificationEmail: async () => undefined },
});
mock.module("@/lib/csrf", {
  namedExports: { verifySameOrigin: () => null },
});

let POST: (typeof import("../../src/app/api/auth/register/route"))["POST"];

before(async () => {
  ({ POST } = await import("../../src/app/api/auth/register/route"));
});

test("signup creates a 14-day in-app trial (TRIALING, no Polar id, amount 0, USD)", async () => {
  const before = Date.now();

  const res = await POST(
    new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantName: "Test Office",
        name: "Owner Name",
        email: "owner@example.com",
        phone: "0791234567",
        password: "Str0ng!Passw0rd#",
        acceptTerms: true,
        acceptPrivacy: true,
        turnstileToken: "ok",
      }),
    }),
  );

  const json = await res.json();
  assert.equal(res.status, 201, JSON.stringify(json));
  assert.equal(json.data.trial.days, 14);

  const tenantData = tenantCreateMock.mock.calls[0].arguments[0].data;
  assert.equal(tenantData.status, "TRIAL");

  assert.equal(subscriptionCreateMock.mock.callCount(), 1);
  const sub = subscriptionCreateMock.mock.calls[0].arguments[0].data as {
    status: string;
    amount: number;
    currency: string;
    planId: string;
    polarSubscriptionId?: string;
    trialStartsAt: Date;
    trialEndsAt: Date;
    currentPeriodEnd: Date;
  };

  assert.equal(sub.status, "TRIALING");
  assert.equal(sub.planId, "plan-pro");
  assert.equal(sub.amount, 0);
  assert.equal(sub.currency, "USD");
  assert.equal(sub.polarSubscriptionId, undefined);
  assert.ok(sub.trialStartsAt.getTime() >= before);
  assert.equal(sub.trialEndsAt.getTime() - sub.trialStartsAt.getTime(), 14 * DAY);
  assert.equal(sub.currentPeriodEnd.getTime(), sub.trialEndsAt.getTime());
});
