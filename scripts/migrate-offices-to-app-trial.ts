/**
 * One-off: move offices created before the explicit in-app trial onto it.
 *
 *   npx tsx scripts/migrate-offices-to-app-trial.ts            # dry run (default)
 *   npx tsx scripts/migrate-offices-to-app-trial.ts --apply    # writes
 *
 * Reads DATABASE_URL from the environment (load .env yourself, e.g.
 * `npx tsx --env-file=.env ...`). Prints the target host first.
 *
 * Groups (src/lib/legacy-trial-migration.ts):
 *   (a) old signup trial only, or no subscription: fresh 14-day trial
 *       starting now (the only group --apply changes)
 *   (b) admin-granted (non-Polar) subscription: listed, never changed
 *   (c) has a Polar subscription: counted, never changed
 *   skipped: suspended offices, offices already on the new trial
 *
 * --apply only updates or creates Subscription rows and the tenant's trial
 * mirror; it never deletes anything and never touches (b), (c) or
 * suspended offices. Safe to re-run: migrated offices then have
 * trialStartsAt set and are skipped.
 */
import { PrismaClient } from "@prisma/client";
import {
  classifyLegacyTenant,
  isLegacyTrialRow,
  type LegacyGroup,
} from "../src/lib/legacy-trial-migration";
import { buildAppTrial } from "../src/lib/tenant-access";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

function fmt(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "-";
}

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "(unparseable DATABASE_URL)";
    }
  })();

  console.log(`Mode: ${apply ? "APPLY (writes)" : "DRY RUN (no writes)"}`);
  console.log(`Database host: ${host}\n`);

  const proPlan = await prisma.billingPlan.findUnique({
    where: { code: "PRO" },
    select: { id: true },
  });
  if (!proPlan) throw new Error("BillingPlan PRO not found. Run db:seed first.");

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      isSuspended: true,
      createdAt: true,
      subscriptions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          amount: true,
          polarSubscriptionId: true,
          trialStartsAt: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          createdAt: true,
        },
      },
    },
  });

  const groups = new Map<LegacyGroup, typeof tenants>();
  for (const tenant of tenants) {
    const group = classifyLegacyTenant(tenant);
    groups.set(group, [...(groups.get(group) ?? []), tenant]);
  }

  const a = groups.get("A_LEGACY_TRIAL") ?? [];
  const b = groups.get("B_ADMIN_GRANTED") ?? [];

  console.log(`Offices total:                          ${tenants.length}`);
  console.log(`(a) legacy trial / no subscription:     ${a.length}  -> fresh 14-day trial`);
  console.log(`(b) admin-granted, no Polar:            ${b.length}  -> list only`);
  console.log(`(c) Polar subscription:                 ${(groups.get("C_POLAR") ?? []).length}  -> untouched`);
  console.log(`skipped, already on new trial:          ${(groups.get("SKIP_NEW_TRIAL") ?? []).length}`);
  console.log(`skipped, suspended:                     ${(groups.get("SKIP_SUSPENDED") ?? []).length}\n`);

  console.log("(a) offices:");
  for (const tenant of a) {
    const latest = tenant.subscriptions[0];
    console.log(
      `  ${tenant.id}  created ${fmt(tenant.createdAt)}  "${tenant.name}"  ` +
        (latest
          ? `trial ${latest.status} ends ${fmt(latest.trialEndsAt ?? latest.currentPeriodEnd)}`
          : "no subscription"),
    );
  }

  console.log("\n(b) offices (NOT changed; decide each one):");
  for (const tenant of b) {
    const latest = tenant.subscriptions.find((row) => !isLegacyTrialRow(row));
    console.log(
      `  ${tenant.id}  created ${fmt(tenant.createdAt)}  "${tenant.name}"  ` +
        `${latest?.status ?? "?"} until ${fmt(latest?.currentPeriodEnd)}`,
    );
  }

  if (!apply) {
    console.log("\nDry run: nothing was written. Re-run with --apply to migrate group (a).");
    return;
  }

  const now = new Date();
  const trial = buildAppTrial(now);
  let migrated = 0;

  for (const tenant of a) {
    await prisma.$transaction(async (tx) => {
      const legacy = tenant.subscriptions[0];
      const trialFields = {
        ...trial,
        amount: 0,
        currency: "USD",
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      };

      if (legacy) {
        await tx.subscription.update({
          where: { id: legacy.id },
          data: trialFields,
        });
      } else {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: proPlan.id,
            interval: "MONTHLY",
            ...trialFields,
          },
        });
      }

      await tx.tenant.update({
        where: { id: tenant.id },
        data: { status: "TRIAL", trialEndsAt: trial.trialEndsAt },
      });
    });

    migrated += 1;
  }

  console.log(
    `\nApplied: ${migrated} office(s) now on a 14-day trial ending ${trial.trialEndsAt.toISOString()}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
