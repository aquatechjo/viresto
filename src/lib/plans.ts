import type { Plan, TenantStatus } from "@prisma/client";

export type PlanKey = Plan;

export interface PlanLimit {
  users: number | null;
  clients: number | null;
  cases: number | null;
  documents: number | null;
  storageMb: number | null;
  invoices: boolean;
  reports: boolean;
  aiSummaries: boolean;
  supportAr: string;
  supportEn: string;
}

export interface PlanMeta {
  key: PlanKey;
  nameAr: string;
  nameEn: string;
  priceLabelAr: string;
  priceLabelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  recommended?: boolean;
  limits: PlanLimit;
  featuresAr: string[];
  featuresEn: string[];
}

export type LimitedResource = "users" | "clients" | "cases" | "documents";
export type PlanFeature = "invoices" | "reports" | "aiSummaries";

export const PLAN_ORDER: PlanKey[] = ["FREE", "PRO", "ENTERPRISE"];

export const PLAN_META: Record<PlanKey, PlanMeta> = {
  FREE: {
    key: "FREE",
    nameAr: "مجانية",
    nameEn: "Free",
    priceLabelAr: "0$ / شهر",
    priceLabelEn: "$0 / month",
    descriptionAr: "مناسبة للتجربة أو لمكتب صغير جدًا.",
    descriptionEn: "Suitable for testing or a very small law office.",
    limits: {
      users: 2,
      clients: 25,
      cases: 25,
      documents: 100,
      storageMb: 250,
      invoices: true,
      reports: false,
      aiSummaries: false,
      supportAr: "دعم أساسي",
      supportEn: "Basic support",
    },
    featuresAr: [
      "إدارة موكلين وقضايا محدودة",
      "فواتير أساسية",
      "مواعيد ومهام",
      "بدون ملخصات AI",
    ],
    featuresEn: [
      "Limited client and case management",
      "Basic invoices",
      "Appointments and tasks",
      "No AI summaries",
    ],
  },

  PRO: {
    key: "PRO",
    nameAr: "احترافية",
    nameEn: "Pro",
    priceLabelAr: "اشتراك شهري",
    priceLabelEn: "Monthly subscription",
    descriptionAr: "الخطة المناسبة لمعظم مكاتب المحاماة الصغيرة والمتوسطة.",
    descriptionEn: "The suitable plan for most small and mid-sized law firms.",
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
      supportAr: "دعم أساسي",
      supportEn: "Basic support",
    },
    featuresAr: [
      "فواتير ومدفوعات وتقارير",
      "رفع مستندات أكبر",
      "ملخصات AI للمستندات",
      "إدارة فريق حتى 5 مستخدمين افتراضيًا",
    ],
    featuresEn: [
      "Invoices, payments, and reports",
      "Larger document uploads",
      "AI summaries for documents",
      "Team management for up to 5 users by default",
    ],
  },

  ENTERPRISE: {
    key: "ENTERPRISE",
    nameAr: "مؤسسية",
    nameEn: "Enterprise",
    priceLabelAr: "حسب الاتفاق",
    priceLabelEn: "Custom pricing",
    descriptionAr: "للمكاتب الكبيرة أو الشركات التي تحتاج حدودًا مخصصة.",
    descriptionEn: "For large firms or organizations that need custom limits.",
    limits: {
      users: null,
      clients: null,
      cases: null,
      documents: null,
      storageMb: null,
      invoices: true,
      reports: true,
      aiSummaries: true,
      supportAr: "دعم مخصص واتفاقية SLA",
      supportEn: "Dedicated support with SLA",
    },
    featuresAr: [
      "حدود مخصصة للمستخدمين والملفات",
      "تقارير متقدمة",
      "دعم مخصص",
      "إعدادات خاصة حسب المكتب",
    ],
    featuresEn: [
      "Custom user and file limits",
      "Advanced reports",
      "Dedicated support",
      "Custom settings per firm",
    ],
  },
};

export const STATUS_LABELS: Record<TenantStatus, { ar: string; en: string }> = {
  ACTIVE: {
    ar: "نشط",
    en: "Active",
  },
  TRIAL: {
    ar: "تجربة",
    en: "Trial",
  },
  EXPIRED: {
    ar: "منتهي",
    en: "Expired",
  },
  SUSPENDED: {
    ar: "موقوف",
    en: "Suspended",
  },
};

export function getPlanMeta(plan: PlanKey) {
  return PLAN_META[plan] ?? PLAN_META.PRO;
}

export function getPlanLimit(plan: PlanKey, resource: LimitedResource) {
  return getPlanMeta(plan).limits[resource];
}

export function canUsePlanFeature(plan: PlanKey, feature: PlanFeature) {
  return Boolean(getPlanMeta(plan).limits[feature]);
}

export function formatLimit(
  value: number | null,
  locale: "ar" | "en" = "ar",
  unit = "",
) {
  if (value === null) {
    return locale === "ar" ? "غير محدود" : "Unlimited";
  }

  return `${value.toLocaleString(locale === "ar" ? "ar-JO" : "en-US")}${
    unit ? ` ${unit}` : ""
  }`;
}

export function getUsagePercent(used: number, limit: number | null) {
  if (!limit || limit <= 0) return null;
  return Math.min(Math.round((used / limit) * 100), 999);
}

export function getStatusTone(status: TenantStatus, isSuspended: boolean) {
  if (isSuspended || status === "SUSPENDED") return "danger";
  if (status === "EXPIRED") return "danger";
  if (status === "TRIAL") return "warning";
  return "success";
}

export function getTrialDaysLeft(trialEndsAt?: Date | string | null) {
  if (!trialEndsAt) return null;

  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;

  const diff = end - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
