// Creates or updates the Playwright E2E user (tests/e2e) and its office.
//
//   npm run seed:e2e
//
// Reads E2E_TEST_EMAIL / E2E_TEST_PASSWORD (or E2E_EMAIL / E2E_PASSWORD) from
// .env.local. The user is an email-verified ADMIN of a dedicated, active
// office with an active PRO subscription, so the specs can log in and write.
// Re-running is safe: it resets the password and re-verifies the account.

import { loadEnvFile } from "node:process";

for (const file of [".env.local", ".env"]) {
  try {
    loadEnvFile(file);
  } catch {
    // Missing env file is fine; real environment variables still apply.
  }
}

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { getPlanByCode } from "../src/config/plans";
import { PRIVACY_VERSION, TERMS_VERSION } from "../src/lib/legal-policy";

const E2E_TENANT_SLUG = "e2e-test-office";
const E2E_TENANT_NAME = "مكتب اختبارات E2E";
const PLAN_CODE = "PRO";
const BCRYPT_COST = 12; // same as /api/auth/register

// Reserved test domains (RFC 2606 / 6761). Refusing anything else means this
// script can never reset the password of a real person's account.
const TEST_EMAIL_DOMAIN = /@(example\.(com|org|net)|[^@]+\.(test|invalid|example))$/i;

function fail(message: string): never {
  console.error(`seed:e2e — ${message}`);
  process.exit(1);
}

async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    fail("refusing to run in production.");
  }

  // NODE_ENV alone is not enough: a local .env once pointed DATABASE_URL at
  // the production Neon database. Require an explicit, per-database opt-in.
  let databaseHost = "";
  try {
    databaseHost = new URL(process.env.DATABASE_URL ?? "").host;
  } catch {
    fail("DATABASE_URL is missing or not a valid URL.");
  }

  const allowedHost = process.env.E2E_ALLOWED_DATABASE_HOST?.trim();
  if (!allowedHost) {
    fail(
      "set E2E_ALLOWED_DATABASE_HOST in .env.local to the host of your dev/test database " +
        "(e.g. ep-xxxx-pooler.<region>.aws.neon.tech). This guard keeps the seed off production.",
    );
  }
  if (databaseHost !== allowedHost) {
    fail(
      `DATABASE_URL points to ${databaseHost}, not the allowed E2E database ${allowedHost}; refusing.`,
    );
  }

  const email = (process.env.E2E_TEST_EMAIL || process.env.E2E_EMAIL || "")
    .trim()
    .toLowerCase();
  const password = process.env.E2E_TEST_PASSWORD || process.env.E2E_PASSWORD || "";

  if (!email || !password) {
    fail("set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local.");
  }

  if (!TEST_EMAIL_DOMAIN.test(email)) {
    fail(
      `"${email}" is not on a reserved test domain (e.g. @example.com); refusing to touch it.`,
    );
  }

  if (password.length < 8) {
    fail("E2E password must be at least 8 characters.");
  }

  const planConfig = getPlanByCode(PLAN_CODE);
  if (!planConfig) fail(`plan ${PLAN_CODE} is missing from src/config/plans.`);

  const prisma = new PrismaClient();

  try {
    const billingPlan = await prisma.billingPlan.findUnique({
      where: { code: PLAN_CODE },
      select: { id: true },
    });

    if (!billingPlan) {
      fail(`billing plan ${PLAN_CODE} not found — run "npm run db:seed" first.`);
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, tenant: { select: { slug: true } } },
    });

    if (existingUser && existingUser.tenant.slug !== E2E_TENANT_SLUG) {
      fail(
        `${email} already belongs to office "${existingUser.tenant.slug}", not the E2E office; refusing to modify it.`,
      );
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.upsert({
        where: { slug: E2E_TENANT_SLUG },
        create: {
          name: E2E_TENANT_NAME,
          slug: E2E_TENANT_SLUG,
          status: "ACTIVE",
          plan: "PRO",
          isSuspended: false,
          maxUsers: planConfig.limits.users,
        },
        update: {
          status: "ACTIVE",
          plan: "PRO",
          isSuspended: false,
          maxUsers: planConfig.limits.users,
          trialEndsAt: null,
        },
      });

      const subscription = await tx.subscription.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      const subscriptionData = {
        planId: billingPlan.id,
        status: "ACTIVE" as const,
        interval: "MONTHLY" as const,
        amount: 0,
        currency: "JOD",
        trialEndsAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      };

      if (subscription) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: subscriptionData,
        });
      } else {
        await tx.subscription.create({
          data: { tenantId: tenant.id, ...subscriptionData },
        });
      }

      const userData = {
        name: "E2E Test User",
        passwordHash,
        role: "ADMIN" as const,
        isActive: true,
        emailVerifiedAt: now,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        privacyAcceptedAt: now,
        privacyVersion: PRIVACY_VERSION,
      };

      const user = existingUser
        ? await tx.user.update({ where: { id: existingUser.id }, data: userData })
        : await tx.user.create({
            data: { ...userData, email, tenantId: tenant.id },
          });

      // A password reset should invalidate sessions made with the old one.
      await tx.session.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      });

      return { created: !existingUser, tenantSlug: tenant.slug };
    });

    console.log(
      `seed:e2e — ${result.created ? "created" : "updated"} ${email} ` +
        `(ADMIN, email verified) in office "${result.tenantSlug}" with an active ${PLAN_CODE} subscription.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("seed:e2e failed:", error);
  process.exit(1);
});
