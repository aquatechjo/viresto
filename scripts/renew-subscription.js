const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const ALLOWED_PLANS = new Set(['BASIC', 'PRO', 'BUSINESS'])
const ALLOWED_INTERVALS = new Set(['MONTHLY', 'YEARLY'])

function printUsage() {
  console.log(`Usage:
node scripts/renew-subscription.js tenant-or-admin@email.com PRO MONTHLY 1

Arguments:
1. Tenant/Admin Email    بريد المكتب أو بريد مدير الحساب
2. Plan Code             BASIC | PRO | BUSINESS
3. Interval              MONTHLY | YEARLY
4. Period Count          عدد الأشهر إذا MONTHLY، أو عدد السنوات إذا YEARLY

Examples:
node scripts/renew-subscription.js ahmad@example.com PRO MONTHLY 1
node scripts/renew-subscription.js ahmad@example.com BUSINESS YEARLY 1
`)
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function addPeriod(date, interval, count) {
  const next = new Date(date)

  if (interval === 'YEARLY') {
    next.setFullYear(next.getFullYear() + count)
    return next
  }

  next.setMonth(next.getMonth() + count)
  return next
}

function mapBillingPlanToLegacyPlan(planCode) {
  if (planCode === 'BASIC') return 'FREE'
  if (planCode === 'BUSINESS') return 'ENTERPRISE'
  return 'PRO'
}

async function findTenantByEmail(email) {
  return prisma.tenant.findFirst({
    where: {
      OR: [
        { email },
        {
          users: {
            some: { email },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      isSuspended: true,
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          currentPeriodEnd: true,
        },
      },
    },
  })
}

async function main() {
  const [emailRaw, planRaw = 'PRO', intervalRaw = 'MONTHLY', periodCountRaw = '1'] = process.argv.slice(2)

  if (!emailRaw) {
    printUsage()
    throw new Error('Missing tenant/admin email')
  }

  const email = normalizeEmail(emailRaw)
  const planCode = String(planRaw).trim().toUpperCase()
  const interval = String(intervalRaw).trim().toUpperCase()
  const periodCount = Number(periodCountRaw)

  if (!email) throw new Error('Email is required')
  if (!ALLOWED_PLANS.has(planCode)) throw new Error('Plan must be BASIC, PRO, or BUSINESS')
  if (!ALLOWED_INTERVALS.has(interval)) throw new Error('Interval must be MONTHLY or YEARLY')
  if (!Number.isInteger(periodCount) || periodCount < 1) throw new Error('Period count must be a positive integer')

  const tenant = await findTenantByEmail(email)

  if (!tenant) {
    throw new Error(`Tenant not found for email: ${email}`)
  }

  const plan = await prisma.billingPlan.findUnique({ where: { code: planCode } })

  if (!plan || !plan.isActive) {
    throw new Error(`Billing plan not found or inactive: ${planCode}. Run: npm run db:seed`)
  }

  const now = new Date()
  const lastSubscription = tenant.subscriptions[0] || null
  const oldEnd = lastSubscription?.currentPeriodEnd || null
  const baseStart = oldEnd && oldEnd.getTime() > now.getTime() ? oldEnd : now
  const newEnd = addPeriod(baseStart, interval, periodCount)
  const amount = interval === 'YEARLY' ? plan.priceYearly * periodCount : plan.priceMonthly * periodCount

  const result = await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenant.id },
      data: {
        status: 'ACTIVE',
        isSuspended: false,
        plan: mapBillingPlanToLegacyPlan(planCode),
        maxUsers: plan.maxUsers,
        aiEnabled: plan.aiEnabled,
        aiConsentAt: plan.aiEnabled ? now : null,
      },
    })

    let subscription

    if (lastSubscription) {
      subscription = await tx.subscription.update({
        where: { id: lastSubscription.id },
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          interval,
          currency: plan.currency,
          amount,
          currentPeriodStart: baseStart,
          currentPeriodEnd: newEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          trialEndsAt: null,
        },
      })
    } else {
      subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: 'ACTIVE',
          interval,
          currency: plan.currency,
          amount,
          currentPeriodStart: baseStart,
          currentPeriodEnd: newEnd,
        },
      })
    }

    const payment = await tx.subscriptionPayment.create({
      data: {
        tenantId: tenant.id,
        subscriptionId: subscription.id,
        amount,
        currency: plan.currency,
        status: 'PAID',
        paidAt: now,
        raw: {
          source: 'manual_renewal',
          lookupEmail: email,
          previousEnd: oldEnd ? oldEnd.toISOString() : null,
          planCode,
          interval,
          periodCount,
        },
      },
    })

    await tx.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'BILLING',
        title: 'Manual subscription renewal',
        message: `Renewed subscription to ${planCode} ${interval} until ${newEnd.toISOString()}.`,
        entityType: 'Subscription',
        entityId: subscription.id,
      },
    })

    return { subscription, payment }
  })

  console.log('')
  console.log('✅ Subscription renewed successfully')
  console.log('--------------------------------')
  console.log(`Tenant: ${tenant.name}`)
  console.log(`Lookup email: ${email}`)
  console.log(`Plan: ${planCode}`)
  console.log(`Interval: ${interval}`)
  console.log(`Period count: ${periodCount}`)
  console.log(`Previous end: ${oldEnd ? oldEnd.toISOString() : 'No previous subscription'}`)
  console.log(`New period start: ${baseStart.toISOString()}`)
  console.log(`New period end:   ${newEnd.toISOString()}`)
  console.log(`Amount: ${amount} fils (${(amount / 1000).toFixed(3)} ${plan.currency})`)
  console.log(`Payment record: ${result.payment.id}`)
  console.log('')
}

main()
  .catch((error) => {
    console.error('')
    console.error('❌ Renewal failed')
    console.error(error.message || error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
