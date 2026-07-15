"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type ManualPayment = {
  id: string;
  amount: {
    raw: number;
    value: number;
    currency: string;
    formatted: string;
  };
  status: string;
  method?: string | null;
  receiptUrl?: string | null;
  adminNote?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    email?: string | null;
    phone?: string | null;
    status: string;
    plan: string;
  };
  plan: {
    id: string;
    code: string;
    name: string;
  } | null;
  interval: "MONTHLY" | "YEARLY" | null;
  subscription: {
    id: string;
    status: string;
    interval: "MONTHLY" | "YEARLY";
    plan: {
      id: string;
      code: string;
      name: string;
    };
  } | null;
};

type ManualPaymentsResponse = {
  summary: {
    pending: number;
    approved: number;
    rejected: number;
  };
  payments: ManualPayment[];
};

const statusClasses: Record<string, string> = {
  PENDING: "badge badge-amber",
  APPROVED: "badge badge-green",
  REJECTED: "badge badge-red",
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ar-JO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ManualPaymentsPanel() {
  const [data, setData] = useState<ManualPaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    const res = await fetch(`/api/admin/manual-payments?status=${status}`, {
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.success) {
      toast.error(json.message || "تعذر تحميل طلبات الدفع");
      setLoading(false);
      return;
    }

    setData(json.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [status]);

  async function openReceipt(paymentId: string) {
    const res = await fetch(`/api/admin/manual-payments/${paymentId}/receipt`, {
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.success) {
      toast.error(json.message || "تعذر فتح إيصال الدفع");
      return;
    }

    const signedUrl = json.data?.signedUrl;

    if (!signedUrl) {
      toast.error("رابط الإيصال غير متاح");
      return;
    }

    window.open(signedUrl, "_blank", "noopener,noreferrer");
  }

  async function reviewPayment(
    paymentId: string,
    action: "approve" | "reject",
  ) {
    const note =
      action === "reject"
        ? window.prompt("سبب الرفض؟", "الإيصال غير واضح أو غير مطابق")
        : window.prompt("ملاحظة اختيارية", "");

    if (action === "reject" && note === null) return;
    if (action === "approve" && note === null) return;

    setBusyId(paymentId);

    const res = await fetch(
      `/api/admin/manual-payments/${paymentId}/${action}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminNote: note || undefined,
        }),
      },
    );

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.success) {
      toast.error(json.message || "تعذر تنفيذ العملية");
      setBusyId(null);
      return;
    }

    toast.success(json.data?.message || json.message || "تم تنفيذ العملية");
    setBusyId(null);
    await load();
  }

  return (
    <section className="card overflow-hidden p-0">
      <div
        className="flex flex-col gap-4 border-b p-5 xl:flex-row xl:items-center xl:justify-between"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <h2 className="text-xl font-black" style={{ color: "var(--text)" }}>
            طلبات الدفع اليدوي
          </h2>

          <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
            راجع إيصالات الدفع المرسلة من المكاتب وفعّل الاشتراك بعد التأكد من
            الدفع.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatus("PENDING")}
            className={
              status === "PENDING" ? "btn btn-primary" : "btn btn-ghost"
            }
          >
            بانتظار المراجعة
          </button>

          <button
            type="button"
            onClick={() => setStatus("APPROVED")}
            className={
              status === "APPROVED" ? "btn btn-primary" : "btn btn-ghost"
            }
          >
            مفعّلة
          </button>

          <button
            type="button"
            onClick={() => setStatus("REJECTED")}
            className={
              status === "REJECTED" ? "btn btn-primary" : "btn btn-ghost"
            }
          >
            مرفوضة
          </button>

          <button
            type="button"
            onClick={() => setStatus("ALL")}
            className={status === "ALL" ? "btn btn-primary" : "btn btn-ghost"}
          >
            الكل
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--input-bg)",
          }}
        >
          <p className="text-xs font-black" style={{ color: "var(--text-3)" }}>
            بانتظار المراجعة
          </p>
          <p className="mt-1 text-2xl font-black">
            {data?.summary.pending ?? 0}
          </p>
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--input-bg)",
          }}
        >
          <p className="text-xs font-black" style={{ color: "var(--text-3)" }}>
            مفعّلة
          </p>
          <p className="mt-1 text-2xl font-black">
            {data?.summary.approved ?? 0}
          </p>
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: "var(--border)",
            background: "var(--input-bg)",
          }}
        >
          <p className="text-xs font-black" style={{ color: "var(--text-3)" }}>
            مرفوضة
          </p>
          <p className="mt-1 text-2xl font-black">
            {data?.summary.rejected ?? 0}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div
            className="rounded-2xl border p-5 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-3)" }}
          >
            جاري تحميل طلبات الدفع...
          </div>
        ) : !data?.payments.length ? (
          <div
            className="rounded-2xl border p-5 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-3)" }}
          >
            لا توجد طلبات دفع بهذه الحالة.
          </div>
        ) : (
          <div
            className="overflow-x-auto rounded-[24px] border"
            style={{ borderColor: "var(--border)" }}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>المكتب</th>
                  <th>الخطة</th>
                  <th>المدة</th>
                  <th>المبلغ</th>
                  <th>طريقة الدفع</th>
                  <th>الحالة</th>
                  <th>تاريخ الطلب</th>
                  <th>الإيصال</th>
                  <th>إجراء</th>
                </tr>
              </thead>

              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <div className="font-black">{payment.tenant.name}</div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--text-3)" }}
                      >
                        {payment.tenant.email || payment.tenant.slug}
                      </div>
                    </td>

                    <td>
                      <div className="font-black">{payment.plan?.name || "-"}</div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--text-3)" }}
                      >
                        {payment.plan?.code || "-"}
                      </div>
                    </td>

                    <td>
                      {payment.interval === "YEARLY"
                        ? "سنوي"
                        : payment.interval === "MONTHLY"
                          ? "شهري"
                          : "-"}
                    </td>

                    <td className="font-black">{payment.amount.formatted}</td>

                    <td>{payment.method || "-"}</td>

                    <td>
                      <span
                        className={
                          statusClasses[payment.status] ?? "badge badge-gray"
                        }
                      >
                        {payment.status}
                      </span>
                    </td>

                    <td>{formatDate(payment.createdAt)}</td>

                    <td>
                      {payment.receiptUrl ? (
                        <button
                          type="button"
                          onClick={() => openReceipt(payment.id)}
                          className="btn btn-ghost"
                        >
                          عرض
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td>
                      {payment.status === "PENDING" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === payment.id}
                            onClick={() => reviewPayment(payment.id, "approve")}
                            className="btn btn-primary"
                          >
                            تفعيل
                          </button>

                          <button
                            type="button"
                            disabled={busyId === payment.id}
                            onClick={() => reviewPayment(payment.id, "reject")}
                            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                          >
                            رفض
                          </button>
                        </div>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-3)" }}
                        >
                          تمت المراجعة
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
