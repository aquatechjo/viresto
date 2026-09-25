import { test, before, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { err } from "@/lib/api-response";

// This suite exercises the real POST handler from
// src/app/api/billing/checkout/route.ts with its dependencies
// (auth, CSRF, prisma, Polar client, sync helper) mocked via node:test's
// native `mock.module()` (requires --experimental-test-module-mocks).
// The route's own logic — plan resolution, the active-subscription
// upgrade/downgrade branch, and the checkout-vs-update decision — runs
// unmocked.

type AdminUser = { id: string; tenantId: string; role: "ADMIN" };
type AuthResult = { error: Response | null; user: AdminUser | null };
type BillingPlanRow = Record<string, unknown>;
type SubscriptionRow = Record<string, unknown> | null;

const ADMIN_USER: AdminUser = {
  id: "user-1",
  tenantId: "tenant-1",
  role: "ADMIN",
};

const requireRoleMock = mock.fn<(...args: unknown[]) => Promise<AuthResult>>(
  async () => ({ error: null, user: ADMIN_USER }),
);
const verifySameOriginMock = mock.fn<(...args: unknown[]) => null>(() => null);
const billingPlanFindFirstMock = mock.fn<
  (...args: unknown[]) => Promise<BillingPlanRow | null>
>(async () => null);
const subscriptionFindFirstMock = mock.fn<
  (...args: unknown[]) => Promise<SubscriptionRow>
>(async () => null);
const subscriptionsUpdateMock = mock.fn<
  (...args: unknown[]) => Promise<Record<string, unknown>>
>(async () => ({ id: "polar-sub-updated" }));
const checkoutsCreateMock = mock.fn<
  (...args: unknown[]) => Promise<Record<string, unknown>>
>(async () => ({ url: "https://polar.sh/checkout/session_123" }));
const getPolarClientMock = mock.fn(() => ({
  subscriptions: { update: subscriptionsUpdateMock },
  checkouts: { create: checkoutsCreateMock },
}));
const getAppUrlMock = mock.fn(() => "https://app.test");
const syncSubscriptionFromPolarMock = mock.fn<
  (...args: unknown[]) => Promise<Record<string, unknown>>
>(async () => ({ id: "synced" }));

mock.module("@/lib/api-auth", {
  namedExports: { requireRole: requireRoleMock },
});
mock.module("@/lib/csrf", {
  namedExports: { verifySameOrigin: verifySameOriginMock },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      billingPlan: { findFirst: billingPlanFindFirstMock },
      subscription: { findFirst: subscriptionFindFirstMock },
    },
  },
});
mock.module("@/lib/polar", {
  namedExports: { getPolarClient: getPolarClientMock, getAppUrl: getAppUrlMock },
});
mock.module("@/lib/polar-subscription-sync", {
  namedExports: { syncSubscriptionFromPolar: syncSubscriptionFromPolarMock },
});

let POST: (typeof import("../../src/app/api/billing/checkout/route"))["POST"];

before(async () => {
  ({ POST } = await import("../../src/app/api/billing/checkout/route"));
});

function resetMocks() {
  requireRoleMock.mock.resetCalls();
  verifySameOriginMock.mock.resetCalls();
  billingPlanFindFirstMock.mock.resetCalls();
  subscriptionFindFirstMock.mock.resetCalls();
  subscriptionsUpdateMock.mock.resetCalls();
  checkoutsCreateMock.mock.resetCalls();
  getPolarClientMock.mock.resetCalls();
  getAppUrlMock.mock.resetCalls();
  syncSubscriptionFromPolarMock.mock.resetCalls();

  requireRoleMock.mock.mockImplementation(async () => ({
    error: null,
    user: ADMIN_USER,
  }));
  subscriptionFindFirstMock.mock.mockImplementation(async () => null);
  subscriptionsUpdateMock.mock.mockImplementation(async () => ({
    id: "polar-sub-updated",
  }));
  checkoutsCreateMock.mock.mockImplementation(async () => ({
    url: "https://polar.sh/checkout/session_123",
  }));
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function billingPlanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-row-1",
    code: "BASIC",
    isActive: true,
    polarMonthlyProductId: "basic_monthly",
    polarYearlyProductId: "basic_yearly",
    ...overrides,
  };
}

test("checkout: rejects non-ADMIN callers with 403 and never touches billing/Polar", async () => {
  resetMocks();

  const forbidden = err("لا تملك صلاحية لتنفيذ هذا الإجراء.", 403);
  requireRoleMock.mock.mockImplementation(async () => ({
    error: forbidden,
    user: null,
  }));

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));

  assert.equal(res.status, 403);
  assert.equal(billingPlanFindFirstMock.mock.callCount(), 0);
  assert.equal(getPolarClientMock.mock.callCount(), 0);
});

test("checkout: rejects when the requested cycle has no Polar product configured", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () =>
    billingPlanRow({ polarMonthlyProductId: null }),
  );

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  const json = await res.json();

  assert.equal(res.status, 400);
  assert.equal(json.message, "لم يتم إعداد الدفع لهذه الخطة بعد");
  assert.equal(subscriptionFindFirstMock.mock.callCount(), 0);
  assert.equal(getPolarClientMock.mock.callCount(), 0);
});

test("checkout: rejects only when plan AND billing cycle both already match the active subscription", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  subscriptionFindFirstMock.mock.mockImplementation(async () => ({
    polarSubscriptionId: "sub-existing",
    status: "ACTIVE",
    interval: "MONTHLY",
    plan: {
      polarMonthlyProductId: "basic_monthly",
      polarYearlyProductId: "basic_yearly",
    },
  }));

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  const json = await res.json();

  assert.equal(res.status, 400);
  assert.equal(json.message, "أنت مشترك بهذه الخطة بالفعل");
  assert.equal(subscriptionsUpdateMock.mock.callCount(), 0);
  assert.equal(checkoutsCreateMock.mock.callCount(), 0);
});

test("checkout: PRO Monthly -> PRO Yearly is NOT rejected as a duplicate (regression for the planId-only bug)", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () =>
    billingPlanRow({
      code: "PRO",
      polarMonthlyProductId: "pro_monthly",
      polarYearlyProductId: "pro_yearly",
    }),
  );
  subscriptionFindFirstMock.mock.mockImplementation(async () => ({
    polarSubscriptionId: "sub-pro-monthly",
    status: "ACTIVE",
    interval: "MONTHLY",
    plan: {
      polarMonthlyProductId: "pro_monthly",
      polarYearlyProductId: "pro_yearly",
    },
  }));

  const res = await POST(makeRequest({ planId: "PRO", billingCycle: "yearly" }));
  const json = await res.json();

  assert.equal(res.status, 200);
  assert.equal(json.data.mode, "updated");
  assert.equal(checkoutsCreateMock.mock.callCount(), 0);
  assert.equal(subscriptionsUpdateMock.mock.callCount(), 1);
  assert.deepEqual(subscriptionsUpdateMock.mock.calls[0].arguments[0], {
    id: "sub-pro-monthly",
    subscriptionUpdate: {
      productId: "pro_yearly",
      prorationBehavior: "prorate",
    },
  });
  assert.equal(syncSubscriptionFromPolarMock.mock.callCount(), 1);
  assert.deepEqual(syncSubscriptionFromPolarMock.mock.calls[0].arguments[0], {
    id: "polar-sub-updated",
  });
});

test("checkout: active subscription on a different plan calls subscriptions.update, not checkouts.create", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () =>
    billingPlanRow({
      code: "BUSINESS",
      polarMonthlyProductId: "business_monthly",
      polarYearlyProductId: "business_yearly",
    }),
  );
  subscriptionFindFirstMock.mock.mockImplementation(async () => ({
    polarSubscriptionId: "sub-pro-monthly",
    status: "TRIALING",
    interval: "MONTHLY",
    plan: {
      polarMonthlyProductId: "pro_monthly",
      polarYearlyProductId: "pro_yearly",
    },
  }));

  const res = await POST(makeRequest({ planId: "BUSINESS", billingCycle: "monthly" }));
  const json = await res.json();

  assert.equal(res.status, 200);
  assert.equal(json.data.mode, "updated");
  assert.equal(checkoutsCreateMock.mock.callCount(), 0);
  assert.equal(subscriptionsUpdateMock.mock.callCount(), 1);
  const updateArgs = subscriptionsUpdateMock.mock.calls[0].arguments[0] as {
    subscriptionUpdate: { productId: string };
  };
  assert.equal(updateArgs.subscriptionUpdate.productId, "business_monthly");
});

test("checkout: no Polar-linked subscription creates a new checkout session with the right payload", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  subscriptionFindFirstMock.mock.mockImplementation(async () => null);

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  const json = await res.json();

  assert.equal(res.status, 200);
  assert.equal(json.data.mode, "checkout");
  assert.equal(json.data.url, "https://polar.sh/checkout/session_123");
  assert.equal(subscriptionsUpdateMock.mock.callCount(), 0);
  assert.equal(checkoutsCreateMock.mock.callCount(), 1);
  assert.deepEqual(checkoutsCreateMock.mock.calls[0].arguments[0], {
    products: ["basic_monthly"],
    allowTrial: false,
    externalCustomerId: "tenant-1",
    successUrl: "https://app.test/dashboard/billing?checkout=success",
    metadata: { tenantId: "tenant-1", planCode: "BASIC", billingCycle: "monthly" },
  });
});

test("checkout: an existing but CANCELLED subscription is treated as no active subscription (checkout, not update)", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  subscriptionFindFirstMock.mock.mockImplementation(async () => ({
    polarSubscriptionId: "sub-old-cancelled",
    status: "CANCELLED",
    interval: "MONTHLY",
    plan: {
      polarMonthlyProductId: "basic_monthly",
      polarYearlyProductId: "basic_yearly",
    },
  }));

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  const json = await res.json();

  assert.equal(res.status, 200);
  assert.equal(json.data.mode, "checkout");
  assert.equal(subscriptionsUpdateMock.mock.callCount(), 0);
  assert.equal(checkoutsCreateMock.mock.callCount(), 1);
});
