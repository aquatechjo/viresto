// First step of `npm run build`. On Vercel production builds only, applies
// pending Prisma migrations (`prisma migrate deploy`, over DIRECT_URL)
// before the app is built, so a deploy never runs on an old schema. If
// anything here fails, the build fails and the previous deployment stays
// live. Preview builds, CI and local builds never migrate.

import { spawnSync } from "node:child_process";

const PREFIX = "[migrate-production]";
const env = process.env.VERCEL_ENV;

if (env !== "production") {
  console.log(`${PREFIX} skipped: VERCEL_ENV=${env ?? "unset"} (only production builds migrate)`);
  process.exit(0);
}

const directUrl = process.env.DIRECT_URL?.trim();
if (!directUrl) {
  console.error(`${PREFIX} DIRECT_URL is not set for Production; refusing to build.`);
  process.exit(1);
}

// 20260922020000_drop_subscription_payment drops this table. The runbook
// (docs/LAUNCH_RUNBOOK.md §4) requires it to be empty first; enforce that
// here instead of losing rows silently.
// Imported only now: importing @prisma/client loads a local .env, which
// must never stand in for Vercel's Production variables checked above.
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });
try {
  const [{ exists }] = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."SubscriptionPayment"') IS NOT NULL AS "exists"`,
  );
  if (exists) {
    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS "count" FROM "SubscriptionPayment"`,
    );
    if (count > 0) {
      console.error(
        `${PREFIX} "SubscriptionPayment" has ${count} row(s) and a pending migration drops it. ` +
          "Export them first (LAUNCH_RUNBOOK §4); refusing to migrate.",
      );
      process.exit(1);
    }
    console.log(`${PREFIX} "SubscriptionPayment" is empty: safe to drop.`);
  }
} finally {
  await prisma.$disconnect();
}

console.log(`${PREFIX} applying pending migrations (prisma migrate deploy)…`);
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
});

if (result.status !== 0) {
  console.error(`${PREFIX} prisma migrate deploy failed (exit ${result.status}); the build stops here.`);
  process.exit(result.status ?? 1);
}

console.log(`${PREFIX} done.`);
