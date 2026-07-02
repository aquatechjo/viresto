"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatLimit } from "@/lib/plans";
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
  };
  aiEnabled: boolean;
  sortOrder?: number;
  isCurrent?: boolean;
}

interface SubscriptionPayment {
  id: string;
  provider: string;
  providerChargeId?: string | null;
  providerInvoiceId?: string | null;
  amount: Money;
  currency: string;
  status: string;
  method?: string | null;
  receiptUrl?: string | null;
  adminNote?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
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
    provider: string;
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
  currentPlan: BillingPlan;
  usage: {
    users: UsageItem;
    clients: UsageItem;
    cases: UsageItem;
    documents: UsageItem;
    payments: UsageItem;
    invoices: UsageItem;
  };
  warnings: Array<{ key: string; percent: number | null }>;
  availablePlans: BillingPlan[];
  period?: {
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
  };
}

const statusClasses: Record<StatusTone, string> = {
  success:
    "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-400/30 dark:bg-[#1f4d35] dark:text-emerald-50",
  warning:
    "border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200",
  danger:
    "border border-red-200 bg-red-100 text-red-700 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200",
  muted:
    "border border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white/70",
};

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return locale === "ar" ? "غير محدد" : "Not set";

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-US", {
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

function getOfficialMonthlyPriceJod(plan: BillingPlan) {
  switch (getPlanCode(plan)) {
    case "PRO":
      return 40;
    case "BUSINESS":
      return 80;
    default:
      return null;
  }
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
        label: isArabic ? "تخصيص شعار المكتب" : "Office logo customization",
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
        label: isArabic ? "تخصيص شعار المكتب" : "Office logo customization",
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
      label: isArabic ? "تخصيص شعار المكتب" : "Office logo customization",
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
    billingProvider: isArabic ? "مزود الدفع" : "Billing provider",
    currentPeriodEnd: isArabic ? "نهاية الفترة الحالية" : "Current period end",
    trialEndsAt: isArabic ? "نهاية التجربة" : "Trial ends at",
    noPayments: isArabic
      ? "لا توجد دفعات اشتراك بعد"
      : "No subscription payments yet",
    paymentHistory: isArabic
      ? "سجل دفعات الاشتراك"
      : "Subscription payment history",
    changeComingSoon: isArabic
      ? "الدفع الإلكتروني وتغيير الخطة من داخل النظام غير متاحين حالياً. لتفعيل أو تجديد الاشتراك يرجى التواصل مع إدارة Viresto."
      : "Online payments and in-app plan changes are currently disabled. Please contact Viresto management to activate or renew your subscription.",
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
  const [manualPaymentMethod, setManualPaymentMethod] = useState("CliQ");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submittingManualPayment, setSubmittingManualPayment] = useState(false);

  const selectedManualPlan = useMemo(() => {
    return (
      data?.availablePlans.find((plan) => plan.id === manualPaymentPlanId) ??
      null
    );
  }, [data, manualPaymentPlanId]);

  function openManualPayment(planId: string) {
    setManualPaymentPlanId(planId);
    setManualPaymentInterval("MONTHLY");
    setManualPaymentMethod("CliQ");
    setReceiptFile(null);
    setManualPaymentOpen(true);
  }

  function closeManualPayment() {
    if (submittingManualPayment) return;

    setManualPaymentOpen(false);
    setManualPaymentPlanId("");
    setManualPaymentInterval("MONTHLY");
    setManualPaymentMethod("CliQ");
    setReceiptFile(null);
  }

  async function openReceipt(paymentId: string) {
    const res = await fetch(
      `/api/billing/manual-payment/${paymentId}/receipt`,
      {
        cache: "no-store",
      },
    );

    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }

    if (!res.ok || !json.success) {
      toast.error(
        json.message ||
          (isArabic
            ? "تعذر فتح إيصال الدفع"
            : "Failed to open payment receipt"),
      );
      return;
    }

    const signedUrl = json.data?.signedUrl;

    if (!signedUrl) {
      toast.error(
        isArabic ? "رابط الإيصال غير متاح" : "Receipt link is unavailable",
      );
      return;
    }

    window.open(signedUrl, "_blank", "noopener,noreferrer");
  }

  async function submitManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedManualPlan) {
      toast.error(isArabic ? "اختر الخطة أولًا" : "Select a plan first");
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
    closeManualPayment();
    await load();
  }

  async function load() {
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
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");

    if (!checkout) return;

    toast.info(labels.changeComingSoon);
    window.history.replaceState({}, "", "/dashboard/billing");
  }, [labels.changeComingSoon]);

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
          className="btn btn-primary"
        >
          {isArabic ? "تجديد / ترقية الاشتراك" : "Renew / Upgrade subscription"}
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
                {currentPlan.description || "—"}
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-xs font-black ${statusClasses[currentTone]}`}
            >
              {getStatusLabel(currentStatus, isArabic)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[#335f49] dark:bg-[#0b1f16]">
              <p
                className="text-xs font-bold"
                style={{ color: "var(--muted)" }}
              >
                {billing.office}
              </p>
              <p className="mt-1 font-black">{data.tenant.name}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[#335f49] dark:bg-[#0b1f16]">
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

            <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[#335f49] dark:bg-[#0b1f16]">
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
              <span>{labels.billingProvider}</span>
              <b>{subscription?.provider ?? "MANUAL"}</b>
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
                  className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[#335f49] dark:bg-[#0b1f16]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{usageLabels[key]}</p>
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--muted)" }}
                    >
                      {item.used.toLocaleString(isArabic ? "ar-JO" : "en-US")} /{" "}
                      {formatLimit(item.limit, locale)}
                    </p>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-emerald-950/70">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{
                        width: item.limit
                          ? `${Math.min(percent, 100)}%`
                          : "100%",
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    {item.limit
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
        <h2 className="mb-4 text-xl font-black">{billing.availablePlans}</h2>

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {data.availablePlans.map((plan) => {
            const active = plan.isCurrent || plan.id === currentPlan.id;
            const canRequest =
              !active ||
              ["EXPIRED", "UNPAID", "CANCELLED", "PAST_DUE"].includes(
                currentStatus,
              );
            const features = getPlanFeatures(plan, isArabic);
            const officialMonthlyPrice = getOfficialMonthlyPriceJod(plan);
            const currentMonthlyPriceJod = moneyToJod(plan.priceMonthly);
            const showLaunchPrice =
              officialMonthlyPrice !== null &&
              currentMonthlyPriceJod < officialMonthlyPrice;

            return (
              <div
                key={plan.id}
                className={`card relative flex h-full flex-col p-5 ${active ? "ring-2 ring-emerald-600" : ""}`}
              >
                {plan.code === "PRO" && (
                  <span
                    className={`absolute top-4 ${
                      isArabic ? "left-4" : "right-4"
                    } badge badge-success`}
                  >
                    {billing.bestSeller}
                  </span>
                )}

                <h3 className="mt-1 text-2xl font-black">{plan.name}</h3>

                <div className="mt-2">
                  <p className="text-lg font-black">
                    {plan.priceMonthly.formatted}
                    <span
                      className="ms-1 text-xs font-bold"
                      style={{ color: "var(--muted)" }}
                    >
                      / {labels.monthly}
                    </span>
                  </p>

                  {showLaunchPrice && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-200">
                        {isArabic ? "سعر الإطلاق" : "Launch price"}
                      </span>
                      <span
                        className="line-through"
                        style={{ color: "var(--muted)" }}
                      >
                        {officialMonthlyPrice} JOD
                      </span>
                    </div>
                  )}
                </div>

                <p
                  className="mt-1 text-xs font-bold"
                  style={{ color: "var(--muted)" }}
                >
                  {plan.priceYearly.formatted} / {labels.yearly}
                </p>

                <p
                  className="mt-2 min-h-12 text-sm leading-7"
                  style={{ color: "var(--muted)" }}
                >
                  {plan.description || "—"}
                </p>

                <ul className="mt-4 space-y-2 text-sm">
                  {features.map((feature) => (
                    <li
                      key={feature.label}
                      className={[
                        "flex gap-2",
                        feature.included ? "" : "text-slate-400 dark:text-emerald-100/45",
                      ].join(" ")}
                    >
                      <span
                        className={
                          feature.included
                            ? "text-emerald-600"
                            : "text-slate-400 dark:text-emerald-100/45"
                        }
                      >
                        {feature.included ? "✓" : "×"}
                      </span>
                      <span>{feature.label}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-black/5 p-3 text-xs leading-6 dark:border-[#335f49] dark:bg-[#0b1f16] dark:text-emerald-100/85">
                  <p>
                    {billing.limits.users}:{" "}
                    {formatLimit(plan.limits.users, locale)}
                  </p>
                  <p>
                    {billing.limits.clients}:{" "}
                    {formatLimit(plan.limits.clients, locale)}
                  </p>
                  <p>
                    {billing.limits.cases}:{" "}
                    {formatLimit(plan.limits.cases, locale)}
                  </p>
                  <p>
                    {billing.limits.documents}: {getDocumentsLimitLabel(isArabic)}
                  </p>
                  <p>
                    {labels.storage}: {formatStorageLimit(plan.limits.storageMb ?? null, locale)}
                  </p>
                </div>

                <div className="mt-auto pt-5">
                  <button
                    type="button"
                    disabled={!canRequest}
                    className={`w-full ${
                      canRequest ? "btn btn-primary" : "btn btn-ghost opacity-70"
                    }`}
                    onClick={() => openManualPayment(plan.id)}
                  >
                    {active && canRequest
                      ? isArabic
                        ? "تجديد الاشتراك"
                        : "Renew subscription"
                      : active
                        ? billing.currentPlanButton
                        : billing.requestUpgrade}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {manualPaymentOpen && selectedManualPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-2xl rounded-[28px] border p-5 shadow-2xl"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">
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
                onClick={closeManualPayment}
                disabled={submittingManualPayment}
                className="btn btn-ghost"
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
                  className="input"
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
                  className="input"
                  value={manualPaymentMethod}
                  onChange={(event) =>
                    setManualPaymentMethod(event.target.value)
                  }
                  disabled={submittingManualPayment}
                >
                  <option value="CliQ">CliQ</option>
                  <option value="Bank Transfer">
                    {isArabic ? "تحويل بنكي" : "Bank Transfer"}
                  </option>
                  <option value="Wallet">
                    {isArabic ? "محفظة إلكترونية" : "Wallet"}
                  </option>
                  <option value="Cash Deposit">
                    {isArabic ? "إيداع نقدي" : "Cash Deposit"}
                  </option>
                </select>
              </label>

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

                <p className="mt-1">
                  {isArabic
                    ? "بعد الدفع بالطريقة المتفق عليها، ارفع صورة واضحة للإيصال. لن يتم تفعيل الاشتراك إلا بعد مراجعة الإدارة."
                    : "After paying using the agreed method, upload a clear receipt. The subscription will be activated after admin review."}
                </p>
              </div>

              <label className="block space-y-2 text-sm">
                <span className="font-bold">
                  {isArabic ? "إيصال الدفع" : "Payment receipt"}
                </span>

                <input
                  type="file"
                  className="input"
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

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeManualPayment}
                  disabled={submittingManualPayment}
                  className="btn btn-ghost"
                >
                  {isArabic ? "إلغاء" : "Cancel"}
                </button>

                <button
                  type="submit"
                  disabled={submittingManualPayment}
                  className="btn btn-primary"
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

        {!subscription?.payments?.length ? (
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
                  <th>{isArabic ? "الحالة" : "Status"}</th>
                  <th>{isArabic ? "طريقة الدفع" : "Method"}</th>
                  <th>{isArabic ? "المزود" : "Provider"}</th>
                  <th>{isArabic ? "الإيصال" : "Receipt"}</th>
                </tr>
              </thead>

              <tbody>
                {subscription.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      {formatDate(payment.paidAt || payment.createdAt, locale)}
                    </td>
                    <td>{payment.amount.formatted}</td>
                    <td>{payment.status}</td>
                    <td>{payment.method || "-"}</td>
                    <td>{payment.provider}</td>
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
