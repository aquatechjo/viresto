"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type TenantDeletionControlsProps = {
  tenantId: string;
  tenantName: string;
  isProtectedTenant: boolean;
  isSuspended: boolean;
  hasActiveSubscription: boolean;
  pendingPaymentCount: number;
};

export default function TenantDeletionControls({
  tenantId,
  tenantName,
  isProtectedTenant,
  isSuspended,
  hasActiveSubscription,
  pendingPaymentCount,
}: TenantDeletionControlsProps) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isProtectedTenant) {
    return (
      <div
        className="rounded-[24px] border p-4"
        style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}
      >
        <p className="font-black">حماية مكتب الشركة</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
          لا يمكن حذف المكتب الذي يحتوي على حساب مدير النظام.
        </p>
      </div>
    );
  }

  const eligible =
    isSuspended && !hasActiveSubscription && pendingPaymentCount === 0;
  const canDelete =
    eligible &&
    acknowledged &&
    confirmation === tenantName &&
    reason.trim().length >= 5 &&
    !busy;

  async function deleteTenant() {
    if (!canDelete) return;

    const confirmed = window.confirm(
      `سيتم حذف مكتب «${tenantName}» وجميع مستخدميه وقضاياه ومستنداته وفواتيره نهائيًا. لا يمكن التراجع. هل تريد المتابعة؟`,
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation,
          reason: reason.trim(),
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json.success) {
        toast.error(json.message || "تعذر حذف المكتب");
        return;
      }

      toast.success(json.data?.message || "تم حذف المكتب نهائيًا");
      router.refresh();
    } catch {
      toast.error("تعذر الاتصال بالخادم لتنفيذ الحذف");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-red-200 bg-red-50/70 p-4 dark:border-red-400/35 dark:bg-red-500/5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h3 className="font-black text-red-700 dark:text-red-200">
            منطقة حذف المكتب
          </h3>
          <p className="mt-1 text-sm text-red-700/75 dark:text-red-200/70">
            الحذف نهائي ويشمل حسابات المكتب وبياناته ومستنداته وسجلاته المالية.
          </p>
        </div>

        <span
          className={eligible ? "badge badge-green" : "badge badge-amber"}
        >
          {eligible ? "جاهز للحذف الآمن" : "متطلبات الحذف غير مكتملة"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <Requirement met={isSuspended} label="المكتب معلّق" />
        <Requirement
          met={!hasActiveSubscription}
          label="لا يوجد اشتراك فعّال"
        />
        <Requirement
          met={pendingPaymentCount === 0}
          label={
            pendingPaymentCount === 0
              ? "لا توجد طلبات دفع معلّقة"
              : `${pendingPaymentCount} طلب دفع يحتاج مراجعة`
          }
        />
      </div>

      {!eligible && (
        <p className="mt-3 text-sm font-bold text-red-700 dark:text-red-200">
          أكمل المتطلبات أعلاه أولًا: أنهِ الاشتراك، راجع طلبات الدفع، ثم علّق
          المكتب.
        </p>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-bold">سبب الحذف</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!eligible || busy}
            className="input"
            placeholder="مثال: مكتب تجريبي تم إنشاؤه بالخطأ"
            maxLength={500}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-bold">
            اكتب اسم المكتب للتأكيد: {tenantName}
          </span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={!eligible || busy}
            className="input"
            autoComplete="off"
            placeholder={tenantName}
          />
        </label>
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          disabled={!eligible || busy}
          className="mt-1 h-4 w-4 accent-red-600"
        />
        <span>أفهم أن الحذف نهائي ولا يمكن استعادة بيانات المكتب بعده.</span>
      </label>

      <button
        type="button"
        onClick={deleteTenant}
        disabled={!canDelete}
        className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-400/40 dark:text-red-200 dark:hover:bg-red-500/10"
      >
        {busy ? "جاري حذف المكتب..." : "حذف المكتب نهائيًا"}
      </button>
    </div>
  );
}

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2 text-sm font-bold ${
        met
          ? "text-emerald-700 dark:text-emerald-200"
          : "text-[var(--text-3)]"
      }`}
      style={{
        borderColor: met ? "rgba(16, 185, 129, 0.35)" : "var(--border)",
        background: "var(--card)",
      }}
    >
      {met ? "✓" : "○"} {label}
    </div>
  );
}
