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

type AdminUser = { id: string; tenantId: string; role: "ADMIN"; email: string };
type AuthResult = { error: Response | null; user: AdminUser | null };
type BillingPlanRow = Record<string, unknown>;
type SubscriptionRow = Record<string, unknown> | null;

const ADMIN_USER: AdminUser = {
  id: "user-1",
  tenantId: "tenant-1",
  role: "ADMIN",
  email: "admin@office.test",
};

const requirePermissionMock = mock.fn<(...args: unknown[]) => Promise<AuthResult>>(
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
>(async () => ({ id: "checkout_123", url: "https://polar.sh/checkout/session_123" }));
const billingPlanFindManyMock = mock.fn<
  (...args: unknown[]) => Promise<BillingPlanRow[]>
>(async () => [billingPlanRow()]);
const subscriptionsListMock = mock.fn<
  (...args: unknown[]) => Promise<{ result: { items: Record<string, unknown>[] } }>
>(async () => ({ result: { items: [] } }));
// USD cents per plan, monthly and yearly (as BillingPlan and the Polar
// products hold them).
const PLAN_PRICES: Record<string, [number, number]> = {
  BASIC: [2900, 29000],
  PRO: [5900, 59000],
  BUSINESS: [11900, 119000],
};

/** A correct Polar product for an id like "pro_yearly". */
function polarProduct(id: string, overrides: Record<string, unknown> = {}) {
  const [plan, cycle] = id.split("_");
  const [monthly, yearly] = PLAN_PRICES[plan.toUpperCase()] ?? [0, 0];
  return {
    id,
    name: `Viresto - ${plan} ${cycle}`,
    isArchived: false,
    isRecurring: true,
    recurringInterval: cycle === "yearly" ? "year" : "month",
    recurringIntervalCount: 1,
    trialInterval: null,
    trialIntervalCount: null,
    prices: [
      {
        amountType: "fixed",
        priceAmount: cycle === "yearly" ? yearly : monthly,
        priceCurrency: "usd",
        isArchived: false,
      },
    ],
    ...overrides,
  };
}

const productsGetMock = mock.fn<
  (args: { id: string }) => Promise<Record<string, unknown>>
>(async ({ id }) => polarProduct(id));
const getPolarClientMock = mock.fn(() => ({
  subscriptions: { update: subscriptionsUpdateMock, list: subscriptionsListMock },
  checkouts: { create: checkoutsCreateMock },
  products: { get: productsGetMock },
}));
const getAppUrlMock = mock.fn(() => "https://app.test");
const syncSubscriptionFromPolarMock = mock.fn<
  (...args: unknown[]) => Promise<Record<string, unknown>>
>(async () => ({ id: "synced" }));

mock.module("@/lib/api-auth", {
  namedExports: { requirePermission: requirePermissionMock },
});
mock.module("@/lib/csrf", {
  namedExports: { verifySameOrigin: verifySameOriginMock },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      billingPlan: {
        findFirst: billingPlanFindFirstMock,
        findMany: billingPlanFindManyMock,
      },
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
  requirePermissionMock.mock.resetCalls();
  verifySameOriginMock.mock.resetCalls();
  billingPlanFindFirstMock.mock.resetCalls();
  subscriptionFindFirstMock.mock.resetCalls();
  subscriptionsUpdateMock.mock.resetCalls();
  checkoutsCreateMock.mock.resetCalls();
  getPolarClientMock.mock.resetCalls();
  getAppUrlMock.mock.resetCalls();
  syncSubscriptionFromPolarMock.mock.resetCalls();
  billingPlanFindManyMock.mock.resetCalls();
  subscriptionsListMock.mock.resetCalls();

  subscriptionsListMock.mock.mockImplementation(async () => ({ result: { items: [] } }));
  productsGetMock.mock.resetCalls();
  productsGetMock.mock.mockImplementation(async ({ id }) => polarProduct(id));
  syncSubscriptionFromPolarMock.mock.mockImplementation(async () => ({ id: "synced" }));

  requirePermissionMock.mock.mockImplementation(async () => ({
    error: null,
    user: ADMIN_USER,
  }));
  subscriptionFindFirstMock.mock.mockImplementation(async () => null);
  subscriptionsUpdateMock.mock.mockImplementation(async () => ({
    id: "polar-sub-updated",
  }));
  checkoutsCreateMock.mock.mockImplementation(async () => ({
    id: "checkout_123",
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
  const code = String(overrides.code ?? "BASIC");
  const [priceMonthly, priceYearly] = PLAN_PRICES[code] ?? [0, 0];
  return {
    id: "plan-row-1",
    code: "BASIC",
    isActive: true,
    priceMonthly,
    priceYearly,
    polarMonthlyProductId: "basic_monthly",
    polarYearlyProductId: "basic_yearly",
    ...overrides,
  };
}

test("checkout: rejects non-ADMIN callers with 403 and never touches billing/Polar", async () => {
  resetMocks();

  const forbidden = err("لا تملك صلاحية لتنفيذ هذا الإجراء.", 403);
  requirePermissionMock.mock.mockImplementation(async () => ({
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
  assert.equal(json.data.checkoutId, "checkout_123");
  assert.equal(subscriptionsUpdateMock.mock.callCount(), 0);
  assert.equal(checkoutsCreateMock.mock.callCount(), 1);
  assert.deepEqual(checkoutsCreateMock.mock.calls[0].arguments[0], {
    products: ["basic_monthly"],
    allowTrial: false,
    externalCustomerId: "tenant-1",
    customerEmail: "admin@office.test",
    embedOrigin: "https://app.test",
    successUrl:
      "https://app.test/dashboard/billing?checkout=success&checkout_id={CHECKOUT_ID}",
    metadata: { tenantId: "tenant-1", planCode: "BASIC", billingCycle: "monthly" },
  });
});

// findFirst that honours the route's `where.status.in`, like the database.
function statusAwareFindFirst(getRow: () => Record<string, unknown> | null) {
  return async (...args: unknown[]) => {
    const row = getRow();
    const allowed = (args[0] as { where?: { status?: { in?: string[] } } })?.where
      ?.status?.in;
    return row && (!allowed || allowed.includes(String(row.status))) ? row : null;
  };
}

function subscriptionRow(overrides: Record<string, unknown> = {}) {
  return {
    polarSubscriptionId: "sub-existing",
    status: "ACTIVE",
    interval: "MONTHLY",
    plan: {
      polarMonthlyProductId: "pro_monthly",
      polarYearlyProductId: "pro_yearly",
    },
    ...overrides,
  };
}

test("checkout: only ACTIVE, TRIALING and PAST_DUE count as a live subscription", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());

  await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));

  const where = (subscriptionFindFirstMock.mock.calls[0].arguments[0] as {
    where: { tenantId: string; status: { in: string[] } };
  }).where;
  assert.equal(where.tenantId, "tenant-1");
  assert.deepEqual(where.status.in, ["ACTIVE", "TRIALING", "PAST_DUE"]);
});

test("checkout: an existing but CANCELLED subscription is treated as no live subscription (checkout, not update)", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  subscriptionFindFirstMock.mock.mockImplementation(
    statusAwareFindFirst(() => subscriptionRow({ status: "CANCELLED" })),
  );

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  const json = await res.json();

  assert.equal(res.status, 200);
  assert.equal(json.data.mode, "checkout");
  assert.equal(subscriptionsListMock.mock.callCount(), 1, "Polar asked before opening a checkout");
  assert.equal(subscriptionsUpdateMock.mock.callCount(), 0);
  assert.equal(checkoutsCreateMock.mock.callCount(), 1);
});

test("checkout: PAST_DUE answers 409 with a portal action and never opens a checkout", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  subscriptionFindFirstMock.mock.mockImplementation(
    statusAwareFindFirst(() => subscriptionRow({ status: "PAST_DUE" })),
  );

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  const json = await res.json();

  assert.equal(res.status, 409);
  assert.deepEqual(json.details, {
    code: "PAYMENT_METHOD_UPDATE_REQUIRED",
    action: "portal",
  });
  assert.equal(subscriptionsUpdateMock.mock.callCount(), 0);
  assert.equal(checkoutsCreateMock.mock.callCount(), 0);
});

test("checkout: with nothing in our DB, Polar is asked for this office's live subscriptions of our products", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());

  await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));

  assert.deepEqual(subscriptionsListMock.mock.calls[0].arguments[0], {
    metadata: { tenantId: "tenant-1" },
    productId: ["basic_monthly", "basic_yearly"],
    status: ["active", "trialing", "past_due"],
    limit: 10,
  });
});

test("checkout: a live subscription found only in Polar is synced and changed in place, not re-bought", async () => {
  resetMocks();

  let stored: Record<string, unknown> | null = null;
  const polarLive = { id: "sub-in-polar", productId: "pro_monthly", status: "active" };

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  subscriptionFindFirstMock.mock.mockImplementation(statusAwareFindFirst(() => stored));
  subscriptionsListMock.mock.mockImplementation(async () => ({ result: { items: [polarLive] } }));
  syncSubscriptionFromPolarMock.mock.mockImplementation(async (subscription) => {
    if (subscription === polarLive) {
      stored = subscriptionRow({ polarSubscriptionId: "sub-in-polar" });
    }
    return { ok: true };
  });

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  const json = await res.json();

  assert.equal(res.status, 200);
  assert.equal(json.data.mode, "updated");
  assert.equal(syncSubscriptionFromPolarMock.mock.calls[0].arguments[0], polarLive);
  assert.equal(
    (subscriptionsUpdateMock.mock.calls[0].arguments[0] as { id: string }).id,
    "sub-in-polar",
  );
  assert.equal(checkoutsCreateMock.mock.callCount(), 0);
});

test("checkout: live in Polar but not attachable to this office answers 409, never a checkout", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  subscriptionsListMock.mock.mockImplementation(async () => ({
    result: { items: [{ id: "sub-conflict", productId: "basic_monthly", status: "active" }] },
  }));
  syncSubscriptionFromPolarMock.mock.mockImplementation(async () => ({
    ok: false,
    reason: "tenant_conflict",
  }));

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  const json = await res.json();

  assert.equal(res.status, 409);
  assert.equal(json.details.code, "SUBSCRIPTION_ALREADY_EXISTS");
  assert.equal(checkoutsCreateMock.mock.callCount(), 0);
});

test("checkout: Polar unreachable while checking fails closed with 503", async () => {
  resetMocks();

  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  subscriptionsListMock.mock.mockImplementation(async () => {
    throw new TypeError("fetch failed");
  });
  const warn = mock.method(console, "warn", () => undefined);

  try {
    const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));

    assert.equal(res.status, 503);
    assert.equal(checkoutsCreateMock.mock.callCount(), 0);
    assert.equal(
      String(warn.mock.calls[0].arguments[0]),
      "[polar-checkout] live_subscription_lookup_failed tenant=tenant-1 error=TypeError",
    );
  } finally {
    warn.mock.restore();
  }
});

// --- Product guard: the product must match the plan and cycle -------------

test("guard: a yearly product that recurs monthly is refused (503); no checkout, no plan change", async () => {
  // The sandbox case of 2026-11-13: "Yearly" products at the yearly price,
  // recurring every month.
  for (const current of [null, subscriptionRow({ status: "ACTIVE" })]) {
    resetMocks();
    billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
    subscriptionFindFirstMock.mock.mockImplementation(async () => current);
    productsGetMock.mock.mockImplementation(async ({ id }) =>
      polarProduct(id, { recurringInterval: "month" }),
    );

    const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "yearly" }));
    const json = await res.json();

    assert.equal(res.status, 503);
    assert.equal(json.details.code, "PLAN_PRODUCT_UNAVAILABLE");
    assert.equal(productsGetMock.mock.calls[0].arguments[0].id, "basic_yearly");
    assert.equal(checkoutsCreateMock.mock.callCount(), 0);
    assert.equal(subscriptionsUpdateMock.mock.callCount(), 0);
  }
});

test("guard: wrong price, an archived product, an interval count other than 1 or two prices are each refused", async () => {
  const broken: Record<string, unknown>[] = [
    { prices: [{ amountType: "fixed", priceAmount: 2500, priceCurrency: "usd", isArchived: false }] },
    { isArchived: true },
    { recurringIntervalCount: 3 },
    {
      prices: [
        { amountType: "fixed", priceAmount: 2900, priceCurrency: "usd", isArchived: false },
        { amountType: "fixed", priceAmount: 2900, priceCurrency: "eur", isArchived: false },
      ],
    },
  ];
  for (const overrides of broken) {
    resetMocks();
    billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
    productsGetMock.mock.mockImplementation(async ({ id }) => polarProduct(id, overrides));

    const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
    assert.equal(res.status, 503, JSON.stringify(overrides));
    assert.equal(checkoutsCreateMock.mock.callCount(), 0);
  }
});

test("guard: Polar unreachable while reading the product fails closed (503)", async () => {
  resetMocks();
  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  productsGetMock.mock.mockImplementation(async () => {
    throw new Error("network");
  });

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  assert.equal(res.status, 503);
  assert.equal(checkoutsCreateMock.mock.callCount(), 0);
});

test("guard: a correct yearly product (interval year, yearly price) opens the checkout", async () => {
  resetMocks();
  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "yearly" }));
  assert.equal(res.status, 200);
  assert.equal(checkoutsCreateMock.mock.callCount(), 1);
  assert.deepEqual(
    (checkoutsCreateMock.mock.calls[0].arguments[0] as { products: string[] }).products,
    ["basic_yearly"],
  );
});

test("guard: a trial on the product does not block the checkout (allowTrial: false disables it)", async () => {
  resetMocks();
  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  productsGetMock.mock.mockImplementation(async ({ id }) =>
    polarProduct(id, { trialInterval: "day", trialIntervalCount: 14 }),
  );

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  assert.equal(res.status, 200);
  assert.equal(
    (checkoutsCreateMock.mock.calls[0].arguments[0] as { allowTrial: boolean }).allowTrial,
    false,
  );
});

// --- Prefilled email ------------------------------------------------------

test("email: Polar rejecting the prefilled email does not block the purchase; the checkout opens without it", async () => {
  resetMocks();
  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  checkoutsCreateMock.mock.mockImplementation(async (...args: unknown[]) => {
    const payload = args[0] as { customerEmail: string | null };
    if (payload.customerEmail) {
      const error = new Error('API error occurred: {"detail":[{"loc":["body","customer_email"],"msg":"value is not a valid email address"}]}') as Error & { statusCode: number };
      error.statusCode = 422;
      throw error;
    }
    return { id: "checkout_456", url: "https://polar.sh/checkout/session_456" };
  });

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.equal(json.data.checkoutId, "checkout_456");
  assert.equal(checkoutsCreateMock.mock.callCount(), 2);
  assert.equal((checkoutsCreateMock.mock.calls[0].arguments[0] as { customerEmail: string }).customerEmail, "admin@office.test");
  assert.equal((checkoutsCreateMock.mock.calls[1].arguments[0] as { customerEmail: null }).customerEmail, null);
});

test("email: any other Polar error is not retried", async () => {
  resetMocks();
  billingPlanFindFirstMock.mock.mockImplementation(async () => billingPlanRow());
  checkoutsCreateMock.mock.mockImplementation(async () => {
    const error = new Error('API error occurred: {"detail":[{"loc":["body","products"]}]}') as Error & { statusCode: number };
    error.statusCode = 422;
    throw error;
  });

  const res = await POST(makeRequest({ planId: "BASIC", billingCycle: "monthly" }));
  assert.equal(res.status, 500);
  assert.equal(checkoutsCreateMock.mock.callCount(), 1);
});
