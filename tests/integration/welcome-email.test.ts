import { test, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import { TEST_PRODUCTS } from "./helpers/polar";
import { apiRequest, createOfficeTools } from "./helpers/offices";
import { formatAmmanTime } from "../../src/lib/email/layout";
import { WELCOME_EMAIL_SUBJECT } from "../../src/lib/email/welcome-email";

// The welcome email end to end (real Postgres and route handlers): sent once
// per office, to its founder, on the founder's first email verification;
// never for a team member, never on an email change, and a failed send
// never fails the verification. Only outgoing HTTP to Resend and the other
// emails are mocked.

const verificationCodes = new Map<string, string>();
const changeCodes = new Map<string, string>();

mock.module("@/lib/email", {
  namedExports: {
    sendVerificationEmail: async ({ to, code }: { to: string; code: string }) => {
      verificationCodes.set(to, code);
      return { skipped: true };
    },
    sendEmailChangeCode: async ({ to, code }: { to: string; code: string }) => {
      changeCodes.set(to, code);
      return { skipped: true };
    },
    sendEmailChangeCompletedEmail: async () => ({ skipped: true }),
  },
});

type ResendCall = { headers: Record<string, string>; body: Record<string, unknown> };
const resendCalls: ResendCall[] = [];
let resendStatus = 200;

mock.module("@/lib/external-fetch", {
  namedExports: {
    externalFetch: async (_url: string, init: RequestInit) => {
      resendCalls.push({
        headers: init.headers as Record<string, string>,
        body: JSON.parse(String(init.body)),
      });
      return new Response(JSON.stringify({ id: `re_it_${resendCalls.length}` }), { status: resendStatus });
    },
  },
});

type Handler = (req: NextRequest) => Promise<Response>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let tools: ReturnType<typeof createOfficeTools>;
let verifyEmailPOST: Handler;
let changeEmailPOST: Handler;
let createVerificationCode: (typeof import("../../src/lib/verification"))["createVerificationCode"];

before(async () => {
  database = setupIntegrationDatabase();

  // After setup, which blanks every real key: these reach only the mock above.
  process.env.RESEND_API_KEY = "re_integration";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ createVerificationCode } = await import("../../src/lib/verification"));
  const post = async (name: string) => (await import(`../../src/app/api/auth/${name}/route`)).POST;
  verifyEmailPOST = await post("verify-email");
  changeEmailPOST = await post("change-email");

  tools = createOfficeTools({
    prisma,
    registerPOST: await post("register"),
    verifyEmailPOST,
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

beforeEach(() => {
  resendCalls.length = 0;
  resendStatus = 200;
});

function welcomeCalls() {
  return resendCalls.filter((call) => call.body.subject === WELCOME_EMAIL_SUBJECT);
}

test("the founder's first verification sends one welcome email, with the office's real data", async () => {
  const office = await tools.registerOffice("welcome");

  const calls = welcomeCalls();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.to, office.email);
  assert.equal(calls[0].headers["Idempotency-Key"], `welcome/${office.tenantId}`);

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: office.tenantId },
    select: { name: true, trialEndsAt: true, welcomeEmailSentAt: true },
  });
  const html = String(calls[0].body.html);
  assert.ok(html.includes(tenant.name), "the office's name from the DB");
  assert.ok(html.includes("أهلاً Admin welcome"), "the founder's name from the DB");
  assert.ok(html.includes(formatAmmanTime(tenant.trialEndsAt!)), "the office's real trial end");
  assert.match(html, /href="http:\/\/localhost:3000\/dashboard"/);
  assert.ok(tenant.welcomeEmailSentAt, "the office is marked as welcomed");
});

test("a team member verifying in the same office sends nothing", async () => {
  const office = await tools.registerOffice("welcome-team");
  resendCalls.length = 0;

  const memberEmail = `it-member-${Date.now()}@example.com`;
  const member = await prisma.user.create({
    data: {
      tenantId: office.tenantId,
      name: "Member",
      email: memberEmail,
      passwordHash: "x",
      role: "LAWYER",
      emailVerifiedAt: null,
    },
  });

  // Even with the office unmarked, a non-founder never triggers it.
  await prisma.tenant.update({ where: { id: office.tenantId }, data: { welcomeEmailSentAt: null } });

  const code = await createVerificationCode({ userId: member.id, type: "EMAIL" });
  const verified = await verifyEmailPOST(
    apiRequest("POST", "/api/auth/verify-email", undefined, { email: memberEmail, code }),
  );

  assert.equal(verified.status, 200, await verified.clone().text());
  assert.equal(welcomeCalls().length, 0);
});

test("changing the founder's email later sends no welcome", async () => {
  const office = await tools.registerOffice("welcome-change");
  await prisma.tenant.update({ where: { id: office.tenantId }, data: { welcomeEmailSentAt: null } });
  resendCalls.length = 0;

  const newEmail = `it-welcome-new-${Date.now()}@example.com`;
  const step = async (body: Record<string, unknown>) => {
    const response = await changeEmailPOST(apiRequest("POST", "/api/auth/change-email", office.cookie, body));
    const json = await response.clone().json().catch(() => null);
    assert.equal(response.status, 200, JSON.stringify(json));
    return json?.data ?? {};
  };

  const { requestId } = await step({ action: "REQUEST_OLD_CODE" });
  await step({ action: "VERIFY_OLD_CODE", requestId, code: changeCodes.get(office.email) });
  await step({ action: "REQUEST_NEW_CODE", requestId, newEmail });
  await step({ action: "CONFIRM_NEW_EMAIL", requestId, code: changeCodes.get(newEmail) });

  assert.equal(welcomeCalls().length, 0);
});

test("a failed send keeps verification working and leaves the office unmarked", async () => {
  resendStatus = 500;

  const office = await tools.registerOffice("welcome-fail");

  assert.equal(welcomeCalls().length, 1);
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: office.tenantId },
    select: { welcomeEmailSentAt: true },
  });
  assert.equal(tenant.welcomeEmailSentAt, null);
});
