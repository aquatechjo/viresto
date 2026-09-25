import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Exercises the real syncSubscriptionFromPolar / resolvePolarTenant from
// src/lib/polar-subscription-sync.ts together with the real tenant-access
// resolver and subscription-consistency mirror. Only prisma, the tenant
// lock, and the auth-cache invalidation are mocked.

const DAY = 24 * 60 * 60 * 1000;

const PRO_PLAN = {
  id: "plan-pro",
  code: "PRO",
  name: "Pro",
  currency: "USD",
  polarMonthlyProductId: "prod_pro_monthly",
  polarYearlyProductId: "prod_pro_yearly",
};

type Row = Record<string, unknown>;

let knownTenants = new Set<string>();
let existingRow: Row | null = null;
let tenantSubscriptions: Row[] = [];

const billingPlanFindFirst = mock.fn(async (args: { where: { OR: Row[] } }) => {
  const productId = (args.where.OR[0] as { polarMonthlyProductId: string })
    .polarMonthlyProductId;
  return productId === PRO_PLAN.polarMonthlyProductId ||
    productId === PRO_PLAN.polarYearlyProductId
    ? PRO_PLAN
    : null;
});
const subscriptionFindUnique = mock.fn(async () => existingRow);
const tenantFindUnique = mock.fn(async (args: { where: { id: string } }) =>
  knownTenants.has(args.where.id) ? { id: args.where.id } : null,
);
const subscriptionUpsert = mock.fn(
  async (args: { create: Row; update: Row }) => {
    const base = existingRow ?? args.create;
    return {
      id: "local-sub",
      trialStartsAt: null,
      createdAt: new Date(),
      ...base,
      ...(existingRow ? args.update : {}),
    };
  },
);
const subscriptionFindMany = mock.fn(async () => tenantSubscriptions);
const subscriptionUpdateMany = mock.fn(async () => ({ count: 0 }));
const tenantUpdate = mock.fn(async (args: Row) => ({ id: "t", ...args }));
const activityCreate = mock.fn(async () => ({}));
const invalidateAuthCacheForTenant = mock.fn();

const tx = {
  tenant: { findUnique: tenantFindUnique, update: tenantUpdate },
  subscription: {
    upsert: subscriptionUpsert,
    findMany: subscriptionFindMany,
    updateMany: subscriptionUpdateMany,
  },
  activity: { create: activityCreate },
};

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      billingPlan: { findFirst: billingPlanFindFirst },
      subscription: { findUnique: subscriptionFindUnique },
      $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx),
    },
  },
});
mock.module("@/lib/tenant-mutation-lock", {
  namedExports: { lockTenantMutation: async () => undefined },
});
mock.module("@/lib/api-auth", {
  namedExports: { invalidateAuthCacheForTenant },
});

let sync: (typeof import("../../src/lib/polar-subscription-sync"))["syncSubscriptionFromPolar"];
let resolvePolarTenant: (typeof import("../../src/lib/polar-subscription-sync"))["resolvePolarTenant"];

before(async () => {
  ({ syncSubscriptionFromPolar: sync, resolvePolarTenant } = await import(
    "../../src/lib/polar-subscription-sync"
  ));
});

beforeEach(() => {
  knownTenants = new Set(["tenant-meta", "tenant-external", "tenant-owner"]);
  existingRow = null;
  tenantSubscriptions = [];
  for (const fn of [
    billingPlanFindFirst,
    subscriptionFindUnique,
    tenantFindUnique,
    subscriptionUpsert,
    subscriptionFindMany,
    subscriptionUpdateMany,
    tenantUpdate,
    activityCreate,
    invalidateAuthCacheForTenant,
  ]) {
    fn.mock.resetCalls();
  }
});

function polarSubscription(overrides: Row = {}) {
  return {
    id: "polar_sub_1",
    productId: PRO_PLAN.polarMonthlyProductId,
    status: "active",
    currency: "usd",
    amount: 5900,
    trialEnd: null,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * DAY),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    customerId: "polar_cust_1",
    metadata: { tenantId: "tenant-meta" },
    customer: { externalId: "tenant-meta" },
    ...overrides,
  } as unknown as Parameters<typeof sync>[0];
}

function upsertedTenantId() {
  return subscriptionUpsert.mock.calls[0].arguments[0].create.tenantId;
}

test("tenant mismatch: metadata.tenantId wins over a conflicting customer.external_id", async () => {
  const warn = mock.method(console, "warn", () => undefined);

  const result = await sync(
    polarSubscription({ customer: { externalId: "tenant-external" } }),
  );

  assert.equal(result.ok, true);
  assert.equal(upsertedTenantId(), "tenant-meta");
  // The external_id office is never looked up, let alone activated.
  assert.deepEqual(
    tenantFindUnique.mock.calls.map((call) => call.arguments[0].where.id),
    ["tenant-meta"],
  );
  assert.ok(
    tenantUpdate.mock.calls.every(
      (call) => (call.arguments[0] as { where: { id: string } }).where.id === "tenant-meta",
    ),
  );
  assert.match(
    String(warn.mock.calls[0].arguments[0]),
    /^\[polar-webhook\] tenant_mismatch sub=polar_sub_1 tenant=tenant-meta source=metadata external_id=tenant-external$/,
  );
  warn.mock.restore();
});

test("tenant conflict: a subscription already linked to another office is not moved", async () => {
  existingRow = { tenantId: "tenant-owner", status: "ACTIVE", pastDueSince: null };

  const result = await sync(polarSubscription());

  assert.deepEqual(result, { ok: false, reason: "tenant_conflict" });
  assert.equal(subscriptionUpsert.mock.callCount(), 0);
  assert.equal(tenantUpdate.mock.callCount(), 0);
});

test("external_id is only a fallback when metadata has no tenantId", async () => {
  const result = await sync(
    polarSubscription({ metadata: {}, customer: { externalId: "tenant-external" } }),
  );

  assert.equal(result.ok, true);
  assert.equal(upsertedTenantId(), "tenant-external");
});

test("resolvePolarTenant prefers our existing link over external_id when metadata is absent", () => {
  const result = resolvePolarTenant({
    metadataTenantId: null,
    externalId: "tenant-external",
    existingTenantId: "tenant-owner",
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.tenantId, "tenant-owner");
  assert.equal(
    resolvePolarTenant({ metadataTenantId: null, externalId: null, existingTenantId: null }).ok,
    false,
  );
});

test("unknown tenant id: returns tenant_not_found and writes nothing", async () => {
  const result = await sync(polarSubscription({ metadata: { tenantId: "tenant-gone" } }));
  assert.deepEqual(result, { ok: false, reason: "tenant_not_found" });
  assert.equal(subscriptionUpsert.mock.callCount(), 0);
});

test("trialing status: a Polar 'trialing' subscription is stored as TRIALING and entitled", async () => {
  const result = await sync(polarSubscription({ status: "trialing" }));

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.status, "TRIALING");
  assert.equal(result.ok && result.entitled, true);

  const mirror = tenantUpdate.mock.calls[0].arguments[0] as { data: { status: string; plan: string } };
  assert.equal(mirror.data.status, "ACTIVE");
  assert.equal(mirror.data.plan, "PRO");
  assert.equal(invalidateAuthCacheForTenant.mock.calls[0].arguments[0], "tenant-meta");
});

test("foreign product: another app's product is ignored without touching any office", async () => {
  const result = await sync(polarSubscription({ productId: "prod_aqua_growth_engine" }));

  assert.deepEqual(result, { ok: false, reason: "unknown_product" });
  assert.equal(subscriptionFindUnique.mock.callCount(), 0);
  assert.equal(subscriptionUpsert.mock.callCount(), 0);
  assert.equal(tenantUpdate.mock.callCount(), 0);
});

test("past_due starts the 7-day clock once and keeps it on repeat webhooks", async () => {
  await sync(polarSubscription({ status: "past_due" }));
  const first = subscriptionUpsert.mock.calls[0].arguments[0].create.pastDueSince as Date;
  assert.ok(first instanceof Date);

  const since = new Date(Date.now() - 3 * DAY);
  existingRow = { tenantId: "tenant-meta", status: "PAST_DUE", pastDueSince: since };
  subscriptionUpsert.mock.resetCalls();

  const result = await sync(polarSubscription({ status: "past_due" }));
  const update = subscriptionUpsert.mock.calls[0].arguments[0].update;

  assert.equal(update.status, "PAST_DUE");
  assert.equal(update.pastDueSince, since);
  // Day 3 of 7: still entitled.
  assert.equal(result.ok && result.entitled, true);
});

test("past_due beyond 7 days is no longer entitled and the office is marked EXPIRED", async () => {
  existingRow = {
    tenantId: "tenant-meta",
    status: "PAST_DUE",
    pastDueSince: new Date(Date.now() - 8 * DAY),
  };

  const result = await sync(polarSubscription({ status: "past_due" }));

  assert.equal(result.ok && result.entitled, false);
  const lastUpdate = tenantUpdate.mock.calls.at(-1)?.arguments[0] as { data: { status: string } };
  assert.equal(lastUpdate.data.status, "EXPIRED");
});

test("recovering from past_due clears the clock", async () => {
  existingRow = { tenantId: "tenant-meta", status: "PAST_DUE", pastDueSince: new Date() };
  await sync(polarSubscription({ status: "active" }));
  assert.equal(subscriptionUpsert.mock.calls[0].arguments[0].update.pastDueSince, null);
});

test("canceled/revoked: stored as CANCELLED, not entitled, office locked when nothing else pays", async () => {
  const result = await sync(
    polarSubscription({ status: "canceled", currentPeriodEnd: new Date(Date.now() - DAY) }),
  );

  assert.equal(result.ok && result.status, "CANCELLED");
  assert.equal(result.ok && result.entitled, false);
  const lastUpdate = tenantUpdate.mock.calls.at(-1)?.arguments[0] as { data: { status: string } };
  assert.equal(lastUpdate.data.status, "EXPIRED");
});

test("cancel_at_period_end keeps the subscription entitled until the period ends", async () => {
  const result = await sync(
    polarSubscription({ status: "active", cancelAtPeriodEnd: true }),
  );

  assert.equal(result.ok && result.status, "ACTIVE");
  assert.equal(result.ok && result.entitled, true);
  assert.equal(subscriptionUpsert.mock.calls[0].arguments[0].create.cancelAtPeriodEnd, true);
});
