import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ok, err } from '@/lib/api-response'
import { requireRole } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import {
  getPlanMeta,
  getStatusTone,
  getTrialDaysLeft,
  getUsagePercent,
  PLAN_META,
  PLAN_ORDER,
  STATUS_LABELS,
} from '@/lib/plans'

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ['ADMIN'])
    if (auth.error || !auth.user) return auth.error

    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.user.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        isSuspended: true,
        maxUsers: true,
        trialEndsAt: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            clients: true,
            cases: true,
            documents: true,
            payments: true,
            invoices: true,
          },
        },
      },
    })

    if (!tenant) {
      return err('المكتب غير موجود', 404)
    }

    const plan = getPlanMeta(tenant.plan)
    const effectiveLimits = {
      ...plan.limits,
      users: tenant.maxUsers,
    }

    const usage = {
      users: {
        used: tenant._count.users,
        limit: effectiveLimits.users,
        percent: getUsagePercent(tenant._count.users, effectiveLimits.users),
      },
      clients: {
        used: tenant._count.clients,
        limit: effectiveLimits.clients,
        percent: getUsagePercent(tenant._count.clients, effectiveLimits.clients),
      },
      cases: {
        used: tenant._count.cases,
        limit: effectiveLimits.cases,
        percent: getUsagePercent(tenant._count.cases, effectiveLimits.cases),
      },
      documents: {
        used: tenant._count.documents,
        limit: effectiveLimits.documents,
        percent: getUsagePercent(tenant._count.documents, effectiveLimits.documents),
      },
      payments: {
        used: tenant._count.payments,
        limit: null,
        percent: null,
      },
      invoices: {
        used: tenant._count.invoices,
        limit: null,
        percent: null,
      },
    }

    const warnings = Object.entries(usage)
      .filter(([, item]) => typeof item.percent === 'number' && item.percent >= 80)
      .map(([key, item]) => ({ key, percent: item.percent }))

    return ok({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        statusLabel: STATUS_LABELS[tenant.status],
        statusTone: getStatusTone(tenant.status, tenant.isSuspended),
        isSuspended: tenant.isSuspended,
        maxUsers: tenant.maxUsers,
        trialEndsAt: tenant.trialEndsAt,
        trialDaysLeft: getTrialDaysLeft(tenant.trialEndsAt),
        createdAt: tenant.createdAt,
      },
      currentPlan: {
        ...plan,
        limits: effectiveLimits,
      },
      usage,
      warnings,
      availablePlans: PLAN_ORDER.map((key) => PLAN_META[key]),
    })
  })
}
