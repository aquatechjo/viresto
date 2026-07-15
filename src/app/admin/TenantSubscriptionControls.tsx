"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type PlanOption = {
  id: string;
  code: string;
  name: string;
  currency: string;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
};

type CurrentSubscription = {
  id: string;
  status: string;
  effectiveStatus: string;
  interval: "MONTHLY" | "YEARLY";
  provider: string;
  currency: string;
  amount: number;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  plan: {
    id: string;
    code: string;
    name: string;
    maxUsers: number;
  };
} | null;

type AdminAction =
  | "ACTIVATE"
  | "RENEW"
  | "CHANGE_PLAN"
  | "CANCEL_AT_PERIOD_END"
  | "UNDO_CANCEL"
  | "END_NOW";

const statusLabels: Record<string, string> = {
  ACTIVE: "نشط",
  TRIALING: "فترة تجريبية",
  PAST_DUE: "متأخر الدفع",
  UNPAID: "غير مدفوع",
  CANCELLED: "منتهي",
  EXPIRED: "منتهي",
  MISSING: "لا يوجد اشتراك",
};

const statusClasses: Record<string, string> = {
  ACTIVE: "badge badge-green",
  TRIALING: "badge badge-blue",
  PAST_DUE: "badge badge-amber",
  UNPAID: "badge badge-amber",
  CANCELLED: "badge badge-red",
  EXPIRED: "badge badge-red",
  MISSING: "badge badge-gray",
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ar-JO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: number, currency: string) {
  return `${(value / 1000).toLocaleString("en-US")} ${currency}`;
}

const actionPrompts: Record<AdminAction, string> = {
  ACTIVATE: "اكتب سبب تفعيل الاشتراك إداريًا",
  RENEW: "اكتب سبب تجديد الاشتراك إداريًا",
  CHANGE_PLAN: "اكتب سبب تغيير خطة الاشتراك",
  CANCEL_AT_PERIOD_END: "اكتب سبب جدولة إنهاء الاشتراك",
  UNDO_CANCEL: "اكتب سبب إلغاء الإنهاء المجدول",
  END_NOW: "اكتب سبب إنهاء الاشتراك فورًا",
};

export default function TenantSubscriptionControls({
  tenantId,
  isProtectedTenant,
  plans,
  current,
}: {
  tenantId: string;
  isProtectedTenant: boolean;
  plans: PlanOption[];
  current: CurrentSubscription;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(current?.plan.id ?? plans[0]?.id ?? "");
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">(
    current?.interval ?? "MONTHLY",
  );
  const [busyAction, setBusyAction] = useState<AdminAction | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === planId) ?? null,
    [plans, planId],
  );

  const isActive = ["ACTIVE", "TRIALING"].includes(
    current?.effectiveStatus ?? "MISSING",
  );

  const selectedMatchesCurrent =
    current?.plan.id === planId && current.interval === interval;

  async function execute(action: AdminAction) {
    if (action === "END_NOW") {
      const confirmed = window.confirm(
        "سيتم إيقاف وصول المكتب فورًا وتحويل الاشتراك إلى منتهي. هل أنت متأكد؟",
      );

      if (!confirmed) return;
    }

    const reason = window.prompt(actionPrompts[action], "");

    if (reason === null) return;

    if (reason.trim().length < 3) {
      toast.error("اكتب سببًا واضحًا للإجراء");
      return;
    }

    setBusyAction(action);

    const response = await fetch(
      `/api/admin/tenants/${tenantId}/subscription`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          planId,
          interval,
          reason: reason.trim(),
        }),
      },
    );

    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json.success) {
      toast.error(json.message || "تعذر تنفيذ إجراء الاشتراك");
      setBusyAction(null);
      return;
    }

    toast.success(json.data?.message || "تم تحديث الاشتراك بنجاح");
    setBusyAction(null);
    router.refresh();
  }

  const selectedAmount = selectedPlan
    ? interval === "YEARLY"
      ? selectedPlan.priceYearly
      : selectedPlan.priceMonthly
    : 0;

  const effectiveStatus = current?.effectiveStatus ?? "MISSING";

  return (
    <div
      className="rounded-[24px] border p-4"
      style={{
        borderColor: "var(--border)",
        background: "var(--input-bg)",
      }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black" style={{ color: "var(--text)" }}>
              الاشتراك الفعلي
            </h3>

            <span
              className={
                statusClasses[effectiveStatus] ?? "badge badge-gray"
              }
            >
              {statusLabels[effectiveStatus] ?? effectiveStatus}
            </span>

            {current?.cancelAtPeriodEnd && (
              <span className="badge badge-amber">سينتهي بنهاية المدة</span>
            )}
          </div>

          <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
            هذه البيانات مرتبطة بسجل الاشتراك الحقيقي الذي يحدد صلاحية المكتب
            وحدود خطته.
          </p>
        </div>

        {isProtectedTenant && (
          <span className="badge badge-blue">مكتب النظام محمي من الإنهاء</span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["الخطة", current ? `${current.plan.name} (${current.plan.code})` : "-"],
          ["المدة", current?.interval === "YEARLY" ? "سنوي" : current ? "شهري" : "-"],
          ["المبلغ المسجل", current ? formatMoney(current.amount, current.currency) : "-"],
          ["بداية المدة", formatDate(current?.currentPeriodStart)],
          ["نهاية المدة", formatDate(current?.currentPeriodEnd)],
          ["المزود", current?.provider ?? "-"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border p-3"
            style={{
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
          >
            <p className="text-xs font-bold" style={{ color: "var(--text-3)" }}>
              {label}
            </p>
            <p className="mt-1 text-sm font-black" style={{ color: "var(--text)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-1 text-sm">
          <span className="font-bold">الخطة المطلوبة</span>
          <select
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            className="input"
            disabled={Boolean(busyAction)}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.code} — {plan.maxUsers} مستخدم
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-bold">مدة الاشتراك</span>
          <select
            value={interval}
            onChange={(event) =>
              setInterval(event.target.value === "YEARLY" ? "YEARLY" : "MONTHLY")
            }
            className="input"
            disabled={Boolean(busyAction)}
          >
            <option value="MONTHLY">شهري</option>
            <option value="YEARLY">سنوي</option>
          </select>
        </label>

        <div className="flex min-w-44 items-end">
          <div
            className="w-full rounded-xl border px-4 py-3 text-center text-sm font-black"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            {selectedPlan
              ? formatMoney(selectedAmount, selectedPlan.currency)
              : "-"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!isActive ? (
          <button
            type="button"
            onClick={() => execute("ACTIVATE")}
            disabled={!selectedPlan || Boolean(busyAction)}
            className="btn btn-primary"
          >
            {busyAction === "ACTIVATE" ? "جاري التفعيل..." : "تفعيل الاشتراك"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => execute("RENEW")}
              disabled={Boolean(busyAction)}
              className="btn btn-primary"
            >
              {busyAction === "RENEW" ? "جاري التجديد..." : "تجديد المدة"}
            </button>

            <button
              type="button"
              onClick={() => execute("CHANGE_PLAN")}
              disabled={
                !selectedPlan || selectedMatchesCurrent || Boolean(busyAction)
              }
              className="btn btn-ghost"
            >
              {busyAction === "CHANGE_PLAN" ? "جاري التغيير..." : "تغيير الخطة"}
            </button>

            {current?.cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={() => execute("UNDO_CANCEL")}
                disabled={Boolean(busyAction)}
                className="btn btn-ghost"
              >
                إلغاء الإنهاء المجدول
              </button>
            ) : !isProtectedTenant ? (
              <button
                type="button"
                onClick={() => execute("CANCEL_AT_PERIOD_END")}
                disabled={Boolean(busyAction)}
                className="btn btn-ghost"
              >
                إنهاء بنهاية المدة
              </button>
            ) : null}

            {!isProtectedTenant && (
              <button
                type="button"
                onClick={() => execute("END_NOW")}
                disabled={Boolean(busyAction)}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                {busyAction === "END_NOW" ? "جاري الإنهاء..." : "إنهاء الآن"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
