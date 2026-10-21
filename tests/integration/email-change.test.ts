import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import { TEST_PRODUCTS } from "./helpers/polar";
import { apiRequest, createOfficeTools, sessionCookie } from "./helpers/offices";

// Changing the account email end to end (real Postgres and route handlers):
// a code to the current address, then one to the new address, then the
// change. The security notice must reach BOTH addresses, each in its own
// email: if an account is taken over, its real owner still hears about it
// at the address they had. Only outgoing email is mocked, to read codes and
// record what was sent.

const verificationCodes = new Map<string, string>();
const changeCodes = new Map<string, string>();
const completedNotices: Array<{
  to: unknown;
  accountEmail: string;
  previousEmail?: string;
  isOldEmail: boolean;
}> = [];

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
    sendEmailChangeCompletedEmail: async (input: (typeof completedNotices)[number]) => {
      completedNotices.push(input);
      return { skipped: true };
    },
  },
});

type Handler = (req: NextRequest) => Promise<Response>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let tools: ReturnType<typeof createOfficeTools>;
let changeEmailPOST: Handler;

before(async () => {
  database = setupIntegrationDatabase();

  ({ prisma } = await import("../../src/lib/prisma"));
  const post = async (name: string) => (await import(`../../src/app/api/auth/${name}/route`)).POST;
  changeEmailPOST = await post("change-email");

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

async function step(cookie: string, body: Record<string, unknown>) {
  const response = await changeEmailPOST(apiRequest("POST", "/api/auth/change-email", cookie, body));
  const json = await response.clone().json().catch(() => null);
  assert.equal(response.status, 200, JSON.stringify(json));
  return { response, data: json?.data ?? {} };
}

test("an email change notifies the old and the new address, each in its own email", async () => {
  const office = await tools.registerOffice("email-change");
  const oldEmail = office.email;
  const newEmail = `it-new-${Date.now()}@example.com`;

  const requested = await step(office.cookie, { action: "REQUEST_OLD_CODE" });
  const requestId = requested.data.requestId as string;
  assert.ok(changeCodes.get(oldEmail), "a code went to the current address");

  await step(office.cookie, { action: "VERIFY_OLD_CODE", requestId, code: changeCodes.get(oldEmail) });
  await step(office.cookie, { action: "REQUEST_NEW_CODE", requestId, newEmail });
  assert.ok(changeCodes.get(newEmail), "a code went to the new address");

  const confirmed = await step(office.cookie, {
    action: "CONFIRM_NEW_EMAIL",
    requestId,
    code: changeCodes.get(newEmail),
  });
  sessionCookie(confirmed.response); // the session that made the change stays signed in

  const user = await prisma.user.findUniqueOrThrow({ where: { id: office.userId }, select: { email: true } });
  assert.equal(user.email, newEmail);

  // Two separate notices, one recipient each (no CC/BCC, no array).
  assert.equal(completedNotices.length, 2);
  for (const notice of completedNotices) {
    assert.equal(typeof notice.to, "string", "a single recipient per email");
    assert.equal(notice.accountEmail, newEmail);
    assert.equal(notice.previousEmail, oldEmail);
  }

  const toOld = completedNotices.find((notice) => notice.to === oldEmail);
  const toNew = completedNotices.find((notice) => notice.to === newEmail);
  assert.ok(toOld, "the old address is told (the real owner, if the account was taken)");
  assert.equal(toOld.isOldEmail, true);
  assert.ok(toNew, "the new address is told");
  assert.equal(toNew.isOldEmail, false);
});
