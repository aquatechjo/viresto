import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import { TEST_PRODUCTS } from "./helpers/polar";
import { TEST_PASSWORD, apiRequest, createOfficeTools } from "./helpers/offices";

// AUDIT_REPORT.md M4: an office ADMIN can download all office data and ask
// for the office to be deleted, even while the office is locked (trial
// over, no subscription). Real Postgres and route handlers; only outgoing
// email is mocked.

const verificationCodes = new Map<string, string>();
const deletionEmails: Array<{ to: string[]; officeName: string; officeSlug: string }> = [];

mock.module("@/lib/email", {
  namedExports: {
    sendVerificationEmail: async ({ to, code }: { to: string; code: string }) => {
      verificationCodes.set(to, code);
      return { skipped: true };
    },
    sendOfficeDeletionRequestEmail: async (input: { to: string[]; officeName: string; officeSlug: string }) => {
      deletionEmails.push(input);
      return { skipped: true };
    },
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;

type Handler = (req: NextRequest) => Promise<Response>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let tools: ReturnType<typeof createOfficeTools>;
let clientsPOST: Handler;
let clientsGET: Handler;
let exportGET: Handler;
let deletionPOST: Handler;

before(async () => {
  database = setupIntegrationDatabase();

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ GET: clientsGET, POST: clientsPOST } = await import("../../src/app/api/clients/route"));
  ({ GET: exportGET } = await import("../../src/app/api/data-requests/export/route"));
  ({ POST: deletionPOST } = await import("../../src/app/api/data-requests/deletion/route"));
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

async function lockOffice(tenantId: string) {
  const past = new Date(Date.now() - DAY_MS);
  await prisma.subscription.updateMany({
    where: { tenantId, polarSubscriptionId: null },
    data: { trialStartsAt: new Date(past.getTime() - 14 * DAY_MS), trialEndsAt: past, currentPeriodEnd: past },
  });
}

async function addLawyer(tenantId: string, label: string) {
  const email = `it-${label}-${Date.now()}@example.com`;
  await prisma.user.create({
    data: {
      tenantId,
      name: `Lawyer ${label}`,
      email,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 12),
      role: "LAWYER",
      emailVerifiedAt: new Date(),
    },
  });
  return tools.login(email);
}

async function createClient(cookie: string, name: string, phone: string) {
  const response = await clientsPOST(
    apiRequest("POST", "/api/clients", cookie, { name, phone, nationalId: "9990000001", notes: `notes of ${name}` }),
  );
  assert.equal(response.status, 201, await response.clone().text());
}

test("a locked office's ADMIN downloads all office data; other roles cannot", async () => {
  const office = await tools.registerOffice("export");
  const other = await tools.registerOffice("export-other");
  await createClient(office.cookie, "Export Client", "0791111111");
  await createClient(other.cookie, "Foreign Client", "0792222222");
  const lawyer = await addLawyer(office.tenantId, "export-lawyer");

  await lockOffice(office.tenantId);
  const locked = await clientsGET(apiRequest("GET", "/api/clients", office.cookie));
  assert.equal(locked.status, 402, "office is locked");

  const response = await exportGET(apiRequest("GET", "/api/data-requests/export", office.cookie));
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get("content-disposition") ?? "", /attachment; filename="viresto-export-.+\.json"/);
  assert.equal(response.headers.get("cache-control"), "no-store");

  const raw = await response.text();
  const data = JSON.parse(raw);
  assert.equal(data.format, "viresto-office-export");
  assert.equal(data.office.id, office.tenantId);
  assert.equal(data.users.length, 2);
  assert.equal(data.clients.length, 1);
  assert.equal(data.clients[0].name, "Export Client");
  assert.equal(data.clients[0].phone, "0791111111", "client fields are decrypted");
  assert.equal(data.clients[0].notes, "notes of Export Client");
  assert.ok(data.subscriptions.length >= 1);
  for (const key of ["cases", "caseMembers", "appointments", "tasks", "documents", "invoices", "payments", "activities"]) {
    assert.ok(Array.isArray(data[key]), `${key} section`);
  }

  for (const secret of ["passwordHash", "twoFactorSecret", "phoneHash", "emailHash", "nationalIdHash", "enc:"]) {
    assert.ok(!raw.includes(secret), `export leaks ${secret}`);
  }
  assert.ok(!raw.includes("Foreign Client"), "export leaks another office");
  assert.ok(!raw.includes(other.tenantId), "export leaks another office id");

  const logged = await prisma.activity.count({
    where: { tenantId: office.tenantId, type: "DATA_EXPORTED", actorId: office.userId },
  });
  assert.equal(logged, 1);

  const denied = await exportGET(apiRequest("GET", "/api/data-requests/export", lawyer));
  assert.equal(denied.status, 403);
});

test("a deletion request notifies every system admin once, even when the office is locked", async () => {
  const office = await tools.registerOffice("delete-me");
  const operator = await tools.registerOffice("operator");
  await prisma.user.update({ where: { id: operator.userId }, data: { isSystemAdmin: true } });
  const lawyer = await addLawyer(office.tenantId, "delete-lawyer");
  await lockOffice(office.tenantId);

  const denied = await deletionPOST(apiRequest("POST", "/api/data-requests/deletion", lawyer, {}));
  assert.equal(denied.status, 403);

  const first = await deletionPOST(
    apiRequest("POST", "/api/data-requests/deletion", office.cookie, { reason: "Closing the office" }),
  );
  assert.equal(first.status, 200, await first.clone().text());
  assert.equal((await first.json()).data.alreadyRequested, false);

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: office.tenantId } });
  const notifications = await prisma.notification.findMany({ where: { userId: operator.userId } });
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].tenantId, operator.tenantId);
  assert.equal(notifications[0].href, `/admin?q=${encodeURIComponent(tenant.slug)}`);
  assert.match(notifications[0].messageEn, /Closing the office/);

  assert.equal(deletionEmails.length, 1);
  assert.ok(deletionEmails[0].to.includes(operator.email));
  assert.equal(deletionEmails[0].officeSlug, tenant.slug);

  const activity = await prisma.activity.findMany({
    where: { tenantId: office.tenantId, type: "OFFICE_DELETION_REQUESTED" },
  });
  assert.equal(activity.length, 1);
  assert.equal(activity[0].actorId, office.userId);

  // Asking again within a day does not notify again.
  const again = await deletionPOST(apiRequest("POST", "/api/data-requests/deletion", office.cookie, {}));
  assert.equal(again.status, 200, await again.clone().text());
  assert.equal((await again.json()).data.alreadyRequested, true);
  assert.equal(await prisma.notification.count({ where: { userId: operator.userId } }), 1);
  assert.equal(deletionEmails.length, 1);

  // Nothing is deleted by the request itself.
  assert.ok(await prisma.tenant.findUnique({ where: { id: office.tenantId } }));
});
