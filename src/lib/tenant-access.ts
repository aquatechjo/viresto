import { SubscriptionStatus } from "@prisma/client";

// Single source of truth for "may this office use the app right now?".
// Pure (no DB) so it can be unit-tested; getTenantAccess() in
// tenant-access-server.ts feeds it rows from the database.

export const APP_TRIAL_DAYS = 14;
export const TRIAL_ENDING_SOON_DAYS = 3;
// A renewing Polar subscription can sit briefly past currentPeriodEnd while
// the renewal charge and its webhook are in flight. Never applies to
// subscriptions set to cancel at period end.
export const RENEWAL_GRACE_MS = 48 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessSubscription = {
  id: string;
  status: SubscriptionStatus | string;
  polarSubscriptionId: string | null;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
};

export type TenantAccessState = "PAID" | "TRIAL" | "LOCKED";

export type TenantLockReason =
  | "TRIAL_EXPIRED"
  | "SUBSCRIPTION_ENDED"
  | "CANCELLED"
  | "UNPAID"
  | "PAST_DUE"
  | "NO_SUBSCRIPTION";

export type TenantAccess = {
  state: TenantAccessState;
  lockReason: TenantLockReason | null;
  subscriptionId: string | null;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  trialDaysLeft: number | null;
};

/**
 * The in-app signup trial: a TRIALING row with no Polar subscription behind
 * it. Admin-granted subscriptions are never TRIALING, and Polar-side trials
 * always carry a polarSubscriptionId, so neither is mistaken for it.
 */
export function isAppTrial(
  subscription: Pick<AccessSubscription, "status" | "polarSubscriptionId">,
) {
  return (
    subscription.polarSubscriptionId === null &&
    subscription.status === SubscriptionStatus.TRIALING
  );
}

export function appTrialEndsAt(
  subscription: Pick<AccessSubscription, "trialEndsAt" | "currentPeriodEnd">,
) {
  return subscription.trialEndsAt ?? subscription.currentPeriodEnd;
}

export function daysLeftUntil(end: Date, now: Date) {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

export function isPaidSubscriptionEntitled(
  subscription: AccessSubscription,
  now: Date,
) {
  if (isAppTrial(subscription)) return false;

  if (
    subscription.status !== SubscriptionStatus.ACTIVE &&
    subscription.status !== SubscriptionStatus.TRIALING
  ) {
    return false;
  }

  if (!subscription.currentPeriodEnd) return true;

  const graceMs =
    subscription.polarSubscriptionId && !subscription.cancelAtPeriodEnd
      ? RENEWAL_GRACE_MS
      : 0;

  return now.getTime() < subscription.currentPeriodEnd.getTime() + graceMs;
}

function lockReasonFor(
  subscription: AccessSubscription | undefined,
): TenantLockReason {
  if (!subscription) return "NO_SUBSCRIPTION";
  if (isAppTrial(subscription)) return "TRIAL_EXPIRED";

  switch (subscription.status) {
    case SubscriptionStatus.CANCELLED:
      return "CANCELLED";
    case SubscriptionStatus.UNPAID:
      return "UNPAID";
    case SubscriptionStatus.PAST_DUE:
      return "PAST_DUE";
    default:
      return "SUBSCRIPTION_ENDED";
  }
}

export function resolveTenantAccess(
  subscriptions: AccessSubscription[],
  now: Date = new Date(),
): TenantAccess {
  const newestFirst = [...subscriptions].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const paid = newestFirst.find((item) =>
    isPaidSubscriptionEntitled(item, now),
  );

  if (paid) {
    return {
      state: "PAID",
      lockReason: null,
      subscriptionId: paid.id,
      trialStartsAt: null,
      trialEndsAt: null,
      trialDaysLeft: null,
    };
  }

  const trial = newestFirst.find(isAppTrial);
  const trialEnd = trial ? appTrialEndsAt(trial) : null;

  if (trial && trialEnd && now.getTime() < trialEnd.getTime()) {
    return {
      state: "TRIAL",
      lockReason: null,
      subscriptionId: trial.id,
      trialStartsAt: trial.trialStartsAt,
      trialEndsAt: trialEnd,
      trialDaysLeft: daysLeftUntil(trialEnd, now),
    };
  }

  // Locked. Report the newest *paid* subscription's state if there ever was
  // one (e.g. "cancelled"); otherwise the trial has simply run out.
  const newestPaid = newestFirst.find((item) => !isAppTrial(item));
  const reasonSource = newestPaid ?? trial ?? newestFirst[0];

  return {
    state: "LOCKED",
    lockReason: lockReasonFor(reasonSource),
    subscriptionId: reasonSource?.id ?? null,
    trialStartsAt: trial?.trialStartsAt ?? null,
    trialEndsAt: trialEnd ?? null,
    trialDaysLeft: trial ? 0 : null,
  };
}

export function isTrialEndingSoon(access: TenantAccess) {
  return (
    access.state === "TRIAL" &&
    access.trialDaysLeft !== null &&
    access.trialDaysLeft <= TRIAL_ENDING_SOON_DAYS
  );
}

export function buildAppTrial(now: Date = new Date()) {
  const trialEndsAt = new Date(now.getTime() + APP_TRIAL_DAYS * DAY_MS);

  return {
    status: SubscriptionStatus.TRIALING,
    trialStartsAt: now,
    trialEndsAt,
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
  };
}
