import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
  hasUsableSessionId,
  sessionExpired,
  sessionMatchesToken,
  shouldTouchSession,
  userCanUseSession,
} from "../../src/lib/session-policy";

const nowMs = Date.parse("2026-07-18T12:00:00.000Z");
const identity = {
  userId: "user-1",
  tenantId: "tenant-1",
  sessionId: "session-1",
};

test("session identity requires a non-empty session id", () => {
  assert.equal(hasUsableSessionId(identity), true);
  assert.equal(hasUsableSessionId({ ...identity, sessionId: "" }), false);
  assert.equal(hasUsableSessionId({ ...identity, sessionId: "   " }), false);
  assert.equal(hasUsableSessionId({ ...identity, sessionId: undefined }), false);
});

test("session records must be active and match every token identity field", () => {
  const session = {
    userId: identity.userId,
    tenantId: identity.tenantId,
    isActive: true,
  };

  assert.equal(sessionMatchesToken(session, identity), true);
  assert.equal(sessionMatchesToken({ ...session, isActive: false }, identity), false);
  assert.equal(
    sessionMatchesToken({ ...session, userId: "other-user" }, identity),
    false,
  );
  assert.equal(
    sessionMatchesToken({ ...session, tenantId: "other-tenant" }, identity),
    false,
  );
  assert.equal(
    sessionMatchesToken(session, { ...identity, sessionId: undefined }),
    false,
  );
  assert.equal(sessionMatchesToken(null, identity), false);
});

test("idle timeout expires only after five complete minutes", () => {
  assert.equal(
    sessionExpired(new Date(nowMs - SESSION_IDLE_TIMEOUT_MS), nowMs),
    false,
  );
  assert.equal(
    sessionExpired(new Date(nowMs - SESSION_IDLE_TIMEOUT_MS - 1), nowMs),
    true,
  );
  assert.equal(sessionExpired(null, nowMs), true);
  assert.equal(sessionExpired(new Date(Number.NaN), nowMs), true);
});

test("session touch is requested only after one complete minute", () => {
  assert.equal(
    shouldTouchSession(new Date(nowMs - SESSION_TOUCH_INTERVAL_MS), nowMs),
    false,
  );
  assert.equal(
    shouldTouchSession(
      new Date(nowMs - SESSION_TOUCH_INTERVAL_MS - 1),
      nowMs,
    ),
    true,
  );
  assert.equal(shouldTouchSession(null, nowMs), true);
});

test("users need an active verified account in an unsuspended tenant", () => {
  const user = {
    tenantId: identity.tenantId,
    isActive: true,
    emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z"),
    tenant: {
      isSuspended: false,
      status: "ACTIVE",
    },
  };

  assert.equal(userCanUseSession(user, identity.tenantId), true);
  assert.equal(userCanUseSession({ ...user, isActive: false }, identity.tenantId), false);
  assert.equal(
    userCanUseSession({ ...user, emailVerifiedAt: null }, identity.tenantId),
    false,
  );
  assert.equal(
    userCanUseSession(
      { ...user, tenant: { ...user.tenant, isSuspended: true } },
      identity.tenantId,
    ),
    false,
  );
  assert.equal(
    userCanUseSession(
      { ...user, tenant: { ...user.tenant, status: "SUSPENDED" } },
      identity.tenantId,
    ),
    false,
  );
  assert.equal(userCanUseSession(user, "other-tenant"), false);
  assert.equal(userCanUseSession(null, identity.tenantId), false);
});
