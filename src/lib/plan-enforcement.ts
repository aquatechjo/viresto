import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { err } from '@/lib/api-response'
import {
  canUsePlanFeature,
  formatLimit,
  getPlanLimit,
  getPlanMeta,
  type LimitedResource,
  type PlanFeature,
} from '@/lib/plans'

const RESOURCE_LABELS: Record<LimitedResource, string> = {
  users: 'المستخدمين',
  clients: 'الموكلين',
  cases: 'القضايا',
  documents: 'المستندات',
}

const FEATURE_LABELS: Record<PlanFeature, string> = {
  invoices: 'الفواتير',
  reports: 'التقارير',
  aiSummaries: 'ملخصات الذكاء الاصطناعي',
}

type LimitFailure = NextResponse | null

type TenantPlanRecord = {
  id: string
  plan: import('@prisma/client').Plan
  status: import('@prisma/client').TenantStatus
  isSuspended: boolean
  maxUsers: number
}

async function getTenantForPlanChecks(tenantId: string): Promise<TenantPlanRecord | null> {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      plan: true,
      status: true,
      isSuspended: true,
      maxUsers: true,
    },
  })
}

function tenantStatusError(tenant: TenantPlanRecord | null) {
  if (!tenant) return err('المكتب غير موجود', 404)

  if (tenant.isSuspended || tenant.status === 'SUSPENDED') {
    return err('لا يمكن تنفيذ هذا الإجراء لأن المكتب موقوف', 403)
  }

  if (tenant.status === 'EXPIRED') {
    return err('لا يمكن تنفيذ هذا الإجراء لأن الاشتراك منتهي', 403)
  }

  return null
}

async function countResource(tenantId: string, resource: LimitedResource) {
  if (resource === 'users') {
    return prisma.user.count({ where: { tenantId } })
  }

  if (resource === 'clients') {
    return prisma.client.count({ where: { tenantId } })
  }

  if (resource === 'cases') {
    return prisma.case.count({ where: { tenantId } })
  }

  return prisma.document.count({ where: { tenantId } })
}

function getEffectiveLimit(
  tenant: TenantPlanRecord,
  resource: LimitedResource
) {
  if (resource === 'users') {
    return tenant.maxUsers > 0 ? tenant.maxUsers : getPlanLimit(tenant.plan, 'users')
  }

  return getPlanLimit(tenant.plan, resource)
}

export async function enforceResourceLimit(
  tenantId: string,
  resource: LimitedResource
): Promise<LimitFailure> {
  const tenant = await getTenantForPlanChecks(tenantId)
  const statusError = tenantStatusError(tenant)
  if (statusError || !tenant) return statusError

  const limit = getEffectiveLimit(tenant, resource)
  if (limit === null) return null

  const used = await countResource(tenantId, resource)

  if (used >= limit) {
    const plan = getPlanMeta(tenant.plan)
    const label = RESOURCE_LABELS[resource]

    return err(
      `وصلت إلى حد ${label} في خطة ${plan.nameAr} (${formatLimit(limit)}). يرجى ترقية الاشتراك أو تعديل الحدود من لوحة الإدارة.`,
      403,
      {
        code: 'PLAN_LIMIT_REACHED',
        plan: tenant.plan,
        resource,
        used,
        limit,
      }
    )
  }

  return null
}

export async function enforceStorageLimit(
  tenantId: string,
  nextFileSizeBytes: number
): Promise<LimitFailure> {
  const tenant = await getTenantForPlanChecks(tenantId)
  const statusError = tenantStatusError(tenant)
  if (statusError || !tenant) return statusError

  const storageMb = getPlanMeta(tenant.plan).limits.storageMb
  if (storageMb === null) return null

  const aggregate = await prisma.document.aggregate({
    where: { tenantId },
    _sum: { fileSize: true },
  })

  const usedBytes = aggregate._sum.fileSize ?? 0
  const limitBytes = storageMb * 1024 * 1024
  const nextTotalBytes = usedBytes + nextFileSizeBytes

  if (nextTotalBytes > limitBytes) {
    return err(
      `مساحة التخزين في خطتك الحالية لا تكفي لرفع هذا الملف. الحد الحالي ${formatLimit(storageMb, 'ar', 'MB')}.`,
      403,
      {
        code: 'PLAN_STORAGE_LIMIT_REACHED',
        plan: tenant.plan,
        usedBytes,
        nextFileSizeBytes,
        limitBytes,
      }
    )
  }

  return null
}

export async function enforcePlanFeature(
  tenantId: string,
  feature: PlanFeature
): Promise<LimitFailure> {
  const tenant = await getTenantForPlanChecks(tenantId)
  const statusError = tenantStatusError(tenant)
  if (statusError || !tenant) return statusError

  if (!canUsePlanFeature(tenant.plan, feature)) {
    const plan = getPlanMeta(tenant.plan)
    const label = FEATURE_LABELS[feature]

    return err(
      `ميزة ${label} غير متاحة في خطة ${plan.nameAr}. يرجى ترقية الاشتراك لاستخدامها.`,
      403,
      {
        code: 'PLAN_FEATURE_LOCKED',
        plan: tenant.plan,
        feature,
      }
    )
  }

  return null
}
