import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import { TEST_PRODUCTS } from "./helpers/polar";

// AUDIT_REPORT.md M5: cross-office access (IDOR) through every [id] route.
// Office A owns one record of every kind; office B's ADMIN (the most
// privileged in-office role) calls every [id] handler with A's ids, and
// with A's short numeric publicId where the route accepts one. Every call
// must be refused without revealing anything (404; 403 for the
// system-admin-only routes), and A's data must be exactly unchanged.
// Real Postgres, real route handlers; only outgoing email is mocked.

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

type Handler = (req: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
type RouteModule = Partial<Record<"GET" | "POST" | "PATCH" | "DELETE", Handler>>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let registerPOST: (req: NextRequest) => Promise<Response>;
let verifyEmailPOST: (req: NextRequest) => Promise<Response>;
let loginPOST: (req: NextRequest) => Promise<Response>;
const routes: Record<string, RouteModule> = {};

const ROUTE_PATHS = {
  adminTenant: "admin/tenants/[id]",
  adminSubscription: "admin/tenants/[id]/subscription",
  appointment: "appointments/[id]",
  case: "cases/[id]",
  clientFull: "clients/[id]/full",
  client: "clients/[id]",
  documentPreview: "documents/[id]/preview",
  document: "documents/[id]",
  documentSummarize: "documents/[id]/summarize",
  invoice: "invoices/[id]",
  notificationRead: "notifications/[id]/read",
  payment: "payments/[id]",
  task: "tasks/[id]",
  teamMember: "team/[id]",
  teamInvitation: "team/invitations/[id]",
} as const;

before(async () => {
  database = setupIntegrationDatabase();

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ POST: registerPOST } = await import("../../src/app/api/auth/register/route"));
  ({ POST: verifyEmailPOST } = await import("../../src/app/api/auth/verify-email/route"));
  ({ POST: loginPOST } = await import("../../src/app/api/auth/login/route"));

  for (const [name, path] of Object.entries(ROUTE_PATHS)) {
    routes[name] = (await import(`../../src/app/api/${path}/route`)) as RouteModule;
  }

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

let ipCounter = 1;

function request(method: string, pathname: string, cookie?: string, body?: unknown) {
  return new NextRequest(`${ORIGIN}${pathname}`, {
    method,
    ...(body === undefined || method === "GET" ? {} : { body: JSON.stringify(body) }),
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "x-forwarded-host": "localhost:3000",
      "x-forwarded-for": `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
      ...(cookie ? { cookie } : {}),
    },
  });
}

async function registerOffice(label: string) {
  const email = `iso-${label}-${Date.now()}-${randomInt(1e6)}@example.com`;
  const password = "Integration#Pass1";

  const registered = await registerPOST(
    request("POST", "/api/auth/register", undefined, {
      tenantName: `ISO ${label}`,
      name: `Admin ${label}`,
      email,
      phone: `07${String(randomInt(1e8)).padStart(8, "0")}`,
      password,
      acceptTerms: true,
      acceptPrivacy: true,
    }),
  );
  assert.equal(registered.status, 201, await registered.clone().text());

  const verified = await verifyEmailPOST(
    request("POST", "/api/auth/verify-email", undefined, { email, code: verificationCodes.get(email) }),
  );
  assert.equal(verified.status, 200, await verified.clone().text());

  const loggedIn = await loginPOST(request("POST", "/api/auth/login", undefined, { email, password }));
  assert.equal(loggedIn.status, 200, await loggedIn.clone().text());
  const cookie = loggedIn.headers
    .getSetCookie()
    .find((value) => value.startsWith("ld_token="))!
    .split(";")[0];

  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, tenantId: true },
  });

  return { cookie, userId: user.id, tenantId: user.tenantId };
}

// Every row of office A, so "unchanged" can be checked exactly.
async function snapshot(tenantId: string) {
  const where = { tenantId };
  return JSON.stringify(
    await Promise.all([
      prisma.client.findMany({ where, orderBy: { id: "asc" } }),
      prisma.case.findMany({ where, orderBy: { id: "asc" } }),
      prisma.invoice.findMany({ where, orderBy: { id: "asc" }, include: { items: true } }),
      prisma.payment.findMany({ where, orderBy: { id: "asc" } }),
      prisma.appointment.findMany({ where, orderBy: { id: "asc" } }),
      prisma.task.findMany({ where, orderBy: { id: "asc" } }),
      prisma.document.findMany({ where, orderBy: { id: "asc" } }),
      prisma.notification.findMany({ where, orderBy: { id: "asc" } }),
      prisma.user.findMany({ where, orderBy: { id: "asc" } }),
      prisma.teamInvitation.findMany({ where, orderBy: { id: "asc" } }),
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.subscription.findMany({ where, orderBy: { id: "asc" } }),
    ]),
  );
}

test("office B's ADMIN cannot read, change or delete any of office A's records through [id] routes", async () => {
  const a = await registerOffice("victim");
  const b = await registerOffice("attacker");

  // B may use AI, so the summarize route gets as far as its record lookup.
  await prisma.tenant.update({
    where: { id: b.tenantId },
    data: {
      aiEnabled: true,
      aiConsentAt: new Date(),
      aiConsentBy: b.userId,
      aiConsentPolicyVersion: "2026-07-17",
    },
  });

  // --- office A's data ---------------------------------------------------
  const t = a.tenantId;
  const client = await prisma.client.create({ data: { tenantId: t, name: "A client" } });
  const legalCase = await prisma.case.create({
    data: { tenantId: t, clientId: client.id, leadLawyerId: a.userId, title: "A case", caseNumber: "A-1", feeAgreed: 1000 },
  });
  const invoice = await prisma.invoice.create({
    data: {
      tenantId: t,
      clientId: client.id,
      caseId: legalCase.id,
      invoiceNumber: "A-INV-1",
      subtotal: 100,
      total: 100,
      items: { create: { description: "Fee", quantity: 1, unitPrice: 100, total: 100 } },
    },
  });
  const payment = await prisma.payment.create({
    data: { tenantId: t, clientId: client.id, caseId: legalCase.id, amount: 50, paidAt: new Date() },
  });
  const appointment = await prisma.appointment.create({
    data: { tenantId: t, caseId: legalCase.id, title: "A hearing", startTime: new Date(), createdById: a.userId, assignedToId: a.userId },
  });
  const task = await prisma.task.create({
    data: { tenantId: t, caseId: legalCase.id, title: "A task", createdById: a.userId, assignedToId: a.userId },
  });
  const document = await prisma.document.create({
    data: {
      tenantId: t,
      caseId: legalCase.id,
      clientId: client.id,
      fileName: "a.pdf",
      fileType: "application/pdf",
      fileUrl: "https://res.cloudinary.com/test/a.pdf",
      publicId: `Viresto/${t}/documents/a`,
      fileSize: 100,
    },
  });
  const notification = await prisma.notification.create({
    data: { tenantId: t, userId: a.userId, titleAr: "ت", titleEn: "t", messageAr: "م", messageEn: "m" },
  });
  const member = await prisma.user.create({
    data: {
      tenantId: t,
      name: "A lawyer",
      email: `iso-member-${Date.now()}@example.com`,
      passwordHash: "x",
      role: "LAWYER",
      emailVerifiedAt: new Date(),
    },
  });
  const invitation = await prisma.teamInvitation.create({
    data: {
      tenantId: t,
      email: `iso-invite-${Date.now()}@example.com`,
      name: "Invitee",
      role: "LAWYER",
      tokenHash: `iso-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
      invitedById: a.userId,
    },
  });

  const before = await snapshot(t);

  const validClient = {
    name: "hijacked",
    phone: "0790000000",
    nationalId: "9990000000",
  };

  // [route, method, id, body, expected status]
  const calls: Array<[keyof typeof ROUTE_PATHS, "GET" | "POST" | "PATCH" | "DELETE", string, unknown, number]> = [
    ["case", "GET", legalCase.id, undefined, 404],
    ["case", "GET", String(legalCase.publicId), undefined, 404],
    ["case", "PATCH", legalCase.id, { title: "hijacked" }, 404],
    ["case", "PATCH", String(legalCase.publicId), { title: "hijacked" }, 404],
    ["case", "DELETE", legalCase.id, undefined, 404],
    ["case", "DELETE", String(legalCase.publicId), undefined, 404],

    ["client", "GET", client.id, undefined, 404],
    ["client", "GET", String(client.publicId), undefined, 404],
    ["client", "PATCH", client.id, validClient, 404],
    ["client", "PATCH", String(client.publicId), validClient, 404],
    ["client", "DELETE", client.id, undefined, 404],
    ["client", "DELETE", String(client.publicId), undefined, 404],
    ["clientFull", "GET", client.id, undefined, 404],
    ["clientFull", "GET", String(client.publicId), undefined, 404],

    ["invoice", "GET", invoice.id, undefined, 404],
    ["invoice", "GET", String(invoice.publicId), undefined, 404],
    ["invoice", "PATCH", invoice.id, { notes: "hijacked" }, 404],
    ["invoice", "PATCH", String(invoice.publicId), { notes: "hijacked" }, 404],
    ["invoice", "DELETE", invoice.id, undefined, 404],
    ["invoice", "DELETE", String(invoice.publicId), undefined, 404],

    ["payment", "PATCH", payment.id, { notes: "hijacked" }, 404],
    ["payment", "DELETE", payment.id, { cancellationReason: "hijacked payment" }, 404],

    ["appointment", "PATCH", appointment.id, { title: "hijacked" }, 404],
    ["appointment", "DELETE", appointment.id, undefined, 404],

    ["task", "PATCH", task.id, { title: "hijacked" }, 404],
    ["task", "DELETE", task.id, undefined, 404],

    ["document", "GET", document.id, undefined, 404],
    ["document", "DELETE", document.id, undefined, 404],
    ["documentPreview", "GET", document.id, undefined, 404],
    ["documentSummarize", "POST", document.id, {}, 404],

    ["notificationRead", "PATCH", notification.id, {}, 404],

    ["teamMember", "PATCH", member.id, { role: "STAFF" }, 404],
    ["teamMember", "DELETE", member.id, undefined, 404],
    ["teamInvitation", "DELETE", invitation.id, undefined, 404],

    // System-admin only: an office admin is refused before any lookup.
    ["adminTenant", "DELETE", t, { confirmation: "ISO victim", reason: "hijack attempt" }, 403],
    ["adminSubscription", "PATCH", t, { action: "END_NOW", reason: "hijack attempt" }, 403],
  ];

  const failures: string[] = [];

  for (const [route, method, id, body, expected] of calls) {
    const handler = routes[route][method];
    assert.ok(handler, `${route} has no ${method}`);

    const response = await handler(
      request(method, `/api/${ROUTE_PATHS[route].replace("[id]", id)}`, b.cookie, body),
      { params: Promise.resolve({ id }) },
    );
    const text = await response.text();

    if (response.status !== expected) {
      failures.push(`${method} ${route} (${id}) -> ${response.status}, expected ${expected}: ${text.slice(0, 200)}`);
    }

    // Nothing of A's may appear in a refusal.
    for (const secret of ["A client", "A case", "A-INV-1", "A hearing", "A task", "a.pdf", "A lawyer"]) {
      if (text.includes(secret)) failures.push(`${method} ${route} (${id}) leaked "${secret}"`);
    }
  }

  assert.deepEqual(failures, []);
  assert.equal(await snapshot(t), before, "office A's data is unchanged");
});
