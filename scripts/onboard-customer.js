const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const ALLOWED_PLANS = new Set(['BASIC', 'PRO', 'BUSINESS'])
const ALLOWED_INTERVALS = new Set(['MONTHLY', 'YEARLY'])

function printUsage() {
  console.log(`Usage:
node scripts/onboard-customer.js "Office Name" "Admin Name" admin@email.com 0799999999 PRO MONTHLY 1

Arguments:
1. Office Name      اسم المكتب / الشركة
2. Admin Name       اسم مدير الحساب
3. Admin Email      بريد مدير الحساب
4. Admin Phone      رقم هاتف أردني مثل 0799999999 أو +962799999999
5. Plan Code        BASIC | PRO | BUSINESS
6. Interval         MONTHLY | YEARLY
7. Period Count     عدد الأشهر إذا MONTHLY، أو عدد السنوات إذا YEARLY

Examples:
node scripts/onboard-customer.js "مكتب العدالة" "أحمد محمد" ahmad@example.com 0799999999 PRO MONTHLY 1
node scripts/onboard-customer.js "مكتب العدالة" "أحمد محمد" ahmad@example.com 0799999999 PRO YEARLY 1
`)
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function normalizeJordanPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')

  if (digits.startsWith('962') && digits.length === 12) {
    return `+${digits}`
  }

  if (digits.startsWith('07') && digits.length === 10) {
    return `+962${digits.slice(1)}`
  }

  if (digits.startsWith('7') && digits.length === 9) {
    return `+962${digits}`
  }

  return String(phone || '').trim()
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function slugify(value) {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  return base || `tenant-${Date.now()}`
}

async function makeUniqueSlug(baseSlug) {
  let slug = baseSlug
  let counter = 1

  while (await prisma.tenant.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${counter}`
    counter += 1
  }

  return slug
}

function mapBillingPlanToLegacyPlan(planCode) {
  if (planCode === 'BASIC') return 'FREE'
  if (planCode === 'BUSINESS') return 'ENTERPRISE'
  return 'PRO'
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

function generateTemporaryPassword() {
  const part1 = Math.random().toString(36).slice(2, 8)
  const part2 = Math.random().toString(36).slice(2, 8)
  return `Viresto-${part1}-${part2}`
}

async function main() {
  const [tenantNameRaw, adminNameRaw, emailRaw, phoneRaw, planRaw = 'PRO', intervalRaw = 'MONTHLY', periodCountRaw = '1'] = process.argv.slice(2)

  if (!tenantNameRaw || !adminNameRaw || !emailRaw || !phoneRaw) {
    printUsage()
    throw new Error('Missing required arguments')
  }

  const tenantName = String(tenantNameRaw).trim()
  const adminName = String(adminNameRaw).trim()
  const email = normalizeEmail(emailRaw)
  const phone = normalizeJordanPhone(phoneRaw)
  const planCode = String(planRaw).trim().toUpperCase()
  const interval = String(intervalRaw).trim().toUpperCase()
  const periodCount = Number(periodCountRaw)

  if (!tenantName) throw new Error('Office name is required')
  if (!adminName) throw new Error('Admin name is required')
  if (!validateEmail(email)) throw new Error('Invalid admin email')
  if (!phone) throw new Error('Admin phone is required')
  if (!ALLOWED_PLANS.has(planCode)) throw new Error('Plan must be BASIC, PRO, or BUSINESS')
  if (!ALLOWED_INTERVALS.has(interval)) throw new Error('Interval must be MONTHLY or YEARLY')
  if (!Number.isInteger(periodCount) || periodCount < 1) throw new Error('Period count must be a positive integer')

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, tenant: { select: { name: true } } },
  })

  if (existingUser) {
    throw new Error(`Email is already used by another user in tenant: ${existingUser.tenant.name}`)
  }

  const plan = await prisma.billingPlan.findUnique({ where: { code: planCode } })

  if (!plan || !plan.isActive) {
    throw new Error(`Billing plan not found or inactive: ${planCode}. Run: npm run db:seed`)
  }

  const now = new Date()
  const currentPeriodEnd = addPeriod(now, interval, periodCount)
  const amount = interval === 'YEARLY' ? plan.priceYearly * periodCount : plan.priceMonthly * periodCount
  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, 12)
  const slug = await makeUniqueSlug(slugify(tenantName))

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug,
        plan: mapBillingPlanToLegacyPlan(planCode),
        status: 'ACTIVE',
        isSuspended: false,
        maxUsers: plan.maxUsers,
        aiEnabled: plan.aiEnabled,
        aiConsentAt: plan.aiEnabled ? now : null,
        email,
        phone,
        users: {
          create: {
            name: adminName,
            email,
            phone,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
            emailVerifiedAt: now,
            phoneVerifiedAt: now,
          },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    const subscription = await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        provider: 'MANUAL',
        status: 'ACTIVE',
        interval,
        currency: plan.currency,
        amount,
        currentPeriodStart: now,
        currentPeriodEnd,
      },
    })

    const payment = await tx.subscriptionPayment.create({
      data: {
        tenantId: tenant.id,
        subscriptionId: subscription.id,
        provider: 'MANUAL',
        amount,
        currency: plan.currency,
        status: 'PAID',
        paidAt: now,
        raw: {
          source: 'manual_onboarding',
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
        title: 'Manual customer onboarding',
        message: `Created tenant with ${planCode} ${interval} subscription.`,
        entityType: 'Subscription',
        entityId: subscription.id,
      },
    })

    return { tenant, subscription, payment }
  })

  console.log('')
  console.log('✅ Customer onboarded successfully')
  console.log('--------------------------------')
  console.log(`Tenant: ${result.tenant.name}`)
  console.log(`Slug: ${result.tenant.slug}`)
  console.log(`Admin email: ${email}`)
  console.log(`Admin phone: ${phone}`)
  console.log(`Temporary password: ${temporaryPassword}`)
  console.log(`Plan: ${planCode}`)
  console.log(`Interval: ${interval}`)
  console.log(`Period count: ${periodCount}`)
  console.log(`Amount: ${amount} fils (${(amount / 1000).toFixed(3)} ${plan.currency})`)
  console.log(`Subscription starts: ${now.toISOString()}`)
  console.log(`Subscription ends:   ${currentPeriodEnd.toISOString()}`)
  console.log('')
  console.log('Send the admin email and temporary password securely. Ask the customer to change the password after first login.')
}

main()
  .catch((error) => {
    console.error('')
    console.error('❌ Onboarding failed')
    console.error(error.message || error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
