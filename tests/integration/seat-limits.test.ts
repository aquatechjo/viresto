import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
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
import { ORIGIN, TEST_PASSWORD, apiRequest, createOfficeTools } from "./helpers/offices";

// AUDIT_REPORT.md H1: a trial office (Pro limits, 5 users) that buys Basic
// (1 user) used to keep every member fully working. Now the users beyond
// the plan's limit are read-only (tenant-seats.ts): they can read, every
// write is refused with SEAT_LIMIT_READ_ONLY, the owner keeps a seat, and
// an admin can always deactivate members to get back under the limit.

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

type Handler = (req: NextRequest) => Promise<Response>;
type IdHandler = (req: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let tools: ReturnType<typeof createOfficeTools>;
let webhookPOST: Handler;
let clientsGET: Handler;
let clientsPOST: Handler;
let accessGET: Handler;
let teamGET: Handler;
let memberPATCH: IdHandler;
let memberDELETE: IdHandler;
let logoutPOST: Handler;

before(async () => {
  database = setupIntegrationDatabase();
  fakePolarClient = await createFakePolarClient();

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ POST: webhookPOST } = await import("../../src/app/api/billing/webhooks/polar/route"));
  ({ GET: clientsGET, POST: clientsPOST } = await import("../../src/app/api/clients/route"));
  ({ GET: accessGET } = await import("../../src/app/api/billing/access/route"));
  ({ GET: teamGET } = await import("../../src/app/api/team/route"));
  ({ PATCH: memberPATCH, DELETE: memberDELETE } = await import("../../src/app/api/team/[id]/route"));
  ({ POST: logoutPOST } = await import("../../src/app/api/auth/logout/route"));

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

async function addMember(tenantId: string, label: string, role: "ADMIN" | "LAWYER" | "STAFF") {
  const email = `it-seat-${label}-${Date.now()}-${randomInt(1e6)}@example.com`;
  const user = await prisma.user.create({
    data: {
      tenantId,
      name: `Member ${label}`,
      email,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 12),
      role,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });

  return { id: user.id, cookie: await tools.login(email) };
}

async function buyPlan(tenantId: string, plan: keyof typeof TEST_PRODUCTS) {
  const input = {
    id: `sub_seat_${plan}_${tenantId}`,
    tenantId,
    productId: TEST_PRODUCTS[plan].monthly,
  };
  setPolarState(input);
  const response = await webhookPOST(
    signedWebhookRequest(polarSubscriptionEvent("subscription.active", input)),
  );
  assert.equal(response.status, 200, await response.clone().text());
}

async function createClient(cookie: string) {
  const response = await clientsPOST(
    apiRequest("POST", "/api/clients", cookie, {
      name: "IT Seat Client",
      phone: `07${String(randomInt(1e8)).padStart(8, "0")}`,
      nationalId: String(randomInt(1e9, 1e10)),
    }),
  );
  return { status: response.status, body: await response.json() };
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function accessOf(cookie: string) {
  const response = await accessGET(apiRequest("GET", "/api/billing/access", cookie));
  assert.equal(response.status, 200);
  return (await response.json()).data;
}

test("trial office buys Basic with 3 active users: the 2 beyond the limit are read-only, the owner is not", async () => {
  const office = await tools.registerOffice("seat-basic");
  const lawyer = await addMember(office.tenantId, "lawyer", "LAWYER");
  const staff = await addMember(office.tenantId, "staff", "STAFF");

  // On the trial (Pro limits, 5 users) everyone writes.
  assert.equal((await createClient(lawyer.cookie)).status, 201);

  await buyPlan(office.tenantId, "BASIC");

  const ownerWrite = await createClient(office.cookie);
  assert.equal(ownerWrite.status, 201, JSON.stringify(ownerWrite.body));

  for (const member of [lawyer, staff]) {
    const write = await createClient(member.cookie);
    assert.equal(write.status, 403);
    assert.equal(write.body.details.code, "SEAT_LIMIT_READ_ONLY");

    // Reading still works, and so does signing out.
    assert.equal((await clientsGET(apiRequest("GET", "/api/clients", member.cookie))).status, 200);
  }

  const ownerAccess = await accessOf(office.cookie);
  assert.equal(ownerAccess.canWrite, true);
  assert.equal(ownerAccess.access.seats.overLimit, true);
  assert.equal(ownerAccess.access.seats.limit, 1);
  assert.equal(ownerAccess.access.seats.activeCount, 3);
  assert.deepEqual(
    ownerAccess.access.seats.readOnlyUsers.map((user: { id: string }) => user.id).sort(),
    [lawyer.id, staff.id].sort(),
  );

  const lawyerAccess = await accessOf(lawyer.cookie);
  assert.equal(lawyerAccess.canWrite, false);
  assert.equal(lawyerAccess.writeBlockCode, "SEAT_LIMIT_READ_ONLY");
  assert.equal(lawyerAccess.access.seats.readOnly, true);
  assert.deepEqual(lawyerAccess.access.seats.readOnlyUsers, [], "names are for the admin only");

  const team = (await (await teamGET(apiRequest("GET", "/api/team", office.cookie))).json()).data;
  const flags = Object.fromEntries(
    team.users.map((user: { id: string; readOnly: boolean; isOwner: boolean }) => [user.id, user]),
  );
  assert.equal(flags[office.userId].isOwner, true);
  assert.equal(flags[office.userId].readOnly, false);
  assert.equal(flags[lawyer.id].readOnly, true);
  assert.equal(team.seats.limit, 1);
  assert.equal(team.seats.overLimit, true);

  // Basic has no team management, yet the owner can deactivate members.
  const disabled = await memberPATCH(
    apiRequest("PATCH", `/api/team/${lawyer.id}`, office.cookie, { isActive: false }),
    params(lawyer.id),
  );
  assert.equal(disabled.status, 200, await disabled.clone().text());
  assert.equal((await createClient(staff.cookie)).status, 403, "one user still over the limit");

  const removed = await memberDELETE(
    apiRequest("DELETE", `/api/team/${staff.id}`, office.cookie),
    params(staff.id),
  );
  assert.equal(removed.status, 200, await removed.clone().text());

  const fixed = await accessOf(office.cookie);
  assert.equal(fixed.access.seats.overLimit, false);
  assert.equal(fixed.access.seats.activeCount, 1);
});

test("a read-only admin can still deactivate members, but cannot change roles or write", async () => {
  const office = await tools.registerOffice("seat-admin");
  const lawyer = await addMember(office.tenantId, "old-lawyer", "LAWYER");
  const admin = await addMember(office.tenantId, "new-admin", "ADMIN");

  await buyPlan(office.tenantId, "BASIC");

  assert.equal((await createClient(admin.cookie)).status, 403);

  const roleChange = await memberPATCH(
    apiRequest("PATCH", `/api/team/${lawyer.id}`, admin.cookie, { role: "STAFF" }),
    params(lawyer.id),
  );
  assert.equal(roleChange.status, 403);
  assert.equal((await roleChange.json()).details.code, "SEAT_LIMIT_READ_ONLY");

  const deactivated = await memberPATCH(
    apiRequest("PATCH", `/api/team/${lawyer.id}`, admin.cookie, { isActive: false }),
    params(lawyer.id),
  );
  assert.equal(deactivated.status, 200, await deactivated.clone().text());

  // Signing out is never blocked.
  assert.equal((await logoutPOST(apiRequest("POST", "/api/auth/logout", admin.cookie))).status, 200);
});

test("upgrading back to Pro lifts the read-only state with nobody deactivated", async () => {
  const office = await tools.registerOffice("seat-upgrade");
  const lawyer = await addMember(office.tenantId, "lawyer-up", "LAWYER");

  await buyPlan(office.tenantId, "BASIC");
  assert.equal((await createClient(lawyer.cookie)).status, 403);

  // Plan change in place: same Polar subscription, new product.
  const input = {
    id: `sub_seat_BASIC_${office.tenantId}`,
    tenantId: office.tenantId,
    productId: TEST_PRODUCTS.PRO.monthly,
  };
  setPolarState(input);
  const updated = await webhookPOST(
    signedWebhookRequest(polarSubscriptionEvent("subscription.updated", input)),
  );
  assert.equal(updated.status, 200);

  assert.equal((await createClient(lawyer.cookie)).status, 201);
});
