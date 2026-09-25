import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APP_TRIAL_DAYS,
  RENEWAL_GRACE_MS,
  buildAppTrial,
  isAppTrial,
  isTrialEndingSoon,
  resolveTenantAccess,
  type AccessSubscription,
} from "../../src/lib/tenant-access";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-01T12:00:00.000Z");

function at(offsetMs: number) {
  return new Date(NOW.getTime() + offsetMs);
}

function appTrial(overrides: Partial<AccessSubscription> = {}): AccessSubscription {
  return {
    id: "trial-1",
    status: "TRIALING",
    polarSubscriptionId: null,
    trialStartsAt: at(-5 * DAY),
    trialEndsAt: at(9 * DAY),
    currentPeriodEnd: at(9 * DAY),
    cancelAtPeriodEnd: false,
    createdAt: at(-5 * DAY),
    ...overrides,
  };
}

function polarSub(overrides: Partial<AccessSubscription> = {}): AccessSubscription {
  return {
    id: "paid-1",
    status: "ACTIVE",
    polarSubscriptionId: "polar_sub_1",
    trialStartsAt: null,
    trialEndsAt: null,
    currentPeriodEnd: at(20 * DAY),
    cancelAtPeriodEnd: false,
    createdAt: at(-1 * DAY),
    ...overrides,
  };
}

test("trial creation: buildAppTrial stores an explicit 14-day TRIALING window", () => {
  const trial = buildAppTrial(NOW);

  assert.equal(APP_TRIAL_DAYS, 14);
  assert.equal(trial.status, "TRIALING");
  assert.equal(trial.trialStartsAt.getTime(), NOW.getTime());
  assert.equal(trial.trialEndsAt.getTime(), NOW.getTime() + 14 * DAY);
  assert.equal(trial.currentPeriodStart.getTime(), NOW.getTime());
  assert.equal(trial.currentPeriodEnd.getTime(), trial.trialEndsAt.getTime());
  assert.equal(isAppTrial({ ...trial, polarSubscriptionId: null }), true);
});

test("an active in-app trial grants TRIAL access with days left", () => {
  const access = resolveTenantAccess([appTrial()], NOW);

  assert.equal(access.state, "TRIAL");
  assert.equal(access.trialDaysLeft, 9);
  assert.equal(access.lockReason, null);
  assert.equal(isTrialEndingSoon(access), false);
});

test("the last 3 days of the trial count as ending soon", () => {
  const access = resolveTenantAccess(
    [appTrial({ trialEndsAt: at(2 * DAY + 60_000) })],
    NOW,
  );

  assert.equal(access.state, "TRIAL");
  assert.equal(access.trialDaysLeft, 3);
  assert.equal(isTrialEndingSoon(access), true);
});

test("trial expiry lockout: an ended in-app trial with no payment is LOCKED", () => {
  const access = resolveTenantAccess(
    [appTrial({ trialEndsAt: at(-1000), currentPeriodEnd: at(-1000) })],
    NOW,
  );

  assert.equal(access.state, "LOCKED");
  assert.equal(access.lockReason, "TRIAL_EXPIRED");
  assert.equal(access.trialDaysLeft, 0);
});

test("a legacy in-app trial row without trialStartsAt is still treated as a trial", () => {
  const legacy = appTrial({ trialStartsAt: null, trialEndsAt: at(-DAY) });
  const access = resolveTenantAccess([legacy], NOW);

  assert.equal(isAppTrial(legacy), true);
  assert.equal(access.state, "LOCKED");
  assert.equal(access.lockReason, "TRIAL_EXPIRED");
});

test("no subscription at all is LOCKED with NO_SUBSCRIPTION", () => {
  const access = resolveTenantAccess([], NOW);
  assert.equal(access.state, "LOCKED");
  assert.equal(access.lockReason, "NO_SUBSCRIPTION");
});

test("a paid subscription wins over a still-running trial", () => {
  const access = resolveTenantAccess([appTrial(), polarSub()], NOW);
  assert.equal(access.state, "PAID");
  assert.equal(access.subscriptionId, "paid-1");
});

test("a Polar subscription in 'trialing' status is entitled (PAID, not the app trial)", () => {
  const access = resolveTenantAccess([polarSub({ status: "TRIALING" })], NOW);
  assert.equal(access.state, "PAID");
});

test("renewal grace: a renewing Polar subscription keeps access for 48h past period end", () => {
  const justEnded = polarSub({ currentPeriodEnd: at(-RENEWAL_GRACE_MS + 60_000) });
  assert.equal(resolveTenantAccess([justEnded], NOW).state, "PAID");

  const graceOver = polarSub({ currentPeriodEnd: at(-RENEWAL_GRACE_MS - 1) });
  const access = resolveTenantAccess([graceOver], NOW);
  assert.equal(access.state, "LOCKED");
  assert.equal(access.lockReason, "SUBSCRIPTION_ENDED");
});

test("cancel_at_period_end: access until period end exactly, no grace", () => {
  const beforeEnd = polarSub({ cancelAtPeriodEnd: true, currentPeriodEnd: at(1000) });
  assert.equal(resolveTenantAccess([beforeEnd], NOW).state, "PAID");

  const afterEnd = polarSub({ cancelAtPeriodEnd: true, currentPeriodEnd: at(-1000) });
  assert.equal(resolveTenantAccess([afterEnd], NOW).state, "LOCKED");
});

test("admin-granted subscriptions (no Polar id) get no renewal grace", () => {
  const adminGranted = polarSub({
    polarSubscriptionId: null,
    currentPeriodEnd: at(-1000),
  });
  assert.equal(resolveTenantAccess([adminGranted], NOW).state, "LOCKED");
});

test("a cancelled paid subscription locks with CANCELLED even if an old trial exists", () => {
  const access = resolveTenantAccess(
    [
      appTrial({ trialEndsAt: at(-30 * DAY), createdAt: at(-60 * DAY) }),
      polarSub({ status: "CANCELLED", currentPeriodEnd: at(-DAY) }),
    ],
    NOW,
  );

  assert.equal(access.state, "LOCKED");
  assert.equal(access.lockReason, "CANCELLED");
});
