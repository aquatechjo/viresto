// Classification for scripts/migrate-offices-to-app-trial.ts. Pure, so the
// grouping rules are unit-tested; the script only reads rows and applies.

export type LegacySubscriptionRow = {
  id: string;
  status: string;
  amount: number;
  polarSubscriptionId: string | null;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
};

export type LegacyTenantRow = {
  id: string;
  name: string;
  status: string;
  isSuspended: boolean;
  createdAt: Date;
  subscriptions: LegacySubscriptionRow[];
};

export type LegacyGroup =
  // (a) only the old signup trial (or nothing): gets a fresh 14-day trial.
  | "A_LEGACY_TRIAL"
  // (b) a non-Polar, non-trial subscription (admin-granted): list only.
  | "B_ADMIN_GRANTED"
  // (c) has a Polar subscription: untouched.
  | "C_POLAR"
  // Already on the new explicit trial (created after this release): skip.
  | "SKIP_NEW_TRIAL"
  // Suspended offices are never reactivated by a migration.
  | "SKIP_SUSPENDED";

/**
 * The pre-release signup trial: no Polar id, and either still TRIALING or
 * a zero-amount row with a trial end (e.g. later marked EXPIRED by hand).
 * Written before trialStartsAt existed, so that column is null.
 */
export function isLegacyTrialRow(row: LegacySubscriptionRow) {
  return (
    row.polarSubscriptionId === null &&
    row.trialStartsAt === null &&
    (row.status === "TRIALING" || (row.trialEndsAt !== null && row.amount === 0))
  );
}

export function classifyLegacyTenant(tenant: LegacyTenantRow): LegacyGroup {
  const subs = tenant.subscriptions;

  if (subs.some((row) => row.polarSubscriptionId !== null)) return "C_POLAR";

  if (tenant.isSuspended || tenant.status === "SUSPENDED") {
    return "SKIP_SUSPENDED";
  }

  if (
    subs.some(
      (row) =>
        row.polarSubscriptionId === null &&
        row.trialStartsAt !== null &&
        row.status === "TRIALING",
    )
  ) {
    return "SKIP_NEW_TRIAL";
  }

  if (subs.every(isLegacyTrialRow)) return "A_LEGACY_TRIAL";

  return "B_ADMIN_GRANTED";
}
