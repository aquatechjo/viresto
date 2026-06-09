"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PageLoader from "@/components/ui/PageLoader";
import { formatLimit } from "@/lib/plans";
import { useLocale } from "@/lib/useLocale";
import { translations } from "@/lib/i18n";

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

function getPlanFeatures(plan: BillingPlan, isArabic: boolean) {
  const features = [
    isArabic
      ? `حتى ${formatLimit(plan.limits.users, "ar")} مستخدمين`
      : `Up to ${formatLimit(plan.limits.users, "en")} users`,
    isArabic
      ? `حتى ${formatLimit(plan.limits.clients, "ar")} موكل`
      : `Up to ${formatLimit(plan.limits.clients, "en")} clients`,
    isArabic
      ? `حتى ${formatLimit(plan.limits.cases, "ar")} قضية`
      : `Up to ${formatLimit(plan.limits.cases, "en")} cases`,
    isArabic
      ? `حتى ${formatLimit(plan.limits.documents, "ar")} مستند`
      : `Up to ${formatLimit(plan.limits.documents, "en")} documents`,
  ];

  features.push(
    plan.aiEnabled
      ? isArabic
        ? "تحليل مستندات بالذكاء الاصطناعي"
        : "AI document analysis"
      : isArabic
        ? "بدون ميزات الذكاء الاصطناعي"
        : "No AI features",
  );

  return features;
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
      ? "تغيير الخطة سيتم ربطه في الخطوة التالية."
      : "Plan changes will be connected in the next step.",
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
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

  async function changePlan(planCode: string) {
    if (!planCode || changingPlan) return;

    setChangingPlan(planCode);

    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planCode,
        interval: "MONTHLY",
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.success) {
      toast.error(
        json.message ||
          (isArabic ? "تعذر بدء عملية الدفع" : "Could not start checkout"),
      );
      setChangingPlan(null);
      return;
    }

    const checkoutUrl = json.data?.checkoutUrl;

    if (!checkoutUrl) {
      toast.error(
        isArabic ? "رابط الدفع غير متوفر" : "Checkout URL is missing",
      );
      setChangingPlan(null);
      return;
    }

    window.location.href = checkoutUrl;
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
    const provider = params.get("provider");
    const plan = params.get("plan");
    const interval = params.get("interval") || "MONTHLY";

    if (checkout === "cancelled") {
      toast.error(isArabic ? "تم إلغاء عملية الدفع" : "Checkout was cancelled");

      window.history.replaceState({}, "", "/dashboard/billing");
      load();
      return;
    }

    if (checkout !== "success") return;

    if (provider !== "manual") {
      toast.info(
        isArabic
          ? "تم الرجوع من صفحة الدفع. سيتم تحديث الاشتراك بعد تأكيد الدفع."
          : "Returned from checkout. Subscription will update after payment confirmation.",
      );

      window.history.replaceState({}, "", "/dashboard/billing");
      load();
      return;
    }

    if (!plan) return;

    async function activateManualCheckout() {
      setChangingPlan(plan);

      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planCode: plan,
          interval,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        toast.error(
          json.message ||
            (isArabic
              ? "تعذر تفعيل الاشتراك"
              : "Could not activate subscription"),
        );
        setChangingPlan(null);
        return;
      }

      toast.success(
        isArabic
          ? "تم تفعيل الاشتراك بنجاح"
          : "Subscription activated successfully",
      );

      window.history.replaceState({}, "", "/dashboard/billing");

      await load();
      setChangingPlan(null);
    }

    activateManualCheckout();
  }, [isArabic]);

  const trialLabel = useMemo(() => {
    if (!data?.tenant.trialEndsAt) return billing.noTrial;

    if (
      data.tenant.trialDaysLeft === null ||
      data.tenant.trialDaysLeft === undefined
    ) {
      return billing.unknownTrial;
    }

    if (data.tenant.trialDaysLeft <= 0) return billing.trialEndsToday;

    return `${billing.daysLeftPrefix} ${data.tenant.trialDaysLeft} ${billing.day}`;
  }, [data, billing]);

  if (loading) return <PageLoader />;

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
  const currentStatus = subscription?.status ?? data.tenant.subscriptionStatus;
  const currentTone = subscription?.statusTone ?? data.tenant.statusTone;

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
          onClick={() => toast.info(labels.changeComingSoon)}
          className="btn btn-primary"
        >
          {billing.upgradeRequest}
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

        <div className="grid gap-4 lg:grid-cols-3">
          {data.availablePlans.map((plan) => {
            const active = plan.isCurrent || plan.id === currentPlan.id;
            const features = getPlanFeatures(plan, isArabic);

            return (
              <div
                key={plan.id}
                className={`card relative p-5 ${active ? "ring-2 ring-emerald-600" : ""}`}
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

                <p className="mt-2 text-lg font-black">
                  {plan.priceMonthly.formatted}
                  <span
                    className="ms-1 text-xs font-bold"
                    style={{ color: "var(--muted)" }}
                  >
                    / {labels.monthly}
                  </span>
                </p>

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
                    <li key={feature} className="flex gap-2">
                      <span className="text-emerald-600">✓</span>
                      <span>{feature}</span>
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
                    {billing.limits.documents}:{" "}
                    {formatLimit(plan.limits.documents, locale)}
                  </p>
                  <p>
                    {labels.storage}:{" "}
                    {formatLimit(plan.limits.storageMb ?? null, locale)} MB
                  </p>
                </div>

                <button
                  type="button"
                  disabled={active || changingPlan === plan.code}
                  className={`mt-5 w-full ${
                    active ? "btn btn-ghost opacity-70" : "btn btn-primary"
                  }`}
                  onClick={() => changePlan(plan.code)}
                >
                  {active
                    ? billing.currentPlanButton
                    : changingPlan === plan.code
                      ? isArabic
                        ? "جاري التغيير..."
                        : "Changing..."
                      : billing.requestUpgrade}
                </button>
              </div>
            );
          })}
        </div>
      </div>

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
                  <th>{isArabic ? "المزود" : "Provider"}</th>
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
                    <td>{payment.provider}</td>
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
