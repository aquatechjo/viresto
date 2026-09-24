"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type BillingCycle = "MONTHLY" | "YEARLY";

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
    interval: BillingCycle;
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
    plan: BillingPlan;
  } | null;
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
  period?: {
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
  };
}

const statusClasses: Record<StatusTone, string> = {
  success:
    "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-400/30 dark:bg-[var(--brand-surface-hover)] dark:text-emerald-50",
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
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutTimedOut, setCheckoutTimedOut] = useState(false);
  const checkoutBaselineRef = useRef<string | null>(null);
  const checkoutAttemptsRef = useRef(0);

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [upgradingKey, setUpgradingKey] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    params.delete("checkout");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );

    setCheckoutPending(true);
  }, []);

  useEffect(() => {
    if (!checkoutPending || !data) return undefined;

    if (checkoutBaselineRef.current === null) {
      checkoutBaselineRef.current = data.subscription?.updatedAt ?? "";
      checkoutAttemptsRef.current = 0;
    }

    if (
      data.subscription?.updatedAt &&
      data.subscription.updatedAt !== checkoutBaselineRef.current
    ) {
      setCheckoutPending(false);
      toast.success(
        isArabic
          ? "تم تفعيل اشتراكك بنجاح"
          : "Your subscription has been activated",
      );
      return undefined;
    }

    const timer = setTimeout(async () => {
      checkoutAttemptsRef.current += 1;

      if (checkoutAttemptsRef.current >= 15) {
        setCheckoutPending(false);
        setCheckoutTimedOut(true);
        return;
      }

      await load();
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [checkoutPending, data, load, isArabic]);

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

  async function handleUpgrade(plan: BillingPlan, cycle: BillingCycle) {
    const key = `${plan.id}:${cycle}`;
    setUpgradingKey(key);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.code,
          billingCycle: cycle.toLowerCase(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!res.ok || !json.success) {
        toast.error(
          json.message ||
            (isArabic ? "تعذر بدء عملية الترقية" : "Could not start the upgrade"),
        );
        return;
      }

      if (json.data?.mode === "checkout" && json.data?.url) {
        window.location.href = json.data.url;
        return;
      }

      if (json.data?.mode === "updated") {
        toast.success(
          isArabic
            ? "تم تغيير خطتك بنجاح. سيتم تعديل رصيدك تلقائيًا حسب سياسة Polar."
            : "Your plan has been changed. Your balance will be adjusted automatically per Polar's policy.",
        );
        await load();
        return;
      }

      toast.error(isArabic ? "استجابة غير متوقعة" : "Unexpected response");
    } catch {
      toast.error(
        isArabic ? "تعذر الاتصال بخدمة الدفع" : "Could not reach the payment service",
      );
    } finally {
      setUpgradingKey(null);
    }
  }

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
  const hasLiveSubscription = ["ACTIVE", "TRIALING"].includes(currentStatus);

  return (
    <div className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black">{billing.title}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {billing.subtitle}
          </p>
        </div>
      </div>

      {checkoutPending && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100">
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"
            aria-hidden="true"
          />
          {isArabic
            ? "جاري تفعيل اشتراكك... قد يستغرق ذلك بضع ثوانٍ."
            : "Activating your subscription... this may take a few seconds."}
        </div>
      )}

      {checkoutTimedOut && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100">
          {isArabic
            ? "الدفع تم بنجاح، لكن تفعيل الاشتراك يستغرق وقتًا أطول من المعتاد. سيتم تحديث الحالة تلقائيًا، أو يمكنك تحديث الصفحة لاحقًا."
            : "Payment succeeded, but activation is taking longer than usual. Your status will update automatically, or refresh this page later."}
        </div>
      )}

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
            <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[var(--brand-border-strong)] dark:bg-[var(--brand-canvas)]">
              <p
                className="text-xs font-bold"
                style={{ color: "var(--muted)" }}
              >
                {billing.office}
              </p>
              <p className="mt-1 font-black">{data.tenant.name}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[var(--brand-border-strong)] dark:bg-[var(--brand-canvas)]">
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

            <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[var(--brand-border-strong)] dark:bg-[var(--brand-canvas)]">
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
                  className="rounded-2xl border border-slate-200 bg-white/40 p-4 dark:border-[var(--brand-border-strong)] dark:bg-[var(--brand-canvas)]"
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-300">
              {isArabic ? "خطط الاشتراك" : "Subscription plans"}
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {billing.availablePlans}
            </h2>
          </div>

          <div
            className="inline-flex items-center gap-1 self-start rounded-2xl border p-1"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}
            role="group"
            aria-label={isArabic ? "دورة الفوترة" : "Billing cycle"}
          >
            <button
              type="button"
              onClick={() => setBillingCycle("MONTHLY")}
              className={[
                "rounded-xl px-4 py-2 text-sm font-black transition",
                billingCycle === "MONTHLY"
                  ? "bg-[var(--landing-copper)] text-[var(--landing-canvas)]"
                  : "text-[var(--text)]",
              ].join(" ")}
            >
              {labels.monthly}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("YEARLY")}
              className={[
                "rounded-xl px-4 py-2 text-sm font-black transition",
                billingCycle === "YEARLY"
                  ? "bg-[var(--landing-copper)] text-[var(--landing-canvas)]"
                  : "text-[var(--text)]",
              ].join(" ")}
            >
              {labels.yearly}
            </button>
          </div>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {data.availablePlans.map((plan) => {
            const active = plan.isCurrent || plan.id === currentPlan.id;
            const isCurrentSelection =
              active && hasLiveSubscription && subscription?.interval === billingCycle;
            const features = getPlanFeatures(plan, isArabic);
            const price =
              billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
            const code = getPlanCode(plan);
            const highlighted = code === "PRO";
            const key = `${plan.id}:${billingCycle}`;
            const isUpgrading = upgradingKey === key;

            return (
              <div
                key={plan.id}
                className={[
                  "relative flex h-full min-h-[620px] flex-col overflow-hidden rounded-[28px] border p-5 text-white shadow-2xl shadow-emerald-950/10",
                  "bg-[var(--landing-canvas)]",
                  highlighted
                    ? "border-emerald-500/55 bg-[var(--landing-shell)] ring-1 ring-emerald-400/30"
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
                        {price.formatted}
                      </span>
                      <span className="pb-2 text-sm font-bold text-emerald-100/65">
                        / {billingCycle === "YEARLY" ? labels.yearly : labels.monthly}
                      </span>
                    </div>
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
                      disabled={isCurrentSelection || isUpgrading}
                      className={[
                        "w-full rounded-2xl px-5 py-4 text-sm font-black transition",
                        isCurrentSelection
                          ? "border border-white/10 bg-white/5 text-emerald-100/60"
                          : "bg-[var(--landing-copper)] text-[var(--landing-canvas)] shadow-lg shadow-black/20 hover:bg-[var(--landing-copper-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-copper-hover)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--landing-canvas)] disabled:cursor-not-allowed disabled:opacity-70",
                      ].join(" ")}
                      onClick={() => void handleUpgrade(plan, billingCycle)}
                    >
                      {isUpgrading
                        ? isArabic
                          ? "جاري المعالجة..."
                          : "Processing..."
                        : isCurrentSelection
                          ? billing.currentPlanButton
                          : active
                            ? isArabic
                              ? "تغيير دورة الفوترة"
                              : "Change billing cycle"
                            : isArabic
                              ? "الاشتراك الآن"
                              : "Subscribe now"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
