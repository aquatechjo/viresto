const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function main() {
  const tenantEmail = process.argv[2];
  const planCode = (process.argv[3] || "PRO").toUpperCase();
  const months = Number(process.argv[4] || 1);

  if (!tenantEmail) {
    throw new Error("Usage: node scripts/activate-subscription.js tenant@email.com PRO 1");
  }

  const tenant = await prisma.tenant.findFirst({
    where: { email: tenantEmail },
    select: { id: true, name: true, email: true },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const plan = await prisma.billingPlan.findFirst({
    where: { code: planCode, isActive: true },
  });

  if (!plan) {
    throw new Error("Billing plan not found");
  }

  const now = new Date();

  const existing = await prisma.subscription.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        provider: "MANUAL",
        status: "ACTIVE",
        interval: "MONTHLY",
        currency: plan.currency,
        amount: plan.priceMonthly,
        currentPeriodStart: now,
        currentPeriodEnd: addMonths(now, months),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        provider: "MANUAL",
        status: "ACTIVE",
        interval: "MONTHLY",
        currency: plan.currency,
        amount: plan.priceMonthly,
        currentPeriodStart: now,
        currentPeriodEnd: addMonths(now, months),
      },
    });
  }

  console.log(`Activated ${planCode} for ${tenant.name} until ${addMonths(now, months).toISOString()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  