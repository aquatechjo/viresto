import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
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
import { ORIGIN, apiRequest, createOfficeTools, sessionCookie } from "./helpers/offices";

// Demo mode ("try with sample data", src/lib/demo) against a real Postgres,
// through the real route handlers: a trial office enters its sandbox, uses
// it, leaves, comes back, and the sandbox disappears when the office
// subscribes or its trial ends. Only email and Polar's API are faked.

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

type Handler = (req: import("next/server").NextRequest) => Promise<Response>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let getTenantBillingLimits: typeof import("../../src/lib/billing-limits")["getTenantBillingLimits"];
let cleanupDemoSandboxes: typeof import("../../src/lib/demo/sandbox")["cleanupDemoSandboxes"];
let tools: ReturnType<typeof createOfficeTools>;
let routes: Record<
  | "demoGET" | "enterPOST" | "exitPOST" | "resetPOST" | "clientsGET" | "clientsPOST"
  | "checkoutPOST" | "accessGET" | "teamPOST" | "logoutPOST" | "loginPOST" | "webhookPOST",
  Handler
>;

before(async () => {
  database = setupIntegrationDatabase();
  fakePolarClient = await createFakePolarClient();

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ getTenantBillingLimits } = await import("../../src/lib/billing-limits"));
  ({ cleanupDemoSandboxes } = await import("../../src/lib/demo/sandbox"));

  const registerPOST = (await import("../../src/app/api/auth/register/route")).POST;
  const verifyEmailPOST = (await import("../../src/app/api/auth/verify-email/route")).POST;
  const loginPOST = (await import("../../src/app/api/auth/login/route")).POST;

  routes = {
    demoGET: (await import("../../src/app/api/demo/route")).GET,
    enterPOST: (await import("../../src/app/api/demo/enter/route")).POST,
    exitPOST: (await import("../../src/app/api/demo/exit/route")).POST,
    resetPOST: (await import("../../src/app/api/demo/reset/route")).POST,
    clientsGET: (await import("../../src/app/api/clients/route")).GET,
    clientsPOST: (await import("../../src/app/api/clients/route")).POST,
    checkoutPOST: (await import("../../src/app/api/billing/checkout/route")).POST,
    accessGET: (await import("../../src/app/api/billing/access/route")).GET,
    teamPOST: (await import("../../src/app/api/team/route")).POST,
    logoutPOST: (await import("../../src/app/api/auth/logout/route")).POST,
    webhookPOST: (await import("../../src/app/api/billing/webhooks/polar/route")).POST,
    loginPOST,
  };

  tools = createOfficeTools({ prisma, registerPOST, verifyEmailPOST, loginPOST, verificationCodes });

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

async function call(handler: Handler, method: string, path: string, cookie?: string, body?: unknown) {
  const response = await handler(apiRequest(method, path, cookie, body));
  const json = await response.clone().json().catch(() => null);
  return { response, status: response.status, body: json };
}

async function enterDemo(cookie: string) {
  const entered = await call(routes.enterPOST, "POST", "/api/demo/enter", cookie, {});
  assert.equal(entered.status, 200, JSON.stringify(entered.body));
  return sessionCookie(entered.response);
}

async function clientTotal(cookie: string) {
  const listed = await call(routes.clientsGET, "GET", "/api/clients", cookie);
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  return listed.body.data.meta.total as number;
}

function sandboxOf(userId: string) {
  return prisma.tenant.findUnique({
    where: { demoOwnerUserId: userId },
    select: { id: true, isDemo: true, demoOwnerTenantId: true },
  });
}

async function subscribe(tenantId: string) {
  const input = { id: `sub_demo_${tenantId}`, tenantId };
  setPolarState(input);
  const response = await routes.webhookPOST(
    signedWebhookRequest(polarSubscriptionEvent("subscription.active", input)),
  );
  assert.equal(response.status, 200, await response.text());
}

async function endTrial(tenantId: string) {
  const past = new Date(Date.now() - 60_000);
  await prisma.subscription.updateMany({
    where: { tenantId, status: "TRIALING", polarSubscriptionId: null },
    data: { trialEndsAt: past, currentPeriodEnd: past },
  });
}

// --- tests ---------------------------------------------------------------

test("a trial office enters a populated sandbox, uses it, and its real data stays apart", async () => {
  const office = await tools.registerOffice("demo-enter");

  const state = await call(routes.demoGET, "GET", "/api/demo", office.cookie);
  assert.deepEqual(state.body.data, { inDemo: false, available: true });

  const demoCookie = await enterDemo(office.cookie);
  const sandbox = await sandboxOf(office.userId);
  assert.ok(sandbox?.isDemo);
  assert.equal(sandbox.demoOwnerTenantId, office.tenantId);

  // Fully populated, and fully usable.
  assert.equal(await clientTotal(demoCookie), 15);
  assert.equal(await prisma.case.count({ where: { tenantId: sandbox.id } }), 20);
  assert.ok((await prisma.invoice.count({ where: { tenantId: sandbox.id } })) >= 8);

  const created = await call(routes.clientsPOST, "POST", "/api/clients", demoCookie, {
    name: "موكل جديد في التجربة",
    phone: "0700000999",
    nationalId: "0000000099",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(await clientTotal(demoCookie), 16);

  // Strict isolation: nothing leaked into the real office.
  assert.equal(await clientTotal(office.cookie), 0);

  const inDemo = await call(routes.demoGET, "GET", "/api/demo", demoCookie);
  assert.deepEqual(inDemo.body.data, { inDemo: true, available: true });

  // The sandbox runs on the owner's trial: same access state, same plan
  // limits and AI token budget (charged to the owner's office).
  const access = await call(routes.accessGET, "GET", "/api/billing/access", demoCookie);
  assert.equal(access.status, 200, JSON.stringify(access.body));
  const [ownerLimits, sandboxLimits] = await Promise.all([
    getTenantBillingLimits(office.tenantId),
    getTenantBillingLimits(sandbox.id),
  ]);
  assert.equal(sandboxLimits.subscriptionId, ownerLimits.subscriptionId);
  assert.equal(sandboxLimits.limits.aiMonthlyTokens, ownerLimits.limits.aiMonthlyTokens);
  assert.ok(sandboxLimits.canCreate);

  // Exit: back in the real office, and the sandbox is kept for next time.
  const exited = await call(routes.exitPOST, "POST", "/api/demo/exit", demoCookie, {});
  assert.equal(exited.status, 200);
  const realCookie = sessionCookie(exited.response);
  assert.equal(await clientTotal(realCookie), 0);
  assert.equal((await sandboxOf(office.userId))?.id, sandbox.id);

  // The ended demo session no longer works on its own.
  const stale = await call(routes.clientsGET, "GET", "/api/clients", demoCookie);
  assert.equal(stale.body.details.code, "DEMO_ENDED");

  // Entering again reuses the same sandbox with what the user left in it.
  const again = await enterDemo(realCookie);
  assert.equal(await clientTotal(again), 16);
  assert.equal((await sandboxOf(office.userId))?.id, sandbox.id);

  // Reset rebuilds the sample data from scratch.
  const reset = await call(routes.resetPOST, "POST", "/api/demo/reset", again, {});
  assert.equal(reset.status, 200, JSON.stringify(reset.body));
  const resetCookie = sessionCookie(reset.response);
  assert.equal(await clientTotal(resetCookie), 15);
  assert.notEqual((await sandboxOf(office.userId))?.id, sandbox.id);
  assert.equal(await prisma.tenant.count({ where: { id: sandbox.id } }), 0);
});

test("a demo office cannot bill, invite or email, and its users cannot log in", async () => {
  const office = await tools.registerOffice("demo-blocked");
  const demoCookie = await enterDemo(office.cookie);

  const checkout = await call(routes.checkoutPOST, "POST", "/api/billing/checkout", demoCookie, {
    planCode: "PRO",
    interval: "MONTHLY",
  });
  assert.equal(checkout.status, 403);
  assert.equal(checkout.body.details.code, "DEMO_BLOCKED");

  const invite = await call(routes.teamPOST, "POST", "/api/team", demoCookie, {
    name: "Someone Real",
    email: "someone.real@example.com",
    role: "LAWYER",
  });
  assert.equal(invite.status, 403);
  assert.equal(invite.body.details.code, "DEMO_BLOCKED");

  const sandbox = await sandboxOf(office.userId);
  const sandboxUsers = await prisma.user.findMany({
    where: { tenantId: sandbox!.id },
    select: { email: true },
  });
  assert.equal(sandboxUsers.length, 3);

  for (const { email } of sandboxUsers) {
    assert.match(email, /@demo\.viresto\.invalid$/);
    const login = await routes.loginPOST(
      apiRequest("POST", "/api/auth/login", undefined, { email, password: "Integration#Pass1" }),
    );
    assert.equal(login.status, 401);
  }

  // A sandbox is never an office on the books.
  assert.equal(await prisma.subscription.count({ where: { tenantId: sandbox!.id } }), 0);
});

test("subscribing deletes the sandbox, ends demo mode and hides the button", async () => {
  const office = await tools.registerOffice("demo-subscribe");
  const demoCookie = await enterDemo(office.cookie);
  const sandbox = await sandboxOf(office.userId);
  assert.ok(sandbox);

  await subscribe(office.tenantId);

  // The sandbox and all its data are gone.
  assert.equal(await prisma.tenant.count({ where: { id: sandbox.id } }), 0);
  assert.equal(await prisma.client.count({ where: { tenantId: sandbox.id } }), 0);

  // The user still inside demo mode lands in the real office on their next
  // request: the response switches the cookie back to the real session.
  const next = await call(routes.clientsGET, "GET", "/api/clients", demoCookie);
  assert.equal(next.status, 409);
  assert.equal(next.body.details.code, "DEMO_ENDED");
  assert.equal(next.response.headers.get("x-viresto-demo-ended"), "1");
  const realCookie = sessionCookie(next.response);
  assert.equal(await clientTotal(realCookie), 0);

  // The button is gone for good, and entering is refused server-side.
  const state = await call(routes.demoGET, "GET", "/api/demo", realCookie);
  assert.deepEqual(state.body.data, { inDemo: false, available: false });
  const enter = await call(routes.enterPOST, "POST", "/api/demo/enter", realCookie, {});
  assert.equal(enter.status, 403);
  assert.equal(enter.body.details.code, "DEMO_UNAVAILABLE");
  assert.equal(await sandboxOf(office.userId), null);
});

test("when the trial ends, the next demo request is refused and the sandbox deleted", async () => {
  const office = await tools.registerOffice("demo-expire");
  const demoCookie = await enterDemo(office.cookie);
  const sandbox = await sandboxOf(office.userId);
  assert.ok(sandbox);

  await endTrial(office.tenantId);

  const next = await call(routes.clientsGET, "GET", "/api/clients", demoCookie);
  assert.equal(next.body.details.code, "DEMO_ENDED");
  assert.equal(await prisma.tenant.count({ where: { id: sandbox.id } }), 0);

  // Back in the real office, which is locked like any expired trial: demo
  // mode is not offered (402 SUBSCRIPTION_REQUIRED, like every route).
  const realCookie = sessionCookie(next.response);
  const state = await call(routes.demoGET, "GET", "/api/demo", realCookie);
  assert.equal(state.status, 402);
  const enter = await call(routes.enterPOST, "POST", "/api/demo/enter", realCookie, {});
  assert.equal(enter.status, 402);
});

test("the nightly cleanup deletes sandboxes of offices no longer on trial, and only those", async () => {
  const expired = await tools.registerOffice("demo-cron-expired");
  const active = await tools.registerOffice("demo-cron-active");
  await enterDemo(expired.cookie);
  await enterDemo(active.cookie);
  const expiredSandbox = await sandboxOf(expired.userId);
  const activeSandbox = await sandboxOf(active.userId);

  await endTrial(expired.tenantId);
  const result = await cleanupDemoSandboxes();

  assert.ok(result.deleted >= 1);
  assert.equal(await prisma.tenant.count({ where: { id: expiredSandbox!.id } }), 0);
  assert.equal(await prisma.tenant.count({ where: { id: activeSandbox!.id } }), 1);
});

test("logging out from demo mode also ends the real session", async () => {
  const office = await tools.registerOffice("demo-logout");
  const demoCookie = await enterDemo(office.cookie);

  const out = await call(routes.logoutPOST, "POST", "/api/auth/logout", demoCookie, {});
  assert.equal(out.status, 200);

  const real = await call(routes.clientsGET, "GET", "/api/clients", office.cookie);
  assert.equal(real.status, 401);
});
