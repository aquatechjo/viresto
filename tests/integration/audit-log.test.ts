import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import speakeasy from "speakeasy";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import { TEST_PRODUCTS } from "./helpers/polar";
import { ORIGIN, TEST_PASSWORD, apiRequest, createOfficeTools } from "./helpers/offices";
import { NextRequest } from "next/server";

// AUDIT_REPORT.md M3: audit events for account security actions, and the
// retention rules of the daily prune cron. Real Postgres and route
// handlers; only outgoing email is mocked (to read codes).

const verificationCodes = new Map<string, string>();
const resetCodes = new Map<string, string>();

mock.module("@/lib/email", {
  namedExports: {
    sendVerificationEmail: async ({ to, code }: { to: string; code: string }) => {
      verificationCodes.set(to, code);
      return { skipped: true };
    },
    sendPasswordResetEmail: async ({ to, code }: { to: string; code: string }) => {
      resetCodes.set(to, code);
      return { skipped: true };
    },
  },
});

const CRON_SECRET = "integration-cron-secret-000000000000001";

type Post = (req: NextRequest) => Promise<Response>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let decryptText: typeof import("../../src/lib/encryption")["decryptText"];
let tools: ReturnType<typeof createOfficeTools>;
const post: Record<string, Post> = {};
let pruneGET: (req: NextRequest) => Promise<Response>;
let updateProfilePATCH: (req: NextRequest) => Promise<Response>;

before(async () => {
  database = setupIntegrationDatabase();
  process.env.CRON_SECRET = CRON_SECRET;

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ decryptText } = await import("../../src/lib/encryption"));

  for (const name of [
    "register",
    "verify-email",
    "login",
    "forgot-password",
    "reset-password",
    "2fa/setup",
    "2fa/verify",
    "2fa/disable",
    "session/revoke",
    "session/revoke-others",
  ]) {
    post[name] = (await import(`../../src/app/api/auth/${name}/route`)).POST;
  }
  ({ PATCH: updateProfilePATCH } = await import("../../src/app/api/auth/update-profile/route"));
  ({ GET: pruneGET } = await import("../../src/app/api/cron/prune-activity/route"));

  tools = createOfficeTools({
    prisma,
    registerPOST: post.register,
    verifyEmailPOST: post["verify-email"],
    loginPOST: post.login,
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

async function activityTypes(tenantId: string) {
  const rows = await prisma.activity.findMany({
    where: { tenantId },
    select: { type: true, actorId: true },
  });
  return rows;
}

function has(rows: Array<{ type: string }>, type: string) {
  return rows.some((row) => row.type === type);
}

test("security actions leave audit events: reset, change password, 2FA on/off, session revokes", async () => {
  const office = await tools.registerOffice("audit-auth");

  // --- 2FA enable / disable (real TOTP codes) -----------------------------
  const setup = await post["2fa/setup"](
    apiRequest("POST", "/api/auth/2fa/setup", office.cookie, { password: TEST_PASSWORD }),
  );
  assert.equal(setup.status, 200, await setup.clone().text());
  const stored = await prisma.user.findUniqueOrThrow({
    where: { id: office.userId },
    select: { twoFactorSecret: true },
  });
  const secret = decryptText(stored.twoFactorSecret)!;
  const totp = () => speakeasy.totp({ secret, encoding: "base32" });

  const enabled = await post["2fa/verify"](
    apiRequest("POST", "/api/auth/2fa/verify", office.cookie, { code: totp() }),
  );
  assert.equal(enabled.status, 200, await enabled.clone().text());

  const disabled = await post["2fa/disable"](
    apiRequest("POST", "/api/auth/2fa/disable", office.cookie, { password: TEST_PASSWORD, code: totp() }),
  );
  assert.equal(disabled.status, 200, await disabled.clone().text());

  // --- password change ----------------------------------------------------
  const newPassword = "Changed#Pass2";
  const changed = await updateProfilePATCH(
    new NextRequest(`${ORIGIN}/api/auth/update-profile`, {
      method: "PATCH",
      body: JSON.stringify({ currentPassword: TEST_PASSWORD, newPassword }),
      headers: apiRequest("PATCH", "/api/auth/update-profile", office.cookie).headers,
    }),
  );
  assert.equal(changed.status, 200, await changed.clone().text());

  // --- sessions: revoke one, then all others ------------------------------
  const second = await tools.login(office.email, newPassword);
  const secondSession = await prisma.session.findFirstOrThrow({
    where: { userId: office.userId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  assert.ok(second);
  const revoked = await post["session/revoke"](
    apiRequest("POST", "/api/auth/session/revoke", office.cookie, { sessionId: secondSession.id }),
  );
  assert.equal(revoked.status, 200, await revoked.clone().text());

  await tools.login(office.email, newPassword);
  const revokedOthers = await post["session/revoke-others"](
    apiRequest("POST", "/api/auth/session/revoke-others", office.cookie, {}),
  );
  assert.equal(revokedOthers.status, 200, await revokedOthers.clone().text());

  // --- forgot + reset password --------------------------------------------
  const forgot = await post["forgot-password"](
    apiRequest("POST", "/api/auth/forgot-password", undefined, { email: office.email }),
  );
  assert.equal(forgot.status, 200, await forgot.clone().text());
  const reset = await post["reset-password"](
    apiRequest("POST", "/api/auth/reset-password", undefined, {
      email: office.email,
      code: resetCodes.get(office.email),
      password: "ResetPass#3",
    }),
  );
  assert.equal(reset.status, 200, await reset.clone().text());

  const rows = await activityTypes(office.tenantId);
  for (const type of [
    "TWO_FACTOR_ENABLED",
    "TWO_FACTOR_DISABLED",
    "PASSWORD_CHANGED",
    "SESSION_REVOKED",
    "SESSIONS_REVOKED",
    "PASSWORD_RESET",
  ]) {
    assert.ok(has(rows, type), `missing ${type}; have ${rows.map((row) => row.type).join(", ")}`);
    assert.equal(
      rows.find((row) => row.type === type)?.actorId,
      office.userId,
      `${type} actor`,
    );
  }
});

test("prune keeps audit events for a year and routine events for 30 days", async () => {
  const office = await tools.registerOffice("audit-prune");
  const day = 24 * 60 * 60 * 1000;
  const at = (daysAgo: number) => new Date(Date.now() - daysAgo * day);

  const seed: Array<[string, number]> = [
    // audit, 100 days old: kept
    ["CASE_DELETED", 100],
    ["PAYMENT_UPDATED", 100],
    ["BILLING_PLAN_CHANGED", 100],
    ["SYSTEM_ADMIN_SUBSCRIPTION_END_NOW", 100],
    ["TEAM_MEMBER_UPDATED", 100],
    ["PASSWORD_RESET", 100],
    // audit, 400 days old: pruned
    ["CASE_DELETED", 400],
    ["SYSTEM_ADMIN_TENANT_SUSPENDED", 400],
    // routine, 40 days old: pruned
    ["CASE_UPDATED", 40],
    ["DOCUMENT_VIEWED", 40],
    // routine, 10 days old: kept
    ["CASE_UPDATED", 10],
  ];

  await prisma.activity.createMany({
    data: seed.map(([type, daysAgo]) => ({
      tenantId: office.tenantId,
      type,
      title: `${type} ${daysAgo}d`,
      createdAt: at(daysAgo),
    })),
  });

  const response = await pruneGET(
    new NextRequest(`${ORIGIN}/api/cron/prune-activity`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }),
  );
  assert.equal(response.status, 200, await response.clone().text());

  const remaining = (
    await prisma.activity.findMany({
      where: { tenantId: office.tenantId, title: { contains: "d" }, createdAt: { lt: at(5) } },
      select: { title: true },
    })
  )
    .map((row) => row.title)
    .sort();

  assert.deepEqual(remaining, [
    "BILLING_PLAN_CHANGED 100d",
    "CASE_DELETED 100d",
    "CASE_UPDATED 10d",
    "PASSWORD_RESET 100d",
    "PAYMENT_UPDATED 100d",
    "SYSTEM_ADMIN_SUBSCRIPTION_END_NOW 100d",
    "TEAM_MEMBER_UPDATED 100d",
  ]);
});
