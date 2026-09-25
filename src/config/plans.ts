export type PlanCode = "BASIC" | "PRO" | "BUSINESS";

// Platform subscriptions are billed in USD through Polar. This is separate
// from the in-app client invoicing, which stays in JOD.
export const PLAN_CURRENCY = "USD";
export const PLAN_CURRENCY_MINOR_UNITS = 100;

export type PlanFeature = {
  label: string;
  included: boolean;
  value?: string;
};

export type PlanEntitlement =
  | "teamManagement"
  | "advancedReports"
  | "fullExport";

export type PlanEntitlements = Record<PlanEntitlement, boolean>;

export type PlanConfig = {
  code: PlanCode;
  name: string;
  subtitle: string;
  description: string;
  /** Must match the Polar product prices exactly. */
  priceUsd: number;
  priceYearlyUsd: number;
  badge?: string;
  highlighted?: boolean;

  limits: {
    users: number;
    clients: number;
    cases: number;
    storageGb: number;
    aiEnabled: boolean;
    aiMonthlyTokens: number;
    activityRetentionDays: number;
  };

  entitlements: PlanEntitlements;

  features: PlanFeature[];
};

export const PLANS: PlanConfig[] = [
  {
    code: "BASIC",
    name: "Basic",
    subtitle: "للمحامي الفردي",
    description: "كل الأساسيات لتبدأ تنظيم عملك القانوني باحترافية.",
    priceUsd: 29,
    priceYearlyUsd: 290,
    highlighted: false,
    limits: {
      users: 1,
      clients: 100,
      cases: 150,
      storageGb: 2,
      aiEnabled: false,
      aiMonthlyTokens: 0,
      activityRetentionDays: 30,
    },
    entitlements: {
      teamManagement: false,
      advancedReports: false,
      fullExport: false,
    },
    features: [
      { label: "إدارة الموكلين والقضايا", included: true },
      { label: "المواعيد والمهام", included: true },
      { label: "الفواتير والمدفوعات", included: true },
      { label: "التقارير الأساسية", included: true },
      { label: "إدارة الفريق", included: false },
      { label: "تصدير PDF / Excel كامل", included: false },
      { label: "المساعد الذكي AI", included: false },
      { label: "تلخيص المستندات بالذكاء الاصطناعي", included: false },
      { label: "الدعم", included: true, value: "عادي" },
    ],
  },
  {
    code: "PRO",
    name: "Pro",
    subtitle: "للمكاتب الصغيرة",
    description: "الخطة الأنسب لإدارة مكتبك وفريقك بكفاءة.",
    priceUsd: 59,
    priceYearlyUsd: 590,
    badge: "الأكثر طلبًا",
    highlighted: true,
    limits: {
      users: 5,
      clients: 500,
      cases: 1000,
      storageGb: 20,
      aiEnabled: true,
      aiMonthlyTokens: 1_000_000,
      activityRetentionDays: 180,
    },
    entitlements: {
      teamManagement: true,
      advancedReports: true,
      fullExport: true,
    },
    features: [
      { label: "إدارة الموكلين والقضايا", included: true },
      { label: "المواعيد والمهام", included: true },
      { label: "الفواتير والمدفوعات", included: true },
      { label: "تقارير متقدمة", included: true },
      { label: "تصدير PDF / Excel كامل", included: true },
      { label: "إدارة الفريق وأدوار المستخدمين", included: true },
      { label: "المساعد الذكي AI", included: true, value: "1M tokens / شهر" },
      { label: "تلخيص المستندات بالذكاء الاصطناعي", included: true },
      { label: "الدعم", included: true, value: "أسرع" },
    ],
  },
  {
    code: "BUSINESS",
    name: "Business",
    subtitle: "للمكاتب المتوسطة والكبيرة",
    description: "حل متكامل للمكاتب التي تحتاج حدودًا أعلى ودعمًا أقوى.",
    priceUsd: 119,
    priceYearlyUsd: 1190,
    highlighted: false,
    limits: {
      users: 15,
      clients: 2000,
      cases: 5000,
      storageGb: 75,
      aiEnabled: true,
      aiMonthlyTokens: 4_000_000,
      activityRetentionDays: 365,
    },
    entitlements: {
      teamManagement: true,
      advancedReports: true,
      fullExport: true,
    },
    features: [
      { label: "إدارة الموكلين والقضايا", included: true },
      { label: "المواعيد والمهام", included: true },
      { label: "الفواتير والمدفوعات", included: true },
      { label: "تقارير متقدمة", included: true },
      { label: "تصدير PDF / Excel كامل", included: true },
      { label: "إدارة الفريق وأدوار المستخدمين", included: true },
      { label: "المساعد الذكي AI", included: true, value: "4M tokens / شهر" },
      { label: "تلخيص المستندات بالذكاء الاصطناعي", included: true },
      { label: "دعم أولوية ومخصص", included: true },
    ],
  },
];

export function getPlanByCode(code: PlanCode) {
  return PLANS.find((plan) => plan.code === code);
}

export function planHasEntitlement(
  code: string | null | undefined,
  entitlement: PlanEntitlement,
) {
  const normalized = code?.trim().toUpperCase();
  const plan = PLANS.find((item) => item.code === normalized);

  return plan?.entitlements[entitlement] === true;
}

export function getDisplayPrice(plan: PlanConfig) {
  return plan.priceUsd;
}

export function getYearlyPrice(plan: PlanConfig) {
  return plan.priceYearlyUsd;
}

/** Whole months saved by paying yearly instead of 12 × monthly. */
export function getYearlySavingsMonths(plan: PlanConfig) {
  return Math.round(12 - plan.priceYearlyUsd / plan.priceUsd);
}

export function formatYearlySavings(
  plan: PlanConfig,
  locale: "ar" | "en" = "ar",
) {
  const months = getYearlySavingsMonths(plan);

  if (locale === "ar") {
    if (months === 1) return "وفّر قيمة شهر";
    if (months === 2) return "وفّر قيمة شهرين";
    return `وفّر قيمة ${months} أشهر`;
  }

  if (months === 1) return "save one month";
  if (months === 2) return "save two months";
  return `save ${months} months`;
}

/** Minor units per major unit: 1000 fils per JOD, 100 cents otherwise. */
export function currencyMinorUnits(currency: string | null | undefined) {
  return currency?.toUpperCase() === "JOD" ? 1000 : 100;
}

export function formatTokens(tokens: number) {
  if (tokens <= 0) return "لا";
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M tokens`;
  return tokens.toLocaleString("en-US");
}

export function formatLimit(
  value: number | null,
  locale: "ar" | "en" = "ar",
  unit = "",
) {
  if (value === null) {
    return locale === "ar" ? "غير محدود" : "Unlimited";
  }

  return `${value.toLocaleString(locale === "ar" ? "ar-JO-u-nu-latn" : "en-US")}${
    unit ? ` ${unit}` : ""
  }`;
}
