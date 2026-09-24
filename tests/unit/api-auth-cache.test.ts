import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// This suite exercises the real auth cache in src/lib/api-auth.ts (only
// @/lib/prisma is mocked, via node:test's native `mock.module()`, which
// requires --experimental-test-module-mocks). It proves:
//  (a) two validateSessionPayload calls for the same session within the TTL
//      window reuse the cache — only one session/user DB query pair fires.
//  (b) invalidateAuthCacheForSession/ForUser/ForTenant force a fresh DB read
//      on the very next call even though the TTL has not elapsed, so
//      logout/role-change/tenant-suspend don't wait out the cache window.

type SessionRow = {
  id: string;
  userId: string;
  tenantId: string;
  isActive: boolean;
  lastActivityAt: Date;
  createdAt: Date;
};

type UserRow = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  isSystemAdmin: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    isSuspended: boolean;
    status: string;
    trialEndsAt: Date | null;
  };
};

const SESSION_ID = "session-1";
const USER_ID = "user-1";
const TENANT_ID = "tenant-1";

function makeSessionRow(): SessionRow {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    tenantId: TENANT_ID,
    isActive: true,
    lastActivityAt: new Date(),
    createdAt: new Date(),
  };
}

function makeUserRow(): UserRow {
  return {
    id: USER_ID,
    tenantId: TENANT_ID,
    name: "Test User",
    email: "test@example.com",
    role: "ADMIN",
    isSystemAdmin: false,
    twoFactorEnabled: false,
    createdAt: new Date(),
    isActive: true,
    emailVerifiedAt: new Date(),
    tenant: {
      id: TENANT_ID,
      name: "Test Tenant",
      slug: "test-tenant",
      plan: "PRO",
      isSuspended: false,
      status: "ACTIVE",
      trialEndsAt: null,
    },
  };
}

const sessionFindUniqueMock = mock.fn<
  (...args: unknown[]) => Promise<SessionRow | null>
>(async () => makeSessionRow());
const userFindUniqueMock = mock.fn<
  (...args: unknown[]) => Promise<UserRow | null>
>(async () => makeUserRow());
const sessionUpdateManyMock = mock.fn<
  (...args: unknown[]) => Promise<{ count: number }>
>(async () => ({ count: 0 }));

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      session: {
        findUnique: sessionFindUniqueMock,
        updateMany: sessionUpdateManyMock,
      },
      user: {
        findUnique: userFindUniqueMock,
      },
    },
  },
});

let validateSessionPayload: (typeof import(
  "../../src/lib/api-auth"
))["validateSessionPayload"];
let invalidateAuthCacheForSession: (typeof import(
  "../../src/lib/api-auth"
))["invalidateAuthCacheForSession"];
let invalidateAuthCacheForUser: (typeof import(
  "../../src/lib/api-auth"
))["invalidateAuthCacheForUser"];
let invalidateAuthCacheForTenant: (typeof import(
  "../../src/lib/api-auth"
))["invalidateAuthCacheForTenant"];

before(async () => {
  ({
    validateSessionPayload,
    invalidateAuthCacheForSession,
    invalidateAuthCacheForUser,
    invalidateAuthCacheForTenant,
  } = await import("../../src/lib/api-auth"));
});

function tokenUser() {
  return {
    userId: USER_ID,
    tenantId: TENANT_ID,
    email: "test@example.com",
    name: "Test User",
    role: "ADMIN",
    sessionId: SESSION_ID,
  };
}

beforeEach(() => {
  sessionFindUniqueMock.mock.resetCalls();
  userFindUniqueMock.mock.resetCalls();
  sessionUpdateManyMock.mock.resetCalls();
  // Each test starts with a clean session identity so cache entries from
  // earlier tests can't leak in and mask a missed invalidation call.
  invalidateAuthCacheForSession(SESSION_ID, USER_ID, TENANT_ID);
});

test("two requests within the TTL window reuse the cache (one DB query pair)", async () => {
  const first = await validateSessionPayload(tokenUser());
  const second = await validateSessionPayload(tokenUser());

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(sessionFindUniqueMock.mock.callCount(), 1);
  assert.equal(userFindUniqueMock.mock.callCount(), 1);
});

test("invalidateAuthCacheForSession forces a fresh DB read before the TTL elapses", async () => {
  await validateSessionPayload(tokenUser());
  assert.equal(sessionFindUniqueMock.mock.callCount(), 1);

  invalidateAuthCacheForSession(SESSION_ID, USER_ID, TENANT_ID);

  await validateSessionPayload(tokenUser());
  assert.equal(sessionFindUniqueMock.mock.callCount(), 2);
  assert.equal(userFindUniqueMock.mock.callCount(), 2);
});

test("invalidateAuthCacheForUser forces a fresh DB read before the TTL elapses", async () => {
  await validateSessionPayload(tokenUser());
  assert.equal(sessionFindUniqueMock.mock.callCount(), 1);

  invalidateAuthCacheForUser(USER_ID);

  await validateSessionPayload(tokenUser());
  assert.equal(sessionFindUniqueMock.mock.callCount(), 2);
  assert.equal(userFindUniqueMock.mock.callCount(), 2);
});

test("invalidateAuthCacheForTenant forces a fresh DB read before the TTL elapses", async () => {
  await validateSessionPayload(tokenUser());
  assert.equal(sessionFindUniqueMock.mock.callCount(), 1);

  invalidateAuthCacheForTenant(TENANT_ID);

  await validateSessionPayload(tokenUser());
  assert.equal(sessionFindUniqueMock.mock.callCount(), 2);
  assert.equal(userFindUniqueMock.mock.callCount(), 2);
});

test("a read validates without extending the idle window", async () => {
  const staleActivity = new Date(Date.now() - 2 * 60 * 1000);
  sessionFindUniqueMock.mock.mockImplementationOnce(async () => ({
    ...makeSessionRow(),
    lastActivityAt: staleActivity,
  }));

  const result = await validateSessionPayload(tokenUser());

  assert.equal(result.ok, true);
  assert.equal(sessionUpdateManyMock.mock.callCount(), 0);
});

test("a write (touch: true) refreshes lastActivityAt once the touch interval has passed", async () => {
  const staleActivity = new Date(Date.now() - 2 * 60 * 1000);
  sessionFindUniqueMock.mock.mockImplementationOnce(async () => ({
    ...makeSessionRow(),
    lastActivityAt: staleActivity,
  }));

  const result = await validateSessionPayload(tokenUser(), { touch: true });

  assert.equal(result.ok, true);
  assert.equal(sessionUpdateManyMock.mock.callCount(), 1);
});

test("a session older than the absolute limit is rejected and deactivated", async () => {
  sessionFindUniqueMock.mock.mockImplementationOnce(async () => ({
    ...makeSessionRow(),
    createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
  }));

  const result = await validateSessionPayload(tokenUser());

  assert.equal(result.ok, false);
  assert.equal(sessionUpdateManyMock.mock.callCount(), 1);
  const [args] = sessionUpdateManyMock.mock.calls[0].arguments as [
    { data: { isActive: boolean } },
  ];
  assert.equal(args.data.isActive, false);
});
