import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Exercises the real requireAuth/requireRole in src/lib/api-auth.ts plus the
// real tenant-access resolver. Only the JWT check (@/lib/auth) and prisma
// are mocked. Proves the trial-expiry lockout is enforced server-side for
// every tenant API route, while billing/account routes stay reachable.

const DAY = 24 * 60 * 60 * 1000;
const TENANT_ID = "tenant-lock";
const USER_ID = "user-lock";
const SESSION_ID = "session-lock";

let isSystemAdmin = false;
let subscriptions: Record<string, unknown>[] = [];

function expiredTrial() {
  return {
    id: "trial-1",
    status: "TRIALING",
    polarSubscriptionId: null,
    trialStartsAt: new Date(Date.now() - 15 * DAY),
    trialEndsAt: new Date(Date.now() - DAY),
    currentPeriodEnd: new Date(Date.now() - DAY),
    cancelAtPeriodEnd: false,
    createdAt: new Date(Date.now() - 15 * DAY),
  };
}

function activeTrial() {
  return {
    ...expiredTrial(),
    trialEndsAt: new Date(Date.now() + 5 * DAY),
    currentPeriodEnd: new Date(Date.now() + 5 * DAY),
  };
}

function paidSubscription() {
  return {
    id: "paid-1",
    status: "ACTIVE",
    polarSubscriptionId: "polar_sub_1",
    trialStartsAt: null,
    trialEndsAt: null,
    currentPeriodEnd: new Date(Date.now() + 30 * DAY),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
  };
}

const subscriptionFindManyMock = mock.fn(async () => subscriptions);

mock.module("@/lib/auth", {
  namedExports: {
    COOKIE: "ld_token",
    verifyToken: async () => ({
      userId: USER_ID,
      tenantId: TENANT_ID,
      email: "u@example.com",
      name: "U",
      role: "ADMIN",
      sessionId: SESSION_ID,
    }),
  },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      session: {
        findUnique: async () => ({
          id: SESSION_ID,
          userId: USER_ID,
          tenantId: TENANT_ID,
          isActive: true,
          lastActivityAt: new Date(),
          createdAt: new Date(),
        }),
        updateMany: async () => ({ count: 0 }),
      },
      user: {
        findUnique: async () => ({
          id: USER_ID,
          tenantId: TENANT_ID,
          name: "U",
          email: "u@example.com",
          role: "ADMIN",
          isSystemAdmin,
          twoFactorEnabled: false,
          createdAt: new Date(),
          isActive: true,
          emailVerifiedAt: new Date(),
          tenant: {
            id: TENANT_ID,
            name: "T",
            slug: "t",
            plan: "PRO",
            isSuspended: false,
            status: "TRIAL",
            trialEndsAt: null,
          },
        }),
      },
      subscription: { findMany: subscriptionFindManyMock },
    },
  },
});

let requireAuth: (typeof import("../../src/lib/api-auth"))["requireAuth"];
let requireRole: (typeof import("../../src/lib/api-auth"))["requireRole"];
let invalidateAuthCacheForTenant: (typeof import(
  "../../src/lib/api-auth"
))["invalidateAuthCacheForTenant"];

before(async () => {
  ({ requireAuth, requireRole, invalidateAuthCacheForTenant } = await import(
    "../../src/lib/api-auth"
  ));
});

beforeEach(() => {
  isSystemAdmin = false;
  subscriptions = [expiredTrial()];
  invalidateAuthCacheForTenant(TENANT_ID);
});

function request(path: string, method = "GET") {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { cookie: "ld_token=test-token" },
  });
}

async function lockedBody(response: Response | null) {
  assert.ok(response, "expected an error response");
  assert.equal(response.status, 402);
  return response.json();
}

for (const [path, method] of [
  ["/api/cases", "GET"],
  ["/api/clients", "POST"],
  ["/api/documents/doc-1/preview", "GET"],
  ["/api/notifications", "GET"],
  ["/api/settings", "PATCH"],
]) {
  test(`trial expiry lockout: ${method} ${path} answers 402 SUBSCRIPTION_REQUIRED`, async () => {
    const auth = await requireAuth(request(path, method));
    const body = await lockedBody(auth.error);

    assert.equal(auth.user, null);
    assert.equal(body.details.code, "SUBSCRIPTION_REQUIRED");
    assert.equal(body.details.reason, "TRIAL_EXPIRED");
  });
}

test("trial expiry lockout also applies through requireRole", async () => {
  const auth = await requireRole(request("/api/team", "POST"), ["ADMIN"]);
  await lockedBody(auth.error);
});

for (const [path, method] of [
  ["/api/billing", "GET"],
  ["/api/billing/checkout", "POST"],
  ["/api/billing/access", "GET"],
  ["/api/auth/me", "GET"],
  ["/api/auth/logout", "POST"],
  ["/api/auth/update-profile", "PATCH"],
  ["/api/auth/session/activity", "POST"],
  ["/api/settings", "GET"],
]) {
  test(`a locked office can still reach ${method} ${path}`, async () => {
    const auth = await requireAuth(request(path, method));
    assert.equal(auth.error, null);
    assert.equal(auth.user?.tenantId, TENANT_ID);
  });
}

test("an office still inside its trial is not locked", async () => {
  subscriptions = [activeTrial()];
  const auth = await requireAuth(request("/api/cases"));
  assert.equal(auth.error, null);
});

test("system admins are never locked out", async () => {
  isSystemAdmin = true;
  const auth = await requireAuth(request("/api/cases"));
  assert.equal(auth.error, null);
});

test("paying unlocks immediately: tenant invalidation drops the cached lock", async () => {
  await lockedBody((await requireAuth(request("/api/cases"))).error);

  subscriptions = [paidSubscription(), expiredTrial()];
  invalidateAuthCacheForTenant(TENANT_ID);

  const auth = await requireAuth(request("/api/cases"));
  assert.equal(auth.error, null);
});
