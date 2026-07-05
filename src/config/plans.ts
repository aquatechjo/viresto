export type PlanCode = "BASIC" | "PRO" | "BUSINESS";

export type PlanFeature = {
  label: string;
  included: boolean;
  value?: string;
};

export type PlanConfig = {
  code: PlanCode;
  name: string;
  subtitle: string;
  description: string;
  priceJod: number;
  launchPriceJod?: number | null;
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

  features: PlanFeature[];
};

export const PLANS: PlanConfig[] = [
  {
    code: "BASIC",
    name: "Basic",
    subtitle: "للمحامي الفردي",
    description: "كل الأساسيات لتبدأ تنظيم عملك القانوني باحترافية.",
    priceJod: 20,
    launchPriceJod: null,
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
    features: [
      { label: "إدارة الموكلين والقضايا", included: true },
      { label: "المواعيد والمهام", included: true },
      { label: "الفواتير والمدفوعات", included: true },
      { label: "التقارير الأساسية", included: true },
      { label: "إدارة الفريق", included: false },
      { label: "تصدير PDF / Excel كامل", included: false },
      { label: "المساعد الذكي AI", included: false },
      { label: "تلخيص المستندات بالذكاء الاصطناعي", included: false },
      { label: "تخصيص شعار المكتب", included: false },
      { label: "الدعم", included: true, value: "عادي" },
    ],
  },
  {
    code: "PRO",
    name: "Pro",
    subtitle: "للمكاتب الصغيرة",
    description: "الخطة الأنسب لإدارة مكتبك وفريقك بكفاءة.",
    priceJod: 40,
    launchPriceJod: 30,
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
    features: [
      { label: "إدارة الموكلين والقضايا", included: true },
      { label: "المواعيد والمهام", included: true },
      { label: "الفواتير والمدفوعات", included: true },
      { label: "تقارير متقدمة", included: true },
      { label: "تصدير PDF / Excel كامل", included: true },
      { label: "إدارة الفريق وأدوار المستخدمين", included: true },
      { label: "المساعد الذكي AI", included: true, value: "1M tokens / شهر" },
      { label: "تلخيص المستندات بالذكاء الاصطناعي", included: true },
      { label: "تخصيص شعار المكتب", included: true },
      { label: "الدعم", included: true, value: "أسرع" },
    ],
  },
  {
    code: "BUSINESS",
    name: "Business",
    subtitle: "للمكاتب المتوسطة والكبيرة",
    description: "حل متكامل للمكاتب التي تحتاج حدودًا أعلى ودعمًا أقوى.",
    priceJod: 80,
    launchPriceJod: 60,
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
    features: [
      { label: "إدارة الموكلين والقضايا", included: true },
      { label: "المواعيد والمهام", included: true },
      { label: "الفواتير والمدفوعات", included: true },
      { label: "تقارير متقدمة", included: true },
      { label: "تصدير PDF / Excel كامل", included: true },
      { label: "إدارة الفريق وأدوار المستخدمين", included: true },
      { label: "المساعد الذكي AI", included: true, value: "4M tokens / شهر" },
      { label: "تلخيص المستندات بالذكاء الاصطناعي", included: true },
      { label: "تخصيص شعار المكتب", included: true },
      { label: "دعم أولوية ومخصص", included: true },
    ],
  },
];

export const PLAN_ADDONS = [
  {
    code: "EXTRA_USER",
    name: "مستخدم إضافي",
    priceJod: 5,
    unit: "شهر",
  },
  {
    code: "EXTRA_STORAGE_10GB",
    name: "10GB تخزين إضافي",
    priceJod: 3,
    unit: "شهر",
  },
  {
    code: "EXTRA_AI_1M",
    name: "1M AI tokens إضافية",
    priceJod: 3,
    unit: "شهر",
  },
] as const;

export function getPlanByCode(code: PlanCode) {
  return PLANS.find((plan) => plan.code === code);
}

export function getDisplayPrice(plan: PlanConfig) {
  return plan.launchPriceJod ?? plan.priceJod;
}

export function formatTokens(tokens: number) {
  if (tokens <= 0) return "لا";
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M tokens`;
  return tokens.toLocaleString("en-US");
}
