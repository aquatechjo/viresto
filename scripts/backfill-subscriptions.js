const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function mapLegacyPlanToBillingCode(plan) {
  if (plan === 'FREE') return 'BASIC'
  if (plan === 'ENTERPRISE') return 'BUSINESS'
  return 'PRO'
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      plan: true,
      trialEndsAt: true,
      createdAt: true,
      subscriptions: {
        select: { id: true },
        take: 1,
      },
    },
  })

  let created = 0
  let skipped = 0

  for (const tenant of tenants) {
    if (tenant.subscriptions.length > 0) {
      skipped++
      continue
    }

    const planCode = mapLegacyPlanToBillingCode(tenant.plan)

    const billingPlan = await prisma.billingPlan.findUnique({
      where: { code: planCode },
    })

    if (!billingPlan) {
      throw new Error(`Missing BillingPlan with code: ${planCode}`)
    }

    const now = new Date()
    const trialEndsAt = tenant.trialEndsAt || addDays(now, 14)

    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: billingPlan.id,
        provider: 'MANUAL',
        status: 'TRIALING',
        interval: 'MONTHLY',
        currency: billingPlan.currency,
        amount: billingPlan.priceMonthly,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      },
    })

    created++
    console.log(`Created subscription for ${tenant.name} (${planCode})`)
  }

  console.log(`Done. Created: ${created}, skipped: ${skipped}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    prisma.$disconnect()
  })