import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import {
  TEST_PRODUCTS,
  createFakePolarClient,
  polarSubscriptionEvent,
  setPolarState,
  signedWebhookRequest,
} from "./helpers/polar";
import { ORIGIN, createOfficeTools } from "./helpers/offices";

// AUDIT_REPORT.md H2: the daily reconciliation cron re-syncs offices whose
// rows drifted from Polar because a webhook never arrived. Each test
// changes Polar's state (helpers/polar.ts) without delivering the webhook,
// runs the real cron route, and checks the office's access.

const verificationCodes = new Map<string, string>();

mock.module("@/lib/email", {
  namedExports: {
    sendVerificationEmail: async ({ to, code }: { to: string; code: string }) => {
      verificationCodes.set(to, code);
      return { skipped: true };
    },
  },
});

let fakePolarClient: Awaited<ReturnType<typeof createFakePolarClient>>;

mock.module("@/lib/polar", {
  namedExports: {
    getPolarClient: () => fakePolarClient,
    getAppUrl: () => ORIGIN,
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;
const CRON_SECRET = "integration-cron-secret-000000000000001";

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let getTenantAccess: typeof import("../../src/lib/tenant-access-server")["getTenantAccess"];
let tools: ReturnType<typeof createOfficeTools>;
let webhookPOST: (req: NextRequest) => Promise<Response>;
let cronGET: (req: NextRequest) => Promise<Response>;

before(async () => {
  database = setupIntegrationDatabase();
  process.env.CRON_SECRET = CRON_SECRET;
  fakePolarClient = await createFakePolarClient();

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ getTenantAccess } = await import("../../src/lib/tenant-access-server"));
  ({ POST: webhookPOST } = await import("../../src/app/api/billing/webhooks/polar/route"));
  ({ GET: cronGET } = await import("../../src/app/api/cron/reconcile-billing/route"));

  const post = async (name: string) => (await import(`../../src/app/api/auth/${name}/route`)).POST;
  tools = createOfficeTools({
    prisma,
    registerPOST: await post("register"),
    verifyEmailPOST: await post("verify-email"),
    loginPOST: await post("login"),
    verificationCodes,
  });

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

function cronRequest(secret = CRON_SECRET) {
  return new NextRequest(`${ORIGIN}/api/cron/reconcile-billing`, {
    headers: { authorization: `Bearer ${secret}` },
  });
}

async function runCron() {
  const response = await cronGET(cronRequest());
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).data as {
    checked: number;
    drifted: number;
    fixed: number;
    failed: number;
  };
}

async function deliver(type: string, input: Parameters<typeof setPolarState>[0]) {
  setPolarState(input);
  const response = await webhookPOST(signedWebhookRequest(polarSubscriptionEvent(type, input)));
  assert.equal(response.status, 200);
}

test("the cron needs the bearer secret", async () => {
  assert.equal((await cronGET(cronRequest("wrong-secret-0000000000000000000000"))).status, 401);
});

test("a purchase whose webhooks never arrived is found and unlocks the office", async () => {
  const office = await tools.registerOffice("recon-lost-buy");
  assert.equal((await getTenantAccess(office.tenantId)).state, "TRIAL");

  // Paid in Polar; neither the webhook nor the checkout return reached us.
  setPolarState({ id: `sub_recon_buy_${office.tenantId}`, tenantId: office.tenantId });

  const summary = await runCron();
  assert.ok(summary.drifted >= 1);
  assert.equal(summary.failed, 0);

  const access = await getTenantAccess(office.tenantId);
  assert.equal(access.state, "PAID");
});

test("a lost renewal moves the period forward, so the office never locks", async () => {
  const office = await tools.registerOffice("recon-renewal");
  const id = `sub_recon_renew_${office.tenantId}`;
  const firstStart = new Date(Date.now() - 31 * DAY_MS);
  const firstEnd = new Date(Date.now() - 3 * DAY_MS);

  await deliver("subscription.active", {
    id,
    tenantId: office.tenantId,
    periodStart: firstStart,
    periodEnd: firstEnd,
  });
  // 3 days past the period end, beyond the 48 h renewal grace: locked.
  assert.equal((await getTenantAccess(office.tenantId)).state, "LOCKED");

  // Polar renewed and charged; the renewal webhooks were lost.
  const renewedEnd = new Date(firstEnd.getTime() + 30 * DAY_MS);
  setPolarState({ id, tenantId: office.tenantId, periodStart: firstEnd, periodEnd: renewedEnd });

  await runCron();

  const row = await prisma.subscription.findUniqueOrThrow({ where: { polarSubscriptionId: id } });
  assert.equal(row.currentPeriodEnd?.toISOString(), renewedEnd.toISOString());
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");
});

test("a lost revoke ends access: Polar no longer lists it as live", async () => {
  const office = await tools.registerOffice("recon-revoke");
  const id = `sub_recon_revoke_${office.tenantId}`;

  await deliver("subscription.active", { id, tenantId: office.tenantId });
  assert.equal((await getTenantAccess(office.tenantId)).state, "PAID");

  setPolarState({ id, tenantId: office.tenantId, status: "canceled" });

  await runCron();

  const row = await prisma.subscription.findUniqueOrThrow({ where: { polarSubscriptionId: id } });
  assert.equal(row.status, "CANCELLED");
  assert.equal((await getTenantAccess(office.tenantId)).state, "LOCKED");
});

test("an office already in sync is left untouched", async () => {
  const office = await tools.registerOffice("recon-in-sync");
  const id = `sub_recon_sync_${office.tenantId}`;

  await deliver("subscription.active", { id, tenantId: office.tenantId });
  const before = await prisma.subscription.findUniqueOrThrow({ where: { polarSubscriptionId: id } });

  await runCron();

  const afterRun = await prisma.subscription.findUniqueOrThrow({ where: { polarSubscriptionId: id } });
  assert.equal(afterRun.updatedAt.toISOString(), before.updatedAt.toISOString());

  const activity = await prisma.activity.count({
    where: { tenantId: office.tenantId, type: "BILLING_PLAN_CHANGED" },
  });
  assert.equal(activity, 1, "no extra sync for an office without drift");
});
