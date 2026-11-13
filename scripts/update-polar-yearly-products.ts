/**
 * Points BillingPlan's yearly product ids at the new PRODUCTION Polar
 * yearly products (created 2026-11-13; the old ones were not checked
 * from here).
 *
 *   npx tsx --env-file=<production env file> scripts/update-polar-yearly-products.ts
 *       dry run (default): reads the three products from the Polar
 *       PRODUCTION API, checks them, matches each to BASIC/PRO/BUSINESS by
 *       name and price, and prints the BillingPlan rows before and after.
 *       Writes nothing.
 *
 *   ... scripts/update-polar-yearly-products.ts --apply --endpoint=ep-...
 *       writes the three polarYearlyProductId values in one transaction;
 *       --endpoint must name the database in DATABASE_URL.
 *
 * It refuses (no write, exit 1) when:
 *   - POLAR_ENVIRONMENT is not "production" (never pairs sandbox products
 *     with the production database, or the reverse);
 *   - any product cannot be read, or is not: interval year (count 1), one
 *     active fixed USD price equal to the plan's priceYearly, no trial,
 *     not archived;
 *   - name and price do not agree on one plan per product, one product
 *     per plan (the order of the ids below means nothing);
 *   - any Polar-linked YEARLY subscription is still running: it may be on
 *     an old yearly product, which the webhook would stop recognising;
 *   - a row changed between the read and the write.
 *
 * Before --apply: a Neon backup branch from production, and the user's
 * approval by name (CLAUDE.md). Run the dry run first and show its output.
 */

import { PrismaClient } from "@prisma/client";
import { Polar } from "@polar-sh/sdk";
import { databaseEndpointOf } from "../src/lib/contact-backfill";
import { planYearlyProductUpdate } from "../src/lib/yearly-product-update";

// The new production yearly products, as the user sent them (any order).
const NEW_YEARLY_PRODUCT_IDS = [
  "ed70c555-fe66-468f-86c2-a4e53da22b07",
  "0221e665-42e1-4724-8ca0-779eccca4767",
  "d125d2e1-3f06-4300-96f5-2e2523af97c2",
];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const endpointArg = args.find((a) => a.startsWith("--endpoint="))?.slice("--endpoint=".length);

function fail(message: string): never {
  console.error(`\nREFUSED: ${message}\nNothing was written.`);
  process.exit(1);
}

async function main() {
  if (process.env.POLAR_ENVIRONMENT !== "production") {
    fail(`POLAR_ENVIRONMENT is "${process.env.POLAR_ENVIRONMENT ?? ""}", expected "production".`);
  }
  if (!process.env.POLAR_ACCESS_TOKEN) fail("POLAR_ACCESS_TOKEN is not set.");

  const endpoint = databaseEndpointOf(process.env.DATABASE_URL);
  console.log(`Database endpoint: ${endpoint ?? "(unparseable DATABASE_URL)"}`);
  console.log(`Mode: ${apply ? "APPLY" : "dry run (nothing is written)"}\n`);

  if (apply && (!endpoint || endpointArg !== endpoint)) {
    fail(`--apply needs --endpoint=${endpoint ?? "<endpoint>"} typed out, to be sure of the target.`);
  }

  const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN, server: "production" });
  const products = [];
  for (const id of NEW_YEARLY_PRODUCT_IDS) {
    try {
      products.push(await polar.products.get({ id }));
    } catch (error) {
      fail(`product ${id} could not be read from Polar production (${(error as { statusCode?: number })?.statusCode ?? (error as Error)?.name}).`);
    }
  }

  console.log("Polar production products:");
  for (const p of products) {
    const price = p.prices.find((x) => !x.isArchived) as { priceAmount?: number; priceCurrency?: string } | undefined;
    console.log(
      `  ${p.id}  "${p.name}"  ${price?.priceAmount ?? "?"} ${price?.priceCurrency ?? ""}  every ${p.recurringIntervalCount ?? 1} ${p.recurringInterval ?? "?"}  trial=${p.trialInterval ? `${p.trialIntervalCount} ${p.trialInterval}` : "none"}  archived=${p.isArchived}`,
    );
  }

  const prisma = new PrismaClient();
  try {
    const plans = await prisma.billingPlan.findMany({
      select: { code: true, name: true, priceYearly: true, polarMonthlyProductId: true, polarYearlyProductId: true },
      orderBy: { sortOrder: "asc" },
    });
    const yearlySubscriptions = await prisma.subscription.findMany({
      where: { interval: "YEARLY", polarSubscriptionId: { not: null } },
      select: { id: true, tenantId: true, status: true, currentPeriodEnd: true },
    });

    console.log(`\nPolar-linked YEARLY subscriptions in this database: ${yearlySubscriptions.length}`);

    const plan = planYearlyProductUpdate({ products, plans, yearlySubscriptions });

    console.log("\nBillingPlan rows (before -> after):");
    console.log("  code      priceYearly  polarMonthlyProductId                 polarYearlyProductId");
    for (const row of plans) {
      const assignment = plan.ok ? plan.assignments.find((a) => a.code === row.code) : undefined;
      console.log(
        `  ${row.code.padEnd(9)} ${String(row.priceYearly).padEnd(12)} ${String(row.polarMonthlyProductId).padEnd(37)} ${row.polarYearlyProductId} -> ${assignment ? assignment.productId : "(unchanged)"}`,
      );
    }

    if (!plan.ok) {
      fail(`\n  - ${plan.problems.join("\n  - ")}`);
    }

    console.log("\nOld yearly ids (keep them for a rollback):");
    for (const a of plan.assignments) console.log(`  ${a.code}: ${a.before}`);

    if (!apply) {
      console.log("\nDry run only. Nothing was written.");
      return;
    }

    await prisma.$transaction(async (tx) => {
      for (const a of plan.assignments) {
        // Only if the row still holds what was shown above.
        const updated = await tx.billingPlan.updateMany({
          where: { code: a.code, polarYearlyProductId: a.before },
          data: { polarYearlyProductId: a.productId },
        });
        if (updated.count !== 1) throw new Error(`${a.code} changed since it was read`);
      }
    });

    const after = await prisma.billingPlan.findMany({
      select: { code: true, polarYearlyProductId: true },
      orderBy: { sortOrder: "asc" },
    });
    console.log("\nWritten. BillingPlan yearly ids now:");
    for (const row of after) console.log(`  ${row.code}: ${row.polarYearlyProductId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error("Nothing was written (the transaction rolls back on any error).");
  process.exit(1);
});
