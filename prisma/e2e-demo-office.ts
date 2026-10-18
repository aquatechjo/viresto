// The office the demo-mode E2E spec (tests/e2e/demo-mode.spec.ts) uses: an
// office on a fresh in-app trial, like one that just signed up, with one
// ADMIN. The spec subscribes it, so it is reset before every test, and
// `npm run seed:e2e` creates it. Dev/test databases only: callers guard.

import type { PrismaClient } from "@prisma/client";
import { buildAppTrial } from "../src/lib/tenant-access";
import { PRIVACY_VERSION, TERMS_VERSION } from "../src/lib/legal-policy";
import { getPlanByCode } from "../src/config/plans";

export const E2E_DEMO_EMAIL = "e2e-demo@example.com";
export const E2E_DEMO_TENANT_SLUG = "e2e-demo-office";
const E2E_DEMO_TENANT_NAME = "مكتب اختبار وضع التجربة E2E";

export async function resetE2eDemoOffice(prisma: PrismaClient, passwordHash: string) {
  const trialPlan = await prisma.billingPlan.findUnique({
    where: { code: "PRO" },
    select: { id: true },
  });
  if (!trialPlan) throw new Error("BillingPlan PRO is missing: run `npm run db:seed` first.");

  const existingUser = await prisma.user.findUnique({
    where: { email: E2E_DEMO_EMAIL },
    select: { tenant: { select: { slug: true } } },
  });
  if (existingUser && existingUser.tenant.slug !== E2E_DEMO_TENANT_SLUG) {
    throw new Error(`${E2E_DEMO_EMAIL} belongs to another office; refusing to modify it.`);
  }

  const trial = buildAppTrial();
  const users = getPlanByCode("PRO")?.limits.users ?? 5;

  return prisma.$transaction(async (tx) => {
    // Start over: the office, its sandbox and everything in them.
    await tx.tenant.deleteMany({ where: { slug: E2E_DEMO_TENANT_SLUG } });

    const tenant = await tx.tenant.create({
      data: {
        name: E2E_DEMO_TENANT_NAME,
        slug: E2E_DEMO_TENANT_SLUG,
        status: "TRIAL",
        plan: "PRO",
        maxUsers: users,
        trialEndsAt: trial.trialEndsAt,
        users: {
          create: {
            name: "مدير مكتب التجربة",
            email: E2E_DEMO_EMAIL,
            passwordHash,
            role: "ADMIN",
            isActive: true,
            emailVerifiedAt: trial.trialStartsAt,
            termsAcceptedAt: trial.trialStartsAt,
            termsVersion: TERMS_VERSION,
            privacyAcceptedAt: trial.trialStartsAt,
            privacyVersion: PRIVACY_VERSION,
          },
        },
      },
      select: { id: true },
    });

    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: trialPlan.id,
        ...trial,
        interval: "MONTHLY",
        amount: 0,
        currency: "USD",
      },
    });

    return { tenantId: tenant.id };
  });
}
