import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  runScript,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import {
  TEST_PRODUCTS,
  createFakePolarClient,
  polarCheckoutCreates,
  polarFailures,
  polarGetCalls,
  polarOrderEvent,
  polarRevokes,
  polarSubscriptionUpdates,
  polarSubscriptionEvent,
  setPolarState,
  signedWebhookRequest,
} from "./helpers/polar";

// Trial → paid against a real Postgres (see helpers/database.ts), through
// the real route handlers. Regression test for AUDIT_REPORT.md B1: the
// partial unique index "Subscription_one_current_per_tenant_key" (one
// ACTIVE/TRIALING row per tenant) rejected the first Polar subscription of
// any office still holding its TRIALING signup-trial row, so the webhook
// returned 500 and the office stayed locked after paying.
//
// Only the outside world is faked: outgoing email (to read the
// verification code) and Polar's API (helpers/polar.ts holds each
// subscription's true state; the webhook route re-fetches from it).

const verificationCodes = new Map<string, string>();

mock.module("@/lib/email", {
  namedExports: {
    sendVerificationEmail: async ({ to, code }: { to: string; code: string }) => {
      verificationCodes.set(to, code);
      return { skipped: true };
    },
  },
});

const ORIGIN = "http://localhost:3000";

let fakePolarClient: Awaited<ReturnType<typeof createFakePolarClient>>;

mock.module("@/lib/polar", {
  namedExports: {
    getPolarClient: () => fakePolarClient,
    getAppUrl: () => ORIGIN,
  },
});
const DAY_MS = 24 * 60 * 60 * 1000;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let getTenantAccess: typeof import("../../src/lib/tenant-access-server")["getTenantAccess"];
let registerPOST: typeof import("../../src/app/api/auth/register/route")["POST"];
let verifyEmailPOST: typeof import("../../src/app/api/auth/verify-email/route")["POST"];
let loginPOST: typeof import("../../src/app/api/auth/login/route")["POST"];
let clientsGET: typeof import("../../src/app/api/clients/route")["GET"];
let webhookPOST: typeof import("../../src/app/api/billing/webhooks/polar/route")["POST"];
let checkoutPOST: typeof import("../../src/app/api/billing/checkout/route")["POST"];
let clientsPOST: typeof import("../../src/app/api/clients/route")["POST"];
let casesPOST: typeof import("../../src/app/api/cases/route")["POST"];
let casePATCH: typeof import("../../src/app/api/cases/[id]/route")["PATCH"];
let adminSubscriptionPATCH: typeof import("../../src/app/api/admin/tenants/[id]/subscription/route")["PATCH"];

before(async () => {
  database = setupIntegrationDatabase();
  fakePolarClient = await createFakePolarClient();

  // Imported only now: the Prisma singleton reads DATABASE_URL on import.
  ({ prisma } = await import("../../src/lib/prisma"));
  ({ getTenantAccess } = await import("../../src/lib/tenant-access-server"));
  ({ POST: registerPOST } = await import("../../src/app/api/auth/register/route"));
  ({ POST: verifyEmailPOST } = await import("../../src/app/api/auth/verify-email/route"));
  ({ POST: loginPOST } = await import("../../src/app/api/auth/login/route"));
  ({ GET: clientsGET } = await import("../../src/app/api/clients/route"));
  ({ POST: webhookPOST } = await import("../../src/app/api/billing/webhooks/polar/route"));
  ({ POST: checkoutPOST } = await import("../../src/app/api/billing/checkout/route"));
  ({ POST: clientsPOST } = await import("../../src/app/api/clients/route"));
  ({ POST: casesPOST } = await import("../../src/app/api/cases/route"));
  ({ PATCH: casePATCH } = await import("../../src/app/api/cases/[id]/route"));
  ({ PATCH: adminSubscriptionPATCH } = await import(
    "../../src/app/api/admin/tenants/[id]/subscription/route"
  ));

  await prisma.billingPlan.createMany({
    data: (["BASIC", "PRO", "BUSINESS"] as const).map((code, index) => ({
      code,
      name: code,
      currency: "USD",
      sortOrder: index,
      polarMonthlyProductId: TEST_PRODUCTS[code].monthly,
      polarYearlyProductId: TEST_PRODUCTS[code].yearly,
    })),
  });
});

after(async () => {
  if (prisma && database) await dropIntegrationSchema(prisma, database.schema);
});

// --- helpers -------------------------------------------------------------

let ipCounter = 1;

function jsonRequest(pathname: string, body: unknown, cookie?: string) {
  return new NextRequest(`${ORIGIN}${pathname}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "x-forwarded-host": "localhost:3000",
      // A fresh address per request keeps the per-IP limiters out of the way.
      "x-forwarded-for": `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
      ...(cookie ? { cookie } : {}),
    },
  });
}

function getRequest(pathname: string, cookie: string) {
  return new NextRequest(`${ORIGIN}${pathname}`, {
    method: "GET",
    headers: { cookie, "x-forwarded-host": "localhost:3000" },
  });
}

type Office = { tenantId: string; cookie: string; email: string };

async function registerOffice(label: string): Promise<Office> {
  const email = `it-${label}-${Date.now()}-${randomInt(1e6)}@example.com`;
  const password = "Integration#Pass1";

  const registered = await registerPOST(
    jsonRequest("/api/auth/register", {
      tenantName: `IT ${label}`,
      name: "Integration Admin",
      email,
      phone: `07${String(randomInt(1e8)).padStart(8, "0")}`,
      password,
      acceptTerms: true,
      acceptPrivacy: true,
    }),
  );
  assert.equal(registered.status, 201, await registered.clone().text());

  const code = verificationCodes.get(email);
  assert.ok(code, "verification code captured");
  const verified = await verifyEmailPOST(
    jsonRequest("/api/auth/verify-email", { email, code }),
  );
  assert.equal(verified.status, 200, await verified.clone().text());

  const loggedIn = await loginPOST(jsonRequest("/api/auth/login", { email, password }));
  assert.equal(loggedIn.status, 200, await loggedIn.clone().text());
  const token = loggedIn.headers
    .getSetCookie()
    .find((value) => value.startsWith("ld_token="))
    ?.split(";")[0];
  assert.ok(token, "session cookie issued");

  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { tenantId: true },
  });

  return { tenantId: user.tenantId, cookie: token, email };
}

type SubscriptionInput = Parameters<typeof polarSubscriptionEvent>[1];

// A normal delivery: Polar's state changes, then it sends the event.
async function sendWebhook(type: string, input: SubscriptionInput, msgId?: string) {
  setPolarState(input);
  return deliverWithoutStateChange(type, input, msgId);
}

// Delivers a payload without touching Polar's state: a stale, reordered or
// redelivered event whose payload no longer matches the subscription.
async function deliverWithoutStateChange(
  type: string,
  input: SubscriptionInput,
  msgId?: string,
) {
  const response = await webhookPOST(
    signedWebhookRequest(polarSubscriptionEvent(type, input), msgId),
  );
  const body = await response.json();
  return { status: response.status, body };
}

async function clientsStatus(office: Office) {
  return (await clientsGET(getRequest("/api/clients", office.cookie))).status;
}

function subscriptionsOf(tenantId: string) {
  return prisma.subscription.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      polarSubscriptionId: true,
      trialStartsAt: true,
      currentPeriodEnd: true,
      cancelledAt: true,
    },
  });
}

function currentRows(rows: Awaited<ReturnType<typeof subscriptionsOf>>) {
  return rows.filter((row) => row.status === "ACTIVE" || row.status === "TRIALING");
}

// --- tests ---------------------------------------------------------------

test("new office on its trial buys: subscription.active unlocks it as PAID and closes the trial", async () => {
  const office = await registerOffice("trial-buy");

  assert.equal((await getTenantAccess(office.tenantId)).state, "TRIAL");
  assert.equal(await clientsStatus(office), 200);

  const result = await sendWebhook("subscription.active", {
    id: `sub_trial_buy_${office.tenantId}`,
    tenantId: office.tenantId,
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  const rows = await subscriptionsOf(office.tenantId);
  assert.equal(rows.length, 2);
  const [trial, paid] = rows;
  assert.equal(trial.polarSubscriptionId, null);
  assert.equal(trial.status, "CANCELLED");
  assert.ok(trial.trialStartsAt, "trial dates are kept as history");
  assert.equal(paid.polarSubscriptionId, `sub_trial_buy_${office.tenantId}`);
  assert.equal(paid.status, "ACTIVE");
  assert.equal(currentRows(rows).length, 1);

  const access = await getTenantAccess(office.tenantId);
  assert.equal(access.state, "PAID");
  assert.equal(access.subscriptionId, paid.id);

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: office.tenantId } });
  assert.equal(tenant.status, "ACTIVE");
  assert.equal(await clientsStatus(office), 200);
});

test("renewal and redelivery of an existing Polar subscription update the same row", async () => {
  const office = await registerOffice("renewal");
  const polarId = `sub_renewal_${office.tenantId}`;
  const firstStart = new Date();
  const firstEnd = new Date(firstStart.getTime() + 30 * DAY_MS);

  const bought = await sendWebhook("subscription.active", {
    id: polarId,
    tenantId: office.tenantId,
    periodStart: firstStart,
    periodEnd: firstEnd,
  });
  assert.equal(bought.status, 200, JSON.stringify(bought.body));

  // Polar redelivers the same event (at-least-once delivery).
  const redelivered = await sendWebhook("subscription.active", {
    id: polarId,
    tenantId: office.tenantId,
    periodStart: firstStart,
    periodEnd: firstEnd,
  });
  assert.equal(redelivered.status, 200, JSON.stringify(redelivered.body));

  // Next billing cycle: same subscription, new period.
  const secondEnd = new Date(firstEnd.getTime() + 30 * DAY_MS);
  const renewed = await sendWebhook("subscription.updated", {
    id: polarId,
    tenantId: office.tenantId,
    periodStart: firstEnd,
    periodEnd: secondEnd,
  });
  assert.equal(renewed.status, 200, JSON.stringify(renewed.body));

  // Plan change in place (checkout route: subscriptions.update → sync).
  const upgraded = await sendWebhook("subscription.updated", {
    id: polarId,
    tenantId: office.tenantId,
    productId: TEST_PRODUCTS.BUSINESS.monthly,
    periodStart: firstEnd,
    periodEnd: secondEnd,
  });
  assert.equal(upgraded.status, 200, JSON.stringify(upgraded.body));

  const rows = await subscriptionsOf(office.tenantId);
  assert.equal(rows.length, 2, "no duplicate rows for the same Polar subscription");
  const paid = rows.find((row) => row.polarSubscriptionId === polarId)!;
  assert.equal(paid.status, "ACTIVE");
  assert.equal(paid.currentPeriodEnd?.toISOString(), secondEnd.toISOString());
  assert.equal(currentRows(rows).length, 1);

  const plan = await prisma.subscription.findUniqueOrThrow({
    where: { polarSubscriptionId: polarId },
    select: { plan: { select: { code: true } } },
  });
  assert.equal(plan.plan.code, "BUSINESS");
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
  assert.equal(await clientsStatus(office), 200);
});

test("office whose trial already expired (row still TRIALING) buys and is unlocked", async () => {
  const office = await registerOffice("expired-trial");
  const past = new Date(Date.now() - DAY_MS);

  // What an expired trial looks like in production: nothing flips the row
  // out of TRIALING, only its dates are in the past.
  await prisma.subscription.updateMany({
    where: { tenantId: office.tenantId, polarSubscriptionId: null },
    data: {
      trialStartsAt: new Date(past.getTime() - 14 * DAY_MS),
      trialEndsAt: past,
      currentPeriodEnd: past,
    },
  });

  assert.equal((await getTenantAccess(office.tenantId)).state, "LOCKED");
  assert.equal(await clientsStatus(office), 402);

  const result = await sendWebhook("subscription.active", {
    id: `sub_expired_${office.tenantId}`,
    tenantId: office.tenantId,
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));

  const rows = await subscriptionsOf(office.tenantId);
  assert.equal(currentRows(rows).length, 1);
  assert.equal(
    rows.find((row) => row.polarSubscriptionId === null)?.status,
    "CANCELLED",
  );
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
  assert.equal(await clientsStatus(office), 200);
});

test("an admin-granted ACTIVE row is superseded by a Polar purchase instead of blocking it", async () => {
  const office = await registerOffice("admin-granted");
  const pro = await prisma.billingPlan.findUniqueOrThrow({ where: { code: "PRO" } });

  await prisma.$transaction([
    prisma.subscription.updateMany({
      where: { tenantId: office.tenantId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    }),
    prisma.subscription.create({
      data: {
        tenantId: office.tenantId,
        planId: pro.id,
        status: "ACTIVE",
        currency: "USD",
        amount: 0,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 10 * DAY_MS),
      },
    }),
  ]);

  const result = await sendWebhook("subscription.active", {
    id: `sub_admin_${office.tenantId}`,
    tenantId: office.tenantId,
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));

  const rows = await subscriptionsOf(office.tenantId);
  const current = currentRows(rows);
  assert.equal(current.length, 1);
  assert.equal(current[0].polarSubscriptionId, `sub_admin_${office.tenantId}`);
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
});

test("a non-current Polar event (canceled) never cancels the office's other rows", async () => {
  const office = await registerOffice("stray-cancel");

  const result = await sendWebhook("subscription.canceled", {
    id: `sub_stray_${office.tenantId}`,
    tenantId: office.tenantId,
    status: "canceled",
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));

  const rows = await subscriptionsOf(office.tenantId);
  const trial = rows.find((row) => row.polarSubscriptionId === null)!;
  assert.equal(trial.status, "TRIALING", "the live trial is untouched");
  assert.equal((await getTenantAccess(office.tenantId)).state, "TRIAL");
});

test("migrate-offices-to-app-trial --apply handles an office with an older TRIALING legacy row", async () => {
  const pro = await prisma.billingPlan.findUniqueOrThrow({ where: { code: "PRO" } });
  const slug = `it-legacy-${Date.now()}`;
  const tenant = await prisma.tenant.create({
    data: { name: "IT legacy", slug, status: "TRIAL" },
  });
  const oldEnd = new Date(Date.now() - 20 * DAY_MS);

  // Two pre-release trial rows (no trialStartsAt): an older one still
  // TRIALING and a newer zero-amount one marked EXPIRED. The script
  // re-activates the newest, which used to collide with the older one.
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: pro.id,
      status: "TRIALING",
      amount: 0,
      trialEndsAt: oldEnd,
      currentPeriodEnd: oldEnd,
      createdAt: new Date(Date.now() - 40 * DAY_MS),
    },
  });
  const newest = await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: pro.id,
      status: "EXPIRED",
      amount: 0,
      trialEndsAt: oldEnd,
      currentPeriodEnd: oldEnd,
      createdAt: new Date(Date.now() - 30 * DAY_MS),
    },
  });

  const run = runScript("scripts/migrate-offices-to-app-trial.ts", ["--apply"], database.url);
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);

  const rows = await subscriptionsOf(tenant.id);
  const current = currentRows(rows);
  assert.equal(current.length, 1);
  assert.equal(current[0].id, newest.id);
  assert.equal(current[0].status, "TRIALING");
  assert.ok(current[0].trialStartsAt, "moved onto the new explicit trial");
  assert.equal((await getTenantAccess(tenant.id)).state, "TRIAL");
});

// --- H3: stale / out-of-order / duplicate deliveries ---------------------
// Polar's delivery is at-least-once and unordered. The route must sync the
// subscription as Polar holds it now (re-fetched), never the payload.

test("a stale 'active' for an old subscription after a newer one does not change the current state", async () => {
  const office = await registerOffice("stale-old-sub");
  const oldId = `sub_old_${office.tenantId}`;
  const newId = `sub_new_${office.tenantId}`;

  assert.equal((await sendWebhook("subscription.active", { id: oldId, tenantId: office.tenantId })).status, 200);

  // The office moved to a new subscription; Polar ended the old one.
  setPolarState({ id: oldId, tenantId: office.tenantId, status: "canceled" });
  assert.equal((await sendWebhook("subscription.active", { id: newId, tenantId: office.tenantId })).status, 200);

  const before = await subscriptionsOf(office.tenantId);
  const newRow = before.find((row) => row.polarSubscriptionId === newId)!;
  assert.equal(newRow.status, "ACTIVE");

  // A delayed "active" for the OLD subscription arrives last.
  const stale = await deliverWithoutStateChange("subscription.active", {
    id: oldId,
    tenantId: office.tenantId,
    status: "active",
  });
  assert.equal(stale.status, 200, JSON.stringify(stale.body));

  const after = await subscriptionsOf(office.tenantId);
  const current = currentRows(after);
  assert.equal(current.length, 1);
  assert.equal(current[0].polarSubscriptionId, newId, "the newer subscription stays current");
  assert.notEqual(
    after.find((row) => row.polarSubscriptionId === oldId)?.status,
    "ACTIVE",
  );

  const access = await getTenantAccess(office.tenantId);
  assert.equal(access.state, "PAID");
  assert.equal(access.subscriptionId, newRow.id);
});

test("a stale 'active' arriving after 'revoked' does not unlock the office", async () => {
  const office = await registerOffice("stale-after-revoke");
  const polarId = `sub_revoked_${office.tenantId}`;

  assert.equal((await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId })).status, 200);
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");

  // Refund + revoke in Polar.
  const revoked = await sendWebhook("subscription.revoked", {
    id: polarId,
    tenantId: office.tenantId,
    status: "canceled",
  });
  assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
  assert.equal((await getTenantAccess(office.tenantId)).state, "LOCKED");
  assert.equal(await clientsStatus(office), 402);

  // The earlier "active" delivery, retried late by Polar.
  const stale = await deliverWithoutStateChange("subscription.active", {
    id: polarId,
    tenantId: office.tenantId,
    status: "active",
  });
  assert.equal(stale.status, 200, JSON.stringify(stale.body));

  const row = (await subscriptionsOf(office.tenantId)).find(
    (item) => item.polarSubscriptionId === polarId,
  )!;
  assert.equal(row.status, "CANCELLED");
  assert.equal((await getTenantAccess(office.tenantId)).state, "LOCKED");
  assert.equal(await clientsStatus(office), 402);
});

test("a redelivered webhook-id is acknowledged without being processed again", async () => {
  const office = await registerOffice("dedupe");
  const polarId = `sub_dedupe_${office.tenantId}`;
  const msgId = `msg_dedupe_${office.tenantId}`;
  const getsBefore = polarGetCalls.length;

  const first = await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId }, msgId);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.duplicate, undefined);

  const second = await deliverWithoutStateChange(
    "subscription.active",
    { id: polarId, tenantId: office.tenantId },
    msgId,
  );
  assert.equal(second.status, 200);
  assert.equal(second.body.duplicate, true);

  assert.equal(polarGetCalls.length - getsBefore, 1, "Polar API called once");
  const syncs = await prisma.activity.count({
    where: { tenantId: office.tenantId, type: "BILLING_PLAN_CHANGED" },
  });
  assert.equal(syncs, 1, "synced once");
  assert.ok(
    await prisma.processedWebhook.findUnique({
      where: { source_webhookId: { source: "polar", webhookId: msgId } },
    }),
  );
});

test("a delivery that failed is not marked, so Polar's retry is processed", async () => {
  const office = await registerOffice("retry-after-failure");
  const polarId = `sub_retry_${office.tenantId}`;
  const msgId = `msg_retry_${office.tenantId}`;

  // Polar's API is unreachable for the first attempt: nothing in the fake.
  const failed = await deliverWithoutStateChange(
    "subscription.active",
    { id: polarId, tenantId: office.tenantId },
    msgId,
  );
  assert.equal(failed.status, 500, "5xx so Polar retries");
  assert.equal(
    await prisma.processedWebhook.count({ where: { webhookId: msgId } }),
    0,
  );

  const retried = await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId }, msgId);
  assert.equal(retried.status, 200, JSON.stringify(retried.body));
  assert.equal(retried.body.duplicate, undefined);
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
});

// --- H2: a Polar sync never lifts an admin suspension --------------------

// Exactly what the system-admin suspendTenant action writes.
async function suspendOffice(tenantId: string) {
  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: { isSuspended: true, status: "SUSPENDED" },
    }),
    prisma.session.updateMany({
      where: { tenantId, isActive: true },
      data: { isActive: false },
    }),
  ]);
}

test("a suspended office stays suspended when an entitled Polar sync arrives", async () => {
  const office = await registerOffice("suspended-paid");
  const polarId = `sub_suspended_${office.tenantId}`;
  await suspendOffice(office.tenantId);

  // e.g. a renewal (order.paid / subscription.updated) while suspended.
  const result = await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId });
  assert.equal(result.status, 200, JSON.stringify(result.body));

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: office.tenantId } });
  assert.equal(tenant.isSuspended, true);
  assert.equal(tenant.status, "SUSPENDED");

  // The payment itself is still recorded, so lifting the suspension later
  // restores a paid office.
  const row = await prisma.subscription.findUniqueOrThrow({
    where: { polarSubscriptionId: polarId },
  });
  assert.equal(row.status, "ACTIVE");

  // And the office is really locked out.
  assert.equal(await clientsStatus(office), 401);
  const login = await loginPOST(
    jsonRequest("/api/auth/login", { email: office.email, password: "Integration#Pass1" }),
  );
  assert.equal(login.status, 403);
});

test("a suspended office keeps its SUSPENDED status when a Polar sync locks it", async () => {
  const office = await registerOffice("suspended-revoked");
  const polarId = `sub_suspended_revoked_${office.tenantId}`;

  assert.equal((await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId })).status, 200);
  await suspendOffice(office.tenantId);

  const revoked = await sendWebhook("subscription.revoked", {
    id: polarId,
    tenantId: office.tenantId,
    status: "canceled",
  });
  assert.equal(revoked.status, 200, JSON.stringify(revoked.body));

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: office.tenantId } });
  assert.equal(tenant.isSuspended, true);
  assert.equal(tenant.status, "SUSPENDED", "not overwritten with EXPIRED");
});

// --- Item 4: an office with a live Polar subscription never gets a second
// checkout (it would be a second subscription, billed twice) --------------

async function checkout(office: Office, planId: string, billingCycle = "monthly") {
  const createsBefore = polarCheckoutCreates.length;
  const updatesBefore = polarSubscriptionUpdates.length;
  const response = await checkoutPOST(
    jsonRequest("/api/billing/checkout", { planId, billingCycle }, office.cookie),
  );
  const body = await response.json();

  return {
    status: response.status,
    body,
    checkoutsCreated: polarCheckoutCreates.length - createsBefore,
    updates: polarSubscriptionUpdates.slice(updatesBefore),
  };
}

test("checkout: an office with no subscription anywhere gets a new Polar checkout", async () => {
  const office = await registerOffice("checkout-new");

  const result = await checkout(office, "PRO");
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.mode, "checkout");
  assert.equal(result.checkoutsCreated, 1);
});

test("checkout: an active subscriber changes plan in place, never a second checkout", async () => {
  const office = await registerOffice("checkout-active");
  const polarId = `sub_checkout_active_${office.tenantId}`;
  await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId });

  const same = await checkout(office, "PRO");
  assert.equal(same.status, 400, JSON.stringify(same.body));
  assert.equal(same.checkoutsCreated, 0);

  const other = await checkout(office, "BASIC");
  assert.equal(other.status, 200, JSON.stringify(other.body));
  assert.equal(other.body.data.mode, "updated");
  assert.equal(other.checkoutsCreated, 0);
  assert.deepEqual(other.updates, [{ id: polarId, productId: TEST_PRODUCTS.BASIC.monthly }]);
});

test("checkout: a PAST_DUE subscriber is sent to the customer portal, never a second checkout", async () => {
  const office = await registerOffice("checkout-past-due");
  const polarId = `sub_checkout_past_due_${office.tenantId}`;
  await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId });
  await sendWebhook("subscription.past_due", {
    id: polarId,
    tenantId: office.tenantId,
    status: "past_due",
  });

  const result = await checkout(office, "BUSINESS");
  assert.equal(result.status, 409, JSON.stringify(result.body));
  assert.equal(result.body.details.code, "PAYMENT_METHOD_UPDATE_REQUIRED");
  assert.equal(result.body.details.action, "portal");
  assert.equal(result.checkoutsCreated, 0);
  assert.equal(result.updates.length, 0);
});

test("checkout: DB behind Polar (paid in another tab, not synced yet) still gets no second checkout", async () => {
  const office = await registerOffice("checkout-db-lag");
  const polarId = `sub_checkout_lag_${office.tenantId}`;

  // Paid on Polar; no webhook or return-confirm has reached us yet.
  setPolarState({ id: polarId, tenantId: office.tenantId });
  assert.equal(
    await prisma.subscription.count({ where: { polarSubscriptionId: polarId } }),
    0,
  );

  const result = await checkout(office, "BASIC");
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.mode, "updated");
  assert.equal(result.checkoutsCreated, 0);
  assert.deepEqual(result.updates, [{ id: polarId, productId: TEST_PRODUCTS.BASIC.monthly }]);

  // The live subscription was pulled in on the way.
  const row = await prisma.subscription.findUniqueOrThrow({
    where: { polarSubscriptionId: polarId },
    select: { status: true, plan: { select: { code: true } } },
  });
  assert.equal(row.status, "ACTIVE");
  assert.equal(row.plan.code, "BASIC");
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
});

test("checkout: a newer non-live Polar row does not hide an older live one", async () => {
  const office = await registerOffice("checkout-older-live");
  const liveId = `sub_checkout_live_${office.tenantId}`;
  await sendWebhook("subscription.active", { id: liveId, tenantId: office.tenantId });

  // A stray canceled subscription (e.g. an abandoned attempt) synced later.
  await sendWebhook("subscription.canceled", {
    id: `sub_checkout_stray_${office.tenantId}`,
    tenantId: office.tenantId,
    status: "canceled",
  });

  const result = await checkout(office, "BASIC");
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.mode, "updated");
  assert.equal(result.checkoutsCreated, 0);
  assert.deepEqual(result.updates, [{ id: liveId, productId: TEST_PRODUCTS.BASIC.monthly }]);
});

test("checkout: when Polar cannot be asked, fail closed (503) instead of risking a second subscription", async () => {
  const office = await registerOffice("checkout-polar-down");
  polarFailures.list = true;

  try {
    const result = await checkout(office, "PRO");
    assert.equal(result.status, 503, JSON.stringify(result.body));
    assert.equal(result.checkoutsCreated, 0);
  } finally {
    polarFailures.list = false;
  }
});

// --- M2: editing a case reached by its short publicId --------------------

function patchRequest(pathname: string, body: unknown, cookie: string) {
  const request = jsonRequest(pathname, body, cookie);
  return new NextRequest(request.url, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: request.headers,
  });
}

test("cases: editing a numbered case through its publicId URL keeps its own case number", async () => {
  const office = await registerOffice("case-public-id");
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: office.email },
    select: { id: true },
  });

  const client = await clientsPOST(
    jsonRequest(
      "/api/clients",
      {
        name: "IT Client",
        phone: `07${String(randomInt(1e8)).padStart(8, "0")}`,
        nationalId: String(randomInt(1e9, 1e10)),
      },
      office.cookie,
    ),
  );
  const clientBody = await client.json();
  assert.equal(client.status, 201, JSON.stringify(clientBody));

  const caseNumber = `IT-${randomInt(1e6)}`;
  const created = await casesPOST(
    jsonRequest(
      "/api/cases",
      {
        clientId: clientBody.data.id,
        leadLawyerId: admin.id,
        title: "IT Case",
        caseNumber,
      },
      office.cookie,
    ),
  );
  const caseBody = await created.json();
  assert.ok(created.status === 200 || created.status === 201, JSON.stringify(caseBody));
  const publicId = String(caseBody.data.publicId);

  // The case page reached from a client links by publicId and re-sends the
  // unchanged caseNumber with every edit.
  const edited = await casePATCH(
    patchRequest(`/api/cases/${publicId}`, { title: "IT Case (edited)", caseNumber }, office.cookie),
    { params: Promise.resolve({ id: publicId }) },
  );
  const editedBody = await edited.json();
  assert.equal(edited.status, 200, JSON.stringify(editedBody));
  assert.equal(editedBody.data.title, "IT Case (edited)");

  // A real duplicate is still rejected.
  const other = await casesPOST(
    jsonRequest(
      "/api/cases",
      { clientId: clientBody.data.id, leadLawyerId: admin.id, title: "Other", caseNumber: `${caseNumber}-B` },
      office.cookie,
    ),
  );
  const otherBody = await other.json();
  const clash = await casePATCH(
    patchRequest(`/api/cases/${otherBody.data.publicId}`, { caseNumber }, office.cookie),
    { params: Promise.resolve({ id: String(otherBody.data.publicId) }) },
  );
  assert.equal(clash.status, 409);
});

// --- M1: system-admin subscription actions vs Polar-managed billing ------

let systemAdminCookie: string | null = null;

async function systemAdmin() {
  if (systemAdminCookie) return systemAdminCookie;

  const office = await registerOffice("system-admin");
  await prisma.user.update({
    where: { email: office.email },
    data: { isSystemAdmin: true },
  });

  // Log in again so the session reflects the flag.
  const loggedIn = await loginPOST(
    jsonRequest("/api/auth/login", { email: office.email, password: "Integration#Pass1" }),
  );
  systemAdminCookie = loggedIn.headers
    .getSetCookie()
    .find((value) => value.startsWith("ld_token="))!
    .split(";")[0];
  return systemAdminCookie;
}

async function adminAction(tenantId: string, body: Record<string, unknown>) {
  const cookie = await systemAdmin();
  const response = await adminSubscriptionPATCH(
    patchRequest(
      `/api/admin/tenants/${tenantId}/subscription`,
      { reason: "integration test", ...body },
      cookie,
    ),
    { params: Promise.resolve({ id: tenantId }) },
  );
  return { status: response.status, body: await response.json() };
}

test("admin: every subscription action is refused for an office billed by Polar", async () => {
  const office = await registerOffice("admin-polar");
  const polarId = `sub_admin_polar_${office.tenantId}`;
  await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId });
  const pro = await prisma.billingPlan.findUniqueOrThrow({ where: { code: "PRO" } });

  const before = await subscriptionsOf(office.tenantId);

  for (const action of [
    "ACTIVATE",
    "CHANGE_PLAN",
    "RENEW",
    "CANCEL_AT_PERIOD_END",
    "UNDO_CANCEL",
    "END_NOW",
  ]) {
    const result = await adminAction(office.tenantId, {
      action,
      planId: pro.id,
      interval: "MONTHLY",
    });
    assert.equal(result.status, 409, `${action}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.details?.code, "POLAR_MANAGED", action);
  }

  assert.deepEqual(await subscriptionsOf(office.tenantId), before, "nothing changed");
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
});

test("admin: actions on an ended Polar subscription's row are refused too", async () => {
  const office = await registerOffice("admin-polar-ended");
  const polarId = `sub_admin_ended_${office.tenantId}`;
  await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId });
  await sendWebhook("subscription.revoked", {
    id: polarId,
    tenantId: office.tenantId,
    status: "canceled",
  });

  const renew = await adminAction(office.tenantId, { action: "RENEW" });
  assert.equal(renew.status, 409, JSON.stringify(renew.body));
  assert.equal(
    (await prisma.subscription.findUniqueOrThrow({ where: { polarSubscriptionId: polarId } })).status,
    "CANCELLED",
  );
});

test("admin: an office not billed by Polar can still be granted a subscription manually", async () => {
  const office = await registerOffice("admin-manual");
  const pro = await prisma.billingPlan.findUniqueOrThrow({ where: { code: "PRO" } });

  const result = await adminAction(office.tenantId, {
    action: "ACTIVATE",
    planId: pro.id,
    interval: "MONTHLY",
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
});

test("admin: END_NOW never lifts a suspension", async () => {
  const office = await registerOffice("admin-end-now-suspended");
  await suspendOffice(office.tenantId);

  const result = await adminAction(office.tenantId, { action: "END_NOW" });
  assert.equal(result.status, 200, JSON.stringify(result.body));

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: office.tenantId } });
  assert.equal(tenant.isSuspended, true);
  assert.equal(tenant.status, "SUSPENDED");
  assert.equal((await getTenantAccess(office.tenantId)).state, "LOCKED");
});

// --- L6: refunds ---------------------------------------------------------
// User decision (2026-10-01): a FULL refund revokes the subscription in
// Polar (the office locks through the normal path); a PARTIAL refund keeps
// access and is only logged.

async function deliverOrder(payload: ReturnType<typeof polarOrderEvent>) {
  const response = await webhookPOST(signedWebhookRequest(payload));
  return { status: response.status, body: await response.json() };
}

async function paidOffice(label: string) {
  const office = await registerOffice(label);
  const polarId = `sub_${label}_${office.tenantId}`;
  await sendWebhook("subscription.active", { id: polarId, tenantId: office.tenantId });
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
  return { office, polarId };
}

test("refund: a full refund revokes the subscription in Polar and locks the office", async () => {
  const { office, polarId } = await paidOffice("refund-full");

  const result = await deliverOrder(
    polarOrderEvent("order.refunded", {
      id: `order_full_${office.tenantId}`,
      tenantId: office.tenantId,
      subscriptionId: polarId,
      status: "refunded",
    }),
  );
  assert.equal(result.status, 200, JSON.stringify(result.body));

  assert.deepEqual(polarRevokes.filter((id) => id === polarId), [polarId]);
  const row = await prisma.subscription.findUniqueOrThrow({ where: { polarSubscriptionId: polarId } });
  assert.equal(row.status, "CANCELLED");
  assert.equal((await getTenantAccess(office.tenantId)).state, "LOCKED");
  assert.equal(await clientsStatus(office), 402);

  // A late "active" for the refunded subscription cannot reopen it (H3).
  await deliverWithoutStateChange("subscription.active", { id: polarId, tenantId: office.tenantId });
  assert.equal((await getTenantAccess(office.tenantId)).state, "LOCKED");
});

test("refund: a partial refund keeps access and does not revoke", async () => {
  const { office, polarId } = await paidOffice("refund-partial");

  const result = await deliverOrder(
    polarOrderEvent("order.refunded", {
      id: `order_partial_${office.tenantId}`,
      tenantId: office.tenantId,
      subscriptionId: polarId,
      status: "partially_refunded",
      refundedAmount: 1000,
    }),
  );
  assert.equal(result.status, 200, JSON.stringify(result.body));

  assert.equal(polarRevokes.includes(polarId), false);
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
  assert.equal(await clientsStatus(office), 200);
});

test("refund: a full refund for a subscription already revoked in Polar still locks (no retry loop)", async () => {
  const { office, polarId } = await paidOffice("refund-already-revoked");
  // Revoked by hand in the Polar dashboard while refunding; that webhook
  // has not reached us yet.
  setPolarState({ id: polarId, tenantId: office.tenantId, status: "canceled" });

  const result = await deliverOrder(
    polarOrderEvent("order.refunded", {
      id: `order_already_${office.tenantId}`,
      tenantId: office.tenantId,
      subscriptionId: polarId,
      status: "refunded",
    }),
  );
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal((await getTenantAccess(office.tenantId)).state, "LOCKED");
});

test("refund: if Polar refuses the revoke and the subscription is still live, answer 500 so Polar retries", async () => {
  const { office, polarId } = await paidOffice("refund-revoke-fails");
  polarFailures.revoke = true;

  try {
    const result = await deliverOrder(
      polarOrderEvent("order.refunded", {
        id: `order_fail_${office.tenantId}`,
        tenantId: office.tenantId,
        subscriptionId: polarId,
        status: "refunded",
      }),
    );
    assert.equal(result.status, 500, JSON.stringify(result.body));
  } finally {
    polarFailures.revoke = false;
  }
});

test("refund: another app's product is ignored and nothing is revoked", async () => {
  const { office, polarId } = await paidOffice("refund-foreign");

  const result = await deliverOrder(
    polarOrderEvent("order.refunded", {
      id: `order_foreign_${office.tenantId}`,
      tenantId: office.tenantId,
      subscriptionId: polarId,
      productId: "prod_other_app",
      status: "refunded",
    }),
  );
  assert.equal(result.status, 200);
  assert.equal(polarRevokes.includes(polarId), false);
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
});
