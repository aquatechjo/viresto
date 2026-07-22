"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatLimit } from "@/config/plans";
import { useLocale } from "@/lib/useLocale";
import { translations } from "@/lib/i18n";
import AppLoader from "@/components/ui/AppLoader";
type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED"
  | "UNPAID";

type StatusTone = "success" | "warning" | "danger" | "muted";

interface Money {
  raw: number;
  value: number;
  currency: string;
  formatted: string;
}

interface UsageItem {
  used: number;
  limit: number | null;
  percent: number | null;
  reserved?: number;
  periodStart?: string;
  periodEnd?: string;
}

interface BillingPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  currency: string;
  priceMonthly: Money;
  priceYearly: Money;
  limits: {
    users: number | null;
    clients: number | null;
    cases: number | null;
    documents: number | null;
    storageMb?: number | null;
    aiEnabled?: boolean;
    aiMonthlyTokens?: number;
  };
  aiEnabled: boolean;
  sortOrder?: number;
  isCurrent?: boolean;
}

type ManualPaymentMethodCode = "CLIQ" | "BANK_TRANSFER";

interface ManualPaymentField {
  key: string;
  labelAr: string;
  labelEn: string;
  value: string;
  direction?: "ltr" | "rtl";
}

interface ManualPaymentMethod {
  code: ManualPaymentMethodCode;
  labelAr: string;
  labelEn: string;
  fields: ManualPaymentField[];
}

interface ManualPaymentSettings {
  enabled: boolean;
  methods: ManualPaymentMethod[];
  instructionsAr?: string | null;
  instructionsEn?: string | null;
}

interface SubscriptionPayment {
  id: string;
  amount: Money;
  currency: string;
  status: string;
  method?: string | null;
  receiptUrl?: string | null;
  adminNote?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  plan?: {
    id: string;
    code: string;
    name: string;
  } | null;
  interval?: "MONTHLY" | "YEARLY" | null;
}

interface BillingData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan?: string;
    status?: string;
    subscriptionStatus: SubscriptionStatus;
    statusLabel: string;
    statusTone: StatusTone;
    isSuspended: boolean;
    maxUsers?: number;
    trialEndsAt?: string | null;
    trialDaysLeft?: number | null;
    createdAt: string;
  };
  subscription: {
    id: string;
    status: SubscriptionStatus;
    statusLabel: string;
    statusTone: StatusTone;
    interval: "MONTHLY" | "YEARLY";
    amount: Money;
    currency: string;
    trialEndsAt?: string | null;
    trialDaysLeft?: number | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
    cancelledAt?: string | null;
    createdAt: string;
    updatedAt: string;
    payments: SubscriptionPayment[];
    plan: BillingPlan;
  } | null;
  paymentHistory: SubscriptionPayment[];
  currentPlan: BillingPlan;
  usage: {
    users: UsageItem;
    clients: UsageItem;
    cases: UsageItem;
    documents: UsageItem;
    storage: UsageItem;
    ai: UsageItem;
    payments: UsageItem;
    invoices: UsageItem;
  };
  warnings: Array<{ key: string; percent: number | null }>;
  availablePlans: BillingPlan[];
  manualPaymentSettings: ManualPaymentSettings;
  period?: {
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
  };
}

function getPaymentMethodLabel(value: string | null | undefined, isArabic: boolean) {
  switch (value?.toUpperCase().replace(/[ -]+/g, "_")) {
    case "CLIQ":
      return "CliQ";
    case "BANK_TRANSFER":
      return isArabic ? "تحويل بنكي" : "Bank transfer";
    default:
      return value || "-";
  }
}

const statusClasses: Record<StatusTone, string> = {
  success:
    "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-400/30 dark:bg-[#1c5354] dark:text-emerald-50",
  warning:
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200",
  danger:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200",
  muted:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white/70",
};

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getStatusLabel(status: string | undefined, isArabic: boolean) {
  if (isArabic) {
    switch (status) {
      case "ACTIVE":
        return "نشط";
      case "TRIALING":
        return "تجربة";
      case "PAST_DUE":
        return "متأخر الدفع";
      case "CANCELLED":
        return "ملغي";
      case "EXPIRED":
        return "منتهي";
      case "UNPAID":
        return "غير مدفوع";
      default:
        return "غير محدد";
    }
  }

  switch (status) {
    case "ACTIVE":
      return "Active";
    case "TRIALING":
      return "Trialing";
    case "PAST_DUE":
      return "Past due";
    case "CANCELLED":
      return "Cancelled";
    case "EXPIRED":
      return "Expired";
    case "UNPAID":
      return "Unpaid";
    default:
      return "Unknown";
  }
}

function getEffectiveBillingStatus(
  status: SubscriptionStatus | string | undefined,
  currentPeriodEnd?: string | null,
  trialEndsAt?: string | null,
): SubscriptionStatus {
  const safeStatus = status as SubscriptionStatus | undefined;
  const endDateValue = currentPeriodEnd ?? trialEndsAt ?? null;

  if (
    endDateValue &&
    safeStatus &&
    ["TRIALING", "ACTIVE", "PAST_DUE"].includes(safeStatus)
  ) {
    const endDate = new Date(endDateValue);

    if (!Number.isNaN(endDate.getTime()) && endDate.getTime() <= Date.now()) {
      return "EXPIRED";
    }
  }

  if (
    safeStatus &&
    [
      "TRIALING",
      "ACTIVE",
      "PAST_DUE",
      "CANCELLED",
      "EXPIRED",
      "UNPAID",
    ].includes(safeStatus)
  ) {
    return safeStatus;
  }

  return "EXPIRED";
}

function getStatusToneFromStatus(status: SubscriptionStatus): StatusTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "TRIALING":
      return "warning";
    case "CANCELLED":
      return "muted";
    case "PAST_DUE":
    case "UNPAID":
    case "EXPIRED":
    default:
      return "danger";
  }
}

function getPlanCode(plan: BillingPlan) {
  return plan.code.toUpperCase();
}

function moneyToJod(money: Money) {
  if (Number.isFinite(money.raw) && money.raw >= 1000) {
    return money.raw / 1000;
  }

  if (Number.isFinite(money.value) && money.value >= 1000) {
    return money.value / 1000;
  }

  return Number.isFinite(money.value) ? money.value : 0;
}

function getAiTokenLabel(plan: BillingPlan, isArabic: boolean) {
  switch (getPlanCode(plan)) {
    case "PRO":
      return isArabic ? "1M tokens / شهر" : "1M tokens / month";
    case "BUSINESS":
      return isArabic ? "4M tokens / شهر" : "4M tokens / month";
    default:
      return isArabic ? "غير متاح" : "Not available";
  }
}

function formatStorageLimit(storageMb: number | null | undefined, locale: string) {
  if (storageMb === null || storageMb === undefined) {
    return locale === "ar" ? "حسب الخطة" : "Plan based";
  }

  if (storageMb >= 1024) {
    const storageGb = storageMb / 1024;
    const formattedGb = Number.isInteger(storageGb)
      ? storageGb.toString()
      : storageGb.toFixed(1);

    return `${formattedGb}GB`;
  }

  return `${storageMb}MB`;
}

function getDocumentsLimitLabel(isArabic: boolean) {
  return isArabic ? "حسب مساحة التخزين" : "Based on storage";
}

function getPlanDescription(plan: BillingPlan, isArabic: boolean) {
  switch (getPlanCode(plan)) {
    case "BASIC":
      return isArabic
        ? "كل الأساسيات لتبدأ تنظيم عملك القانوني باحترافية."
        : "All the essentials you need to organize your legal work professionally.";
    case "PRO":
      return isArabic
        ? "الخطة الأنسب لإدارة مكتبك وفريقك بكفاءة."
        : "The ideal plan for managing your office and team efficiently.";
    case "BUSINESS":
      return isArabic
        ? "حل متكامل للمكاتب التي تحتاج حدودًا أعلى ودعمًا أقوى."
        : "A complete solution for law firms that need higher limits and stronger support.";
    default:
      return plan.description || "—";
  }
}

type PlanFeatureItem = {
  label: string;
  included: boolean;
};

function getPlanFeatures(plan: BillingPlan, isArabic: boolean): PlanFeatureItem[] {
  const code = getPlanCode(plan);
  const locale = isArabic ? "ar" : "en";

  const baseFeatures: PlanFeatureItem[] = [
    {
      label: isArabic
        ? `حتى ${formatLimit(plan.limits.users, locale)} مستخدم`
        : `Up to ${formatLimit(plan.limits.users, locale)} users`,
      included: true,
    },
    {
      label: isArabic
        ? `حتى ${formatLimit(plan.limits.clients, locale)} موكل`
        : `Up to ${formatLimit(plan.limits.clients, locale)} clients`,
      included: true,
    },
    {
      label: isArabic
        ? `حتى ${formatLimit(plan.limits.cases, locale)} قضية`
        : `Up to ${formatLimit(plan.limits.cases, locale)} cases`,
      included: true,
    },
    {
      label: isArabic
        ? `تخزين ${formatStorageLimit(plan.limits.storageMb ?? null, locale)}`
        : `${formatStorageLimit(plan.limits.storageMb ?? null, locale)} storage`,
      included: true,
    },
    {
      label: isArabic
        ? `المستندات: ${getDocumentsLimitLabel(isArabic)}`
        : `Documents: ${getDocumentsLimitLabel(isArabic)}`,
      included: true,
    },
  ];

  if (code === "BASIC") {
    return [
      ...baseFeatures,
      {
        label: isArabic ? "المساعد الذكي AI" : "AI assistant",
        included: false,
      },
      {
        label: isArabic
          ? "تلخيص المستندات بالذكاء الاصطناعي"
          : "AI document summarization",
        included: false,
      },
      {
        label: isArabic ? "إدارة الفريق وأدوار المستخدمين" : "Team and user roles",
        included: false,
      },
      {
        label: isArabic ? "تصدير PDF / Excel كامل" : "Full PDF / Excel export",
        included: false,
      },
      {
        label: isArabic ? "تقارير أساسية" : "Basic reports",
        included: true,
      },
      {
        label: isArabic ? "دعم عادي" : "Standard support",
        included: true,
      },
    ];
  }

  if (code === "PRO") {
    return [
      ...baseFeatures,
      {
        label: isArabic
          ? `المساعد الذكي AI: ${getAiTokenLabel(plan, isArabic)}`
          : `AI assistant: ${getAiTokenLabel(plan, isArabic)}`,
        included: true,
      },
      {
        label: isArabic
          ? "تلخيص المستندات بالذكاء الاصطناعي"
          : "AI document summarization",
        included: true,
      },
      {
        label: isArabic ? "إدارة الفريق وأدوار المستخدمين" : "Team and user roles",
        included: true,
      },
      {
        label: isArabic ? "تصدير PDF / Excel كامل" : "Full PDF / Excel export",
        included: true,
      },
      {
        label: isArabic ? "دعم أسرع" : "Faster support",
        included: true,
      },
    ];
  }

  return [
    ...baseFeatures,
    {
      label: isArabic
        ? `المساعد الذكي AI: ${getAiTokenLabel(plan, isArabic)}`
        : `AI assistant: ${getAiTokenLabel(plan, isArabic)}`,
      included: true,
    },
    {
      label: isArabic
        ? "تلخيص المستندات بالذكاء الاصطناعي"
        : "AI document summarization",
      included: true,
    },
    {
      label: isArabic ? "إدارة الفريق وأدوار المستخدمين" : "Team and user roles",
      included: true,
    },
    {
      label: isArabic ? "تصدير PDF / Excel كامل" : "Full PDF / Excel export",
      included: true,
    },
    {
      label: isArabic ? "دعم أولوية ومخصص" : "Priority dedicated support",
      included: true,
    },
  ];
}

export default function BillingPage() {
  const { locale } = useLocale();
  const isArabic = locale === "ar";
  const billing = translations[locale].billingPage;

  const labels = {
    monthly: isArabic ? "شهرياً" : "monthly",
    yearly: isArabic ? "سنوياً" : "yearly",
    subscriptionStatus: isArabic ? "حالة الاشتراك" : "Subscription status",
    currentPeriodEnd: isArabic ? "نهاية الفترة الحالية" : "Current period end",
    trialEndsAt: isArabic ? "نهاية التجربة" : "Trial ends at",
    noPayments: isArabic
      ? "لا توجد دفعات اشتراك بعد"
      : "No subscription payments yet",
    paymentHistory: isArabic
      ? "سجل دفعات الاشتراك"
      : "Subscription payment history",
    aiEnabled: isArabic ? "مفعل" : "Enabled",
    aiDisabled: isArabic ? "غير مفعل" : "Disabled",
    storage: isArabic ? "التخزين" : "Storage",
    activePlan: isArabic ? "الخطة الحالية" : "Current plan",
  };

  const usageLabels: Record<keyof BillingData["usage"], string> = {
    users: billing.users,
    clients: billing.clients,
    cases: billing.cases,
    documents: billing.documents,
    storage: labels.storage,
    ai: isArabic ? "استهلاك الذكاء الاصطناعي" : "AI token usage",
    payments: billing.payments,
    invoices: billing.invoices,
  };

  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [manualPaymentPlanId, setManualPaymentPlanId] = useState("");
  const [manualPaymentInterval, setManualPaymentInterval] = useState<
    "MONTHLY" | "YEARLY"
  >("MONTHLY");
  const [manualPaymentMethod, setManualPaymentMethod] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submittingManualPayment, setSubmittingManualPayment] = useState(false);

  const selectedManualPlan = useMemo(() => {
    return (
      data?.availablePlans.find((plan) => plan.id === manualPaymentPlanId) ??
      null
    );
  }, [data, manualPaymentPlanId]);

  const selectedManualPaymentMethod = useMemo(() => {
    return (
      data?.manualPaymentSettings.methods.find(
        (method) => method.code === manualPaymentMethod,
      ) ?? null
    );
  }, [data, manualPaymentMethod]);

  function openManualPayment(planId: string) {
    const firstMethod = data?.manualPaymentSettings.methods[0];

    if (!data?.manualPaymentSettings.enabled || !firstMethod) {
      toast.error(
        isArabic
          ? "الدفع اليدوي غير متاح حاليًا. تواصل مع إدارة Viresto."
          : "Manual payment is currently unavailable. Contact Viresto management.",
      );
      return;
    }

    setManualPaymentPlanId(planId);
    setManualPaymentInterval("MONTHLY");
    setManualPaymentMethod(firstMethod.code);
    setReceiptFile(null);
    setManualPaymentOpen(true);
  }

  function closeManualPayment(force = false) {
    if (submittingManualPayment && !force) return;

    setManualPaymentOpen(false);
    setManualPaymentPlanId("");
    setManualPaymentInterval("MONTHLY");
    setManualPaymentMethod("");
    setReceiptFile(null);
  }

  async function copyPaymentValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(
        isArabic ? `تم نسخ ${label}` : `${label} copied`,
      );
    } catch {
      toast.error(isArabic ? "تعذر نسخ المعلومة" : "Could not copy value");
    }
  }

  function openReceipt(paymentId: string) {
    window.open(
      `/api/billing/manual-payment/${paymentId}/receipt`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function submitManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedManualPlan) {
      toast.error(isArabic ? "اختر الخطة أولًا" : "Select a plan first");
      return;
    }

    if (!selectedManualPaymentMethod) {
      toast.error(
        isArabic
          ? "اختر طريقة دفع مفعّلة"
          : "Select an enabled payment method",
      );
      return;
    }

    if (!receiptFile) {
      toast.error(
        isArabic ? "إيصال الدفع مطلوب" : "Payment receipt is required",
      );
      return;
    }

    const formData = new FormData();
    formData.append("planId", selectedManualPlan.id);
    formData.append("interval", manualPaymentInterval);
    formData.append("method", manualPaymentMethod);
    formData.append("receipt", receiptFile);

    setSubmittingManualPayment(true);

    const res = await fetch("/api/billing/manual-payment", {
      method: "POST",
      body: formData,
    });

    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!res.ok || !json.success) {
      toast.error(
        json.message ||
          (isArabic
            ? "تعذر إرسال إيصال الدفع"
            : "Failed to submit payment receipt"),
      );
      setSubmittingManualPayment(false);
      return;
    }

    toast.success(
      json.data?.message ||
        (isArabic
          ? "تم إرسال إيصال الدفع بنجاح"
          : "Payment receipt submitted successfully"),
    );

    setSubmittingManualPayment(false);
    closeManualPayment(true);
    await load();
  }

  const load = useCallback(async () => {
    setLoading(true);

    const res = await fetch("/api/billing");
    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (res.status === 403) {
      toast.error(billing.adminOnly);
      setLoading(false);
      return;
    }

    if (!res.ok || !json.success) {
      toast.error(json.message || billing.loadError);
      setLoading(false);
      return;
    }

    setData(json.data);
    setLoading(false);
  }, [billing.adminOnly, billing.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const trialLabel = useMemo(() => {
    if (!data?.tenant.trialEndsAt && !data?.subscription?.trialEndsAt) {
      return billing.noTrial;
    }

    const effectiveStatus = getEffectiveBillingStatus(
      data.subscription?.status ?? data.tenant.subscriptionStatus,
      data.subscription?.currentPeriodEnd ?? data.period?.currentPeriodEnd,
      data.subscription?.trialEndsAt ??
        data.period?.trialEndsAt ??
        data.tenant.trialEndsAt,
    );

    if (effectiveStatus === "EXPIRED") {
      return isArabic ? "انتهت الفترة التجريبية" : "Trial expired";
    }

    if (
      data.tenant.trialDaysLeft === null ||
      data.tenant.trialDaysLeft === undefined
    ) {
      return billing.unknownTrial;
    }

    if (data.tenant.trialDaysLeft <= 0) {
      return isArabic ? "تنتهي اليوم" : "Ends today";
    }

    return `${billing.daysLeftPrefix} ${data.tenant.trialDaysLeft} ${billing.day}`;
  }, [data, billing, isArabic]);

  if (loading) {
    return <AppLoader fullScreen={false} />;
  }

  if (!data) {
    return (
      <div className="card p-6">
        <h1 className="mb-2 text-2xl font-black">{billing.unavailableTitle}</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {billing.unavailableDescription}
        </p>
      </div>
    );
  }

  const currentPlan = data.currentPlan;
  const subscription = data.subscription;
  const currentStatus = getEffectiveBillingStatus(
    subscription?.status ?? data.tenant.subscriptionStatus,
    subscription?.currentPeriodEnd ?? data.period?.currentPeriodEnd,
    subscription?.trialEndsAt ??
      data.period?.trialEndsAt ??
      data.tenant.trialEndsAt,
  );

  const currentTone = getStatusToneFromStatus(currentStatus);
  const manualPaymentAvailable =
    data.manualPaymentSettings.enabled &&
    data.manualPaymentSettings.methods.length > 0;

  return (
    <div className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black">{billing.title}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {billing.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => openManualPayment(currentPlan.id)}
          disabled={!manualPaymentAvailable}
          className="btn btn-primary"
        >
          {manualPaymentAvailable
            ? isArabic
              ? "تجديد / ترقية الاشتراك"
              : "Renew / Upgrade subscription"
            : isArabic
              ? "الدفع اليدوي غير متاح حاليًا"
              : "Manual payment unavailable"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p
                className="text-sm font-bold"
                style={{ color: "var(--muted)" }}
              >
                {billing.currentPlan}
              </p>
              <h2 className="mt-1 text-3xl font-black">{currentPlan.name}</h2>
              <p
                className="mt-2 text-sm leading-7"
                style={{ color: "var(--muted)" }}
              >
                {getPlanDescription(currentPlan, isArabic)}
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-xs font-black ${statusClasses[currentTone]}`}
            >
              {getStatusLabel(currentStatus, isArabic)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[#286061] dark:bg-[#061b1c]">
              <p
                className="text-xs font-bold"
                style={{ color: "var(--muted)" }}
              >
                {billing.office}
              </p>
              <p className="mt-1 font-black">{data.tenant.name}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[#286061] dark:bg-[#061b1c]">
              <p
                className="text-xs font-bold"
                style={{ color: "var(--muted)" }}
              >
                {billing.maxUsers}
              </p>
              <p className="mt-1 font-black">
                {formatLimit(currentPlan.limits.users, locale)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[#286061] dark:bg-[#061b1c]">
              <p
                className="text-xs font-bold"
                style={{ color: "var(--muted)" }}
              >
                {billing.trialPeriod}
              </p>
              <p className="mt-1 font-black">{trialLabel}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-sm font-bold" style={{ color: "var(--muted)" }}>
            {billing.quickSummary}
          </p>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>{labels.subscriptionStatus}</span>
              <b>{getStatusLabel(currentStatus, isArabic)}</b>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>{labels.currentPeriodEnd}</span>
              <b>{formatDate(subscription?.currentPeriodEnd, locale)}</b>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>{labels.trialEndsAt}</span>
              <b>{formatDate(subscription?.trialEndsAt, locale)}</b>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>{billing.aiDocuments}</span>
              <b>
                {currentPlan.aiEnabled ? labels.aiEnabled : labels.aiDisabled}
              </b>
            </div>
          </div>
        </div>
      </div>

      {data.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100">
          {billing.warning}
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-4 text-xl font-black">{billing.currentUsage}</h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(data.usage) as Array<keyof BillingData["usage"]>).map(
            (key) => {
              const item = data.usage[key];
              const percent = item.percent ?? 0;

              return (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[#286061] dark:bg-[#061b1c]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{usageLabels[key]}</p>
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--muted)" }}
                    >
                      {item.used.toLocaleString(isArabic ? "ar-JO-u-nu-latn" : "en-US")} /{" "}
                      {formatLimit(item.limit, locale)}
                    </p>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-emerald-950/70">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{
                        width: item.limit !== null
                          ? `${Math.min(percent, 100)}%`
                          : "100%",
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    {item.limit !== null
                      ? `${percent}% ${billing.used}`
                      : billing.noLimit}
                  </p>
                </div>
              );
            },
          )}
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-300">
              {isArabic ? "خطط الاشتراك" : "Subscription plans"}
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {billing.availablePlans}
            </h2>
          </div>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {data.availablePlans.map((plan) => {
            const active = plan.isCurrent || plan.id === currentPlan.id;
            const requestEligible =
              !active ||
              ["EXPIRED", "UNPAID", "CANCELLED", "PAST_DUE"].includes(
                currentStatus,
              );
            const canRequest = requestEligible && manualPaymentAvailable;
            const features = getPlanFeatures(plan, isArabic);
            const currentMonthlyPriceJod = moneyToJod(plan.priceMonthly);
            const code = getPlanCode(plan);
            const highlighted = code === "PRO";

            return (
              <div
                key={plan.id}
                className={[
                  "relative flex h-full min-h-[620px] flex-col overflow-hidden rounded-[28px] border p-5 text-white shadow-2xl shadow-emerald-950/10",
                  "bg-[#041718]",
                  highlighted
                    ? "border-emerald-500/55 bg-[#082c2d] ring-1 ring-emerald-400/30"
                    : "border-white/10",
                  active ? "ring-2 ring-emerald-300" : "",
                ].join(" ")}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 0%, rgba(53, 138, 136, 0.22), transparent 42%)",
                  }}
                />

                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex min-h-8 items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {highlighted && (
                        <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-emerald-950">
                          {billing.bestSeller}
                        </span>
                      )}

                      {active && (
                        <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">
                          {labels.activePlan}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-3xl font-black text-emerald-50">
                      {plan.name}
                    </h3>

                    <p className="mt-4 min-h-14 text-sm font-bold leading-7 text-emerald-50/78">
                      {getPlanDescription(plan, isArabic)}
                    </p>
                  </div>

                  <div className="mt-6 rounded-[24px] border border-white/10 bg-black/20 p-5">
                    <div
                      dir="ltr"
                      className="flex items-end justify-end gap-2 text-right"
                    >
                      <span className="text-5xl font-black tracking-tight text-white">
                        {currentMonthlyPriceJod}
                      </span>
                      <span className="pb-2 text-3xl font-black text-white">
                        JOD
                      </span>
                      <span className="pb-2 text-sm font-bold text-emerald-100/65">
                        / {labels.monthly}
                      </span>
                    </div>

                    <p
                      dir="ltr"
                      className="mt-2 text-right text-xs font-bold text-emerald-100/55"
                    >
                      {plan.priceYearly.formatted} / {labels.yearly}
                    </p>
                  </div>

                  <div className="mt-6">
                    <p className="mb-3 text-sm font-black text-emerald-300">
                      {isArabic ? "معلومات الخطة" : "Plan details"}
                    </p>

                    <ul className="space-y-2.5 text-sm">
                      {features.map((feature) => (
                        <li
                          key={feature.label}
                          className={[
                            "flex gap-2 leading-7",
                            feature.included
                              ? "text-emerald-50"
                              : "text-emerald-100/38",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "mt-0.5 shrink-0 font-black",
                              feature.included
                                ? "text-emerald-300"
                                : "text-emerald-100/35",
                            ].join(" ")}
                          >
                            {feature.included ? "✓" : "×"}
                          </span>
                          <span>{feature.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto pt-6">
                    <button
                      type="button"
                      disabled={!canRequest}
                      className={[
                        "w-full rounded-2xl px-5 py-4 text-sm font-black transition",
                        canRequest
                          ? "bg-[#c47a31] text-[#061b1c] shadow-lg shadow-black/20 hover:bg-[#d58a3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1a261] focus-visible:ring-offset-2 focus-visible:ring-offset-[#041718]"
                          : "border border-white/10 bg-white/5 text-emerald-100/60",
                      ].join(" ")}
                      onClick={() => openManualPayment(plan.id)}
                    >
                      {requestEligible && !manualPaymentAvailable
                        ? isArabic
                          ? "الدفع اليدوي غير متاح حاليًا"
                          : "Manual payment unavailable"
                        : active && canRequest
                          ? isArabic
                            ? "تجديد الاشتراك"
                            : "Renew subscription"
                          : active
                            ? billing.currentPlanButton
                            : billing.requestUpgrade}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {manualPaymentOpen && selectedManualPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-payment-title"
        >
          <div
            className={`no-scrollbar max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[28px] border p-5 shadow-2xl ${
              isArabic ? "text-right" : "text-left"
            }`}
            dir={isArabic ? "rtl" : "ltr"}
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 id="manual-payment-title" className="text-2xl font-black">
                  {isArabic ? "إرسال إيصال الدفع" : "Submit payment receipt"}
                </h2>

                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  {isArabic
                    ? "اختر مدة الاشتراك وطريقة الدفع، ثم ارفع صورة الإيصال ليتم مراجعته من الإدارة."
                    : "Choose the billing period and payment method, then upload the receipt for admin review."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeManualPayment()}
                disabled={submittingManualPayment}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-lg font-black transition hover:bg-[var(--input-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c47a31] disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
                aria-label={isArabic ? "إغلاق" : "Close"}
              >
                ×
              </button>
            </div>

            <div
              className="mb-5 rounded-2xl border p-4"
              style={{
                borderColor: "var(--border)",
                background: "var(--input-bg)",
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p
                    className="text-xs font-bold"
                    style={{ color: "var(--muted)" }}
                  >
                    {isArabic ? "الخطة المختارة" : "Selected plan"}
                  </p>

                  <h3 className="text-xl font-black">
                    {selectedManualPlan.name}
                  </h3>
                </div>

                <div className="text-sm font-black">
                  {manualPaymentInterval === "YEARLY"
                    ? selectedManualPlan.priceYearly.formatted
                    : selectedManualPlan.priceMonthly.formatted}
                </div>
              </div>
            </div>

            <form onSubmit={submitManualPayment} className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="font-bold">
                  {isArabic ? "مدة الاشتراك" : "Billing period"}
                </span>

                <select
                  className={`input w-full ${
                    isArabic ? "!text-right" : "!text-left"
                  }`}
                  dir={isArabic ? "rtl" : "ltr"}
                  style={{ textAlign: isArabic ? "right" : "left" }}
                  value={manualPaymentInterval}
                  onChange={(event) =>
                    setManualPaymentInterval(
                      event.target.value === "YEARLY" ? "YEARLY" : "MONTHLY",
                    )
                  }
                  disabled={submittingManualPayment}
                >
                  <option value="MONTHLY">
                    {isArabic
                      ? `شهري - ${selectedManualPlan.priceMonthly.formatted}`
                      : `Monthly - ${selectedManualPlan.priceMonthly.formatted}`}
                  </option>

                  <option value="YEARLY">
                    {isArabic
                      ? `سنوي - ${selectedManualPlan.priceYearly.formatted}`
                      : `Yearly - ${selectedManualPlan.priceYearly.formatted}`}
                  </option>
                </select>
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-bold">
                  {isArabic ? "طريقة الدفع" : "Payment method"}
                </span>

                <select
                  className={`input w-full ${
                    isArabic ? "!text-right" : "!text-left"
                  }`}
                  dir={isArabic ? "rtl" : "ltr"}
                  style={{ textAlign: isArabic ? "right" : "left" }}
                  value={manualPaymentMethod}
                  onChange={(event) =>
                    setManualPaymentMethod(event.target.value)
                  }
                  disabled={submittingManualPayment}
                >
                  <option value="" disabled>
                    {isArabic ? "اختر طريقة الدفع" : "Select payment method"}
                  </option>
                  {data.manualPaymentSettings.methods.map((method) => (
                    <option key={method.code} value={method.code}>
                      {isArabic ? method.labelAr : method.labelEn}
                    </option>
                  ))}
                </select>
              </label>

              {selectedManualPaymentMethod && (
                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--input-bg)",
                  }}
                >
                  <p className="font-black">
                    {isArabic ? "حوّل المبلغ إلى" : "Send the payment to"} {" "}
                    {isArabic
                      ? selectedManualPaymentMethod.labelAr
                      : selectedManualPaymentMethod.labelEn}
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {selectedManualPaymentMethod.fields.map((field) => {
                      const fieldLabel = isArabic
                        ? field.labelAr
                        : field.labelEn;

                      return (
                        <div
                          key={field.key}
                          className="rounded-xl border p-3"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--card)",
                          }}
                        >
                          <p
                            className="text-xs font-bold"
                            style={{ color: "var(--muted)" }}
                          >
                            {fieldLabel}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <p
                              className="min-w-0 break-all font-black"
                              dir={field.direction ?? (isArabic ? "rtl" : "ltr")}
                            >
                              {field.value}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                void copyPaymentValue(field.value, fieldLabel)
                              }
                              className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-black transition hover:bg-[var(--input-bg)]"
                              style={{ borderColor: "var(--border)" }}
                            >
                              {isArabic ? "نسخ" : "Copy"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                className="rounded-2xl border p-4 text-sm leading-7"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--input-bg)",
                  color: "var(--muted)",
                }}
              >
                <p className="font-black" style={{ color: "var(--text)" }}>
                  {isArabic ? "تعليمات الدفع" : "Payment instructions"}
                </p>

                {(isArabic
                  ? data.manualPaymentSettings.instructionsAr
                  : data.manualPaymentSettings.instructionsEn) && (
                  <p className="mt-1 whitespace-pre-line">
                    {isArabic
                      ? data.manualPaymentSettings.instructionsAr
                      : data.manualPaymentSettings.instructionsEn}
                  </p>
                )}

                <p className="mt-2 font-bold">
                  {isArabic
                    ? "بعد التحويل ارفع صورة واضحة للإيصال. لن يتم تفعيل الاشتراك إلا بعد مراجعة الإدارة والتأكد من وصول المبلغ."
                    : "After transferring, upload a clear receipt. The subscription is activated only after admin review and payment confirmation."}
                </p>
              </div>

              <label className="block space-y-2 text-sm">
                <span className="font-bold">
                  {isArabic ? "إيصال الدفع" : "Payment receipt"}
                </span>

                <input
                  type="file"
                  className={`input w-full ${
                    isArabic ? "!text-right" : "!text-left"
                  }`}
                  dir={isArabic ? "rtl" : "ltr"}
                  style={{ textAlign: isArabic ? "right" : "left" }}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={submittingManualPayment}
                  onChange={(event) =>
                    setReceiptFile(event.target.files?.[0] ?? null)
                  }
                />

                <span
                  className="block text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  {isArabic
                    ? "الأنواع المدعومة: JPG, PNG, WebP, PDF — الحد الأقصى 5MB"
                    : "Supported formats: JPG, PNG, WebP, PDF — max 5MB"}
                </span>
              </label>

              <div
                className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
                dir="ltr"
              >
                <button
                  type="button"
                  onClick={() => closeManualPayment()}
                  disabled={submittingManualPayment}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border px-5 py-3 text-sm font-black transition hover:bg-[var(--input-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c47a31] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  {isArabic ? "إلغاء" : "Cancel"}
                </button>

                <button
                  type="submit"
                  disabled={
                    submittingManualPayment || !selectedManualPaymentMethod
                  }
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#c47a31] px-5 py-3 text-sm font-black text-[#061b1c] shadow-lg shadow-black/15 transition hover:bg-[#d58a3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1a261] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingManualPayment
                    ? isArabic
                      ? "جاري الإرسال..."
                      : "Submitting..."
                    : isArabic
                      ? "إرسال للمراجعة"
                      : "Submit for review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-4 text-xl font-black">{labels.paymentHistory}</h2>

        {!data.paymentHistory.length ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {labels.noPayments}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{isArabic ? "التاريخ" : "Date"}</th>
                  <th>{isArabic ? "المبلغ" : "Amount"}</th>
                  <th>{isArabic ? "الخطة" : "Plan"}</th>
                  <th>{isArabic ? "المدة" : "Interval"}</th>
                  <th>{isArabic ? "الحالة" : "Status"}</th>
                  <th>{isArabic ? "طريقة الدفع" : "Method"}</th>
                  <th>{isArabic ? "الإيصال" : "Receipt"}</th>
                </tr>
              </thead>

              <tbody>
                {data.paymentHistory.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      {formatDate(payment.paidAt || payment.createdAt, locale)}
                    </td>
                    <td>{payment.amount.formatted}</td>
                    <td>{payment.plan?.name || "-"}</td>
                    <td>
                      {payment.interval === "YEARLY"
                        ? isArabic
                          ? "سنوي"
                          : "Yearly"
                        : payment.interval === "MONTHLY"
                          ? isArabic
                            ? "شهري"
                            : "Monthly"
                          : "-"}
                    </td>
                    <td>{payment.status}</td>
                    <td>
                      {getPaymentMethodLabel(payment.method, isArabic)}
                    </td>
                    <td>
                      {payment.receiptUrl ? (
                        <button
                          type="button"
                          onClick={() => openReceipt(payment.id)}
                          className="btn btn-ghost"
                        >
                          {isArabic ? "عرض" : "View"}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
