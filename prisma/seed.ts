import { PrismaClient } from "@prisma/client";
import { PLANS } from "../src/config/plans";

const prisma = new PrismaClient();

const POLAR_PRODUCT_IDS: Record<
  string,
  { monthly: string; yearly: string }
> = {
  BASIC: {
    monthly: "81d737ab-79db-4344-9620-d1597aad8cfc",
    yearly: "a770f639-4c85-4a63-8959-8740fe86fc5b",
  },
  PRO: {
    monthly: "58c225c7-94e9-4e2b-a889-cd68e7f75b44",
    yearly: "8c63d1fa-7f37-4335-a3fa-799a680b6f91",
  },
  BUSINESS: {
    monthly: "93951622-9dba-4956-a8fb-4ec89fb69f0c",
    yearly: "4258aeba-fd71-488f-a1d7-302979b51ce9",
  },
};

const plans = PLANS.map((plan, index) => ({
  code: plan.code,
  name: plan.name,
  description: plan.description,
  currency: "JOD",
  priceMonthly: plan.priceJod * 1000,
  priceYearly: plan.priceYearlyJod * 1000,
  maxUsers: plan.limits.users,
  maxClients: plan.limits.clients,
  maxCases: plan.limits.cases,
  maxDocuments: 999999,
  maxStorageMb: plan.limits.storageGb * 1024,
  aiEnabled: plan.limits.aiEnabled,
  polarMonthlyProductId: POLAR_PRODUCT_IDS[plan.code]?.monthly ?? null,
  polarYearlyProductId: POLAR_PRODUCT_IDS[plan.code]?.yearly ?? null,
  sortOrder: index + 1,
}));

async function main() {
  console.log("Seeding the production-safe billing plan catalog...");

  await prisma.$transaction(
    plans.map((plan) =>
      prisma.billingPlan.upsert({
        where: { code: plan.code },
        update: plan,
        create: plan,
      }),
    ),
  );

  console.log(`Billing plan catalog synchronized (${plans.length} plans).`);
}

main()
  .catch((error) => {
    console.error("Billing plan seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
