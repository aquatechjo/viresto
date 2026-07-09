const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function main() {
  const tenantId = process.argv[2];
  const planCode = (process.argv[3] || "PRO").toUpperCase();
  const months = Number(process.argv[4] || 1);

  if (!tenantId) {
    throw new Error(
      "Usage: node scripts/activate-subscription-by-tenant-id.js tenantId PRO 1",
    );
  }

  if (!Number.isFinite(months) || months < 1) {
    throw new Error("Months must be a positive number");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, email: true, status: true },
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
  const end = addMonths(now, months);

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { status: "ACTIVE" },
  });

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
        currentPeriodEnd: end,
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
        currentPeriodEnd: end,
      },
    });
  }

  console.log(`Activated ${planCode} for ${tenant.name} until ${end.toISOString()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
