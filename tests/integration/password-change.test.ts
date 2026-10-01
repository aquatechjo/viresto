import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  dropIntegrationSchema,
  setupIntegrationDatabase,
  type IntegrationDatabase,
} from "./helpers/database";
import { TEST_PRODUCTS } from "./helpers/polar";
import { TEST_PASSWORD, apiRequest, createOfficeTools, sessionCookie } from "./helpers/offices";

// Changing the password from the profile page must end every other session
// and drop them from the auth cache, like password reset does, while the
// session that made the change stays signed in. Real Postgres and route
// handlers; only outgoing email is mocked (to read verification codes).

const verificationCodes = new Map<string, string>();

mock.module("@/lib/email", {
  namedExports: {
    sendVerificationEmail: async ({ to, code }: { to: string; code: string }) => {
      verificationCodes.set(to, code);
      return { skipped: true };
    },
  },
});

type Handler = (req: NextRequest) => Promise<Response>;

let database: IntegrationDatabase;
let prisma: typeof import("../../src/lib/prisma")["prisma"];
let tools: ReturnType<typeof createOfficeTools>;
let meGET: Handler;
let updateProfilePATCH: Handler;

before(async () => {
  database = setupIntegrationDatabase();
  // The other integration files run with the auth cache off. Here it is on
  // (read once at import), so a revoked session that is still cached shows.
  process.env.AUTH_CACHE_TTL_MS = "60000";

  ({ prisma } = await import("../../src/lib/prisma"));
  ({ GET: meGET } = await import("../../src/app/api/auth/me/route"));
  ({ PATCH: updateProfilePATCH } = await import("../../src/app/api/auth/update-profile/route"));
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

async function me(cookie: string) {
  return (await meGET(apiRequest("GET", "/api/auth/me", cookie))).status;
}

function updateProfile(cookie: string, body: unknown) {
  return updateProfilePATCH(apiRequest("PATCH", "/api/auth/update-profile", cookie, body));
}

test("changing the password ends other sessions and keeps the current one", async () => {
  const office = await tools.registerOffice("pw-change");
  const other = await tools.login(office.email);

  // Both sessions work, and the other one is now in the auth cache.
  assert.equal(await me(office.cookie), 200);
  assert.equal(await me(other), 200);

  const newPassword = "Changed#Pass2";
  const changed = await updateProfile(office.cookie, { currentPassword: TEST_PASSWORD, newPassword });
  assert.equal(changed.status, 200, await changed.clone().text());

  assert.equal(await me(other), 401, "other session still accepted after password change");
  assert.equal(await me(office.cookie), 200, "current session signed out");
  assert.equal(await me(sessionCookie(changed)), 200, "re-issued cookie rejected");

  const sessions = await prisma.session.findMany({
    where: { userId: office.userId, isActive: true },
    select: { id: true },
  });
  assert.equal(sessions.length, 1, "only the current session remains");

  // The new password works, the old one does not.
  await tools.login(office.email, newPassword);
});

test("a name-only profile update leaves other sessions alone", async () => {
  const office = await tools.registerOffice("name-change");
  const other = await tools.login(office.email);
  assert.equal(await me(other), 200);

  const renamed = await updateProfile(office.cookie, { name: "New Name" });
  assert.equal(renamed.status, 200, await renamed.clone().text());

  assert.equal(await me(other), 200);
  assert.equal(await me(office.cookie), 200);
});
