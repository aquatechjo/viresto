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
  polarSubscriptionEvent,
  signedWebhookRequest,
} from "./helpers/polar";

// Trial → paid against a real Postgres (see helpers/database.ts), through
// the real route handlers. Regression test for AUDIT_REPORT.md B1: the
// partial unique index "Subscription_one_current_per_tenant_key" (one
// ACTIVE/TRIALING row per tenant) rejected the first Polar subscription of
// any office still holding its TRIALING signup-trial row, so the webhook
// returned 500 and the office stayed locked after paying.
//
// Only outgoing email is mocked, to read the verification code.

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
const DAY_MS = 24 * 60 * 60 * 1000;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let getTenantAccess: typeof import("../../src/lib/tenant-access-server")["getTenantAccess"];
let registerPOST: typeof import("../../src/app/api/auth/register/route")["POST"];
let verifyEmailPOST: typeof import("../../src/app/api/auth/verify-email/route")["POST"];
let loginPOST: typeof import("../../src/app/api/auth/login/route")["POST"];
let clientsGET: typeof import("../../src/app/api/clients/route")["GET"];
let webhookPOST: typeof import("../../src/app/api/billing/webhooks/polar/route")["POST"];

before(async () => {
  database = setupIntegrationDatabase();

  // Imported only now: the Prisma singleton reads DATABASE_URL on import.
  ({ prisma } = await import("../../src/lib/prisma"));
  ({ getTenantAccess } = await import("../../src/lib/tenant-access-server"));
  ({ POST: registerPOST } = await import("../../src/app/api/auth/register/route"));
  ({ POST: verifyEmailPOST } = await import("../../src/app/api/auth/verify-email/route"));
  ({ POST: loginPOST } = await import("../../src/app/api/auth/login/route"));
  ({ GET: clientsGET } = await import("../../src/app/api/clients/route"));
  ({ POST: webhookPOST } = await import("../../src/app/api/billing/webhooks/polar/route"));

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

async function sendWebhook(type: string, input: Parameters<typeof polarSubscriptionEvent>[1]) {
  const response = await webhookPOST(signedWebhookRequest(polarSubscriptionEvent(type, input)));
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
