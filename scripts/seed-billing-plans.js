const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const plans = [
  {
    code: 'BASIC',
    name: 'Basic',
    description: 'For solo lawyers and small offices starting with Viresto.',
    currency: 'JOD',
    priceMonthly: 15000,
    priceYearly: 150000,
    maxUsers: 2,
    maxClients: 100,
    maxCases: 100,
    maxDocuments: 300,
    maxStorageMb: 1000,
    aiEnabled: false,
    sortOrder: 1,
  },
  {
    code: 'PRO',
    name: 'Pro',
    description: 'Best for growing law offices that need more capacity and AI features.',
    currency: 'JOD',
    priceMonthly: 29000,
    priceYearly: 290000,
    maxUsers: 5,
    maxClients: 500,
    maxCases: 500,
    maxDocuments: 1500,
    maxStorageMb: 5000,
    aiEnabled: true,
    sortOrder: 2,
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    description: 'For larger law firms with teams, higher limits, and advanced usage.',
    currency: 'JOD',
    priceMonthly: 59000,
    priceYearly: 590000,
    maxUsers: 15,
    maxClients: 2000,
    maxCases: 2000,
    maxDocuments: 7000,
    maxStorageMb: 20000,
    aiEnabled: true,
    sortOrder: 3,
  },
]

async function main() {
  for (const plan of plans) {
    await prisma.billingPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    })
  }

  console.log('Billing plans seeded successfully.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })