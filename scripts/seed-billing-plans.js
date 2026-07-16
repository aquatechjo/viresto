const { PrismaClient } = require("@prisma/client");
require("tsx/cjs");
const { PLANS } = require("../src/config/plans.ts");

const prisma = new PrismaClient();

// Prices and limits come from the same catalog used by pricing and enforcement.
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
  for (const plan of plans) {
    await prisma.billingPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  console.log("Billing plans seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
