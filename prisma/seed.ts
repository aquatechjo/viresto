import { PrismaClient } from "@prisma/client";
import { PLANS } from "../src/config/plans";

const prisma = new PrismaClient();

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
