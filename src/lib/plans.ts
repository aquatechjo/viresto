import type { Plan, TenantStatus } from '@prisma/client'

export type PlanKey = Plan

export interface PlanLimit {
  users: number | null
  clients: number | null
  cases: number | null
  documents: number | null
  storageMb: number | null
  invoices: boolean
  reports: boolean
  aiSummaries: boolean
  support: string
}

export interface PlanMeta {
  key: PlanKey
  nameAr: string
  nameEn: string
  priceLabel: string
  description: string
  recommended?: boolean
  limits: PlanLimit
  features: string[]
}

export type LimitedResource = 'users' | 'clients' | 'cases' | 'documents'
export type PlanFeature = 'invoices' | 'reports' | 'aiSummaries'

export const PLAN_ORDER: PlanKey[] = ['FREE', 'PRO', 'ENTERPRISE']

export const PLAN_META: Record<PlanKey, PlanMeta> = {
  FREE: {
    key: 'FREE',
    nameAr: 'مجانية',
    nameEn: 'Free',
    priceLabel: '0$ / شهر',
    description: 'مناسبة للتجربة أو لمكتب صغير جدًا.',
    limits: {
      users: 2,
      clients: 25,
      cases: 25,
      documents: 100,
      storageMb: 250,
      invoices: true,
      reports: false,
      aiSummaries: false,
      support: 'دعم أساسي',
    },
    features: [
      'إدارة موكلين وقضايا محدودة',
      'فواتير أساسية',
      'مواعيد ومهام',
      'بدون ملخصات AI',
    ],
  },
  PRO: {
    key: 'PRO',
    nameAr: 'احترافية',
    nameEn: 'Pro',
    priceLabel: 'اشتراك شهري',
    description: 'الخطة المناسبة لمعظم مكاتب المحاماة الصغيرة والمتوسطة.',
    recommended: true,
    limits: {
      users: 5,
      clients: 500,
      cases: 500,
      documents: 1000,
      storageMb: 5120,
      invoices: true,
      reports: true,
      aiSummaries: true,
      support: 'دعم أولوية',
    },
    features: [
      'فواتير ومدفوعات وتقارير',
      'رفع مستندات أكبر',
      'ملخصات AI للمستندات',
      'إدارة فريق حتى 5 مستخدمين افتراضيًا',
    ],
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    nameAr: 'مؤسسية',
    nameEn: 'Enterprise',
    priceLabel: 'حسب الاتفاق',
    description: 'للمكاتب الكبيرة أو الشركات التي تحتاج حدودًا مخصصة.',
    limits: {
      users: null,
      clients: null,
      cases: null,
      documents: null,
      storageMb: null,
      invoices: true,
      reports: true,
      aiSummaries: true,
      support: 'دعم مخصص واتفاقية SLA',
    },
    features: [
      'حدود مخصصة للمستخدمين والملفات',
      'تقارير متقدمة',
      'دعم مخصص',
      'إعدادات خاصة حسب المكتب',
    ],
  },
}

export const STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: 'نشط',
  TRIAL: 'تجربة',
  EXPIRED: 'منتهي',
  SUSPENDED: 'موقوف',
}

export function getPlanMeta(plan: PlanKey) {
  return PLAN_META[plan] ?? PLAN_META.PRO
}

export function getPlanLimit(plan: PlanKey, resource: LimitedResource) {
  return getPlanMeta(plan).limits[resource]
}

export function canUsePlanFeature(plan: PlanKey, feature: PlanFeature) {
  return Boolean(getPlanMeta(plan).limits[feature])
}

export function formatLimit(value: number | null, unit = '') {
  if (value === null) return 'غير محدود'
  return `${value.toLocaleString('ar-JO')}${unit ? ` ${unit}` : ''}`
}

export function getUsagePercent(used: number, limit: number | null) {
  if (!limit || limit <= 0) return null
  return Math.min(Math.round((used / limit) * 100), 999)
}

export function getStatusTone(status: TenantStatus, isSuspended: boolean) {
  if (isSuspended || status === 'SUSPENDED') return 'danger'
  if (status === 'EXPIRED') return 'danger'
  if (status === 'TRIAL') return 'warning'
  return 'success'
}

export function getTrialDaysLeft(trialEndsAt?: Date | string | null) {
  if (!trialEndsAt) return null

  const end = new Date(trialEndsAt).getTime()
  if (Number.isNaN(end)) return null

  const diff = end - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
