"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageLoader from "@/components/ui/PageLoader";
import EmptyState from "@/components/ui/EmptyState";
import {
  getApiMessage,
  isPlanLimitResponse,
  planLimitMessage,
} from "@/lib/plan-ui";

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  _count?: {
    cases: number;
    appointments: number;
  };
}

interface CreateClientModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ar-JO");
}

function cleanValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isTooLong(value: string, max: number) {
  return cleanValue(value).length > max;
}

function looksLikeBrowserToken(value: string) {
  const cleaned = cleanValue(value);
  if (cleaned.length < 55) return false;

  const hasArabic = /[\u0600-\u06FF]/.test(cleaned);
  const hasSpaces = /\s/.test(cleaned);
  const tokenLikeChars = /^[A-Za-z0-9_+\-=/.:]+$/.test(cleaned);

  return !hasArabic && !hasSpaces && tokenLikeChars;
}

function normalizeClientForm(form: {
  name: string;
  email: string;
  phone: string;
  nationalId: string;
  address: string;
  notes: string;
}) {
  return {
    name: cleanValue(form.name),
    email: cleanValue(form.email),
    phone: cleanValue(form.phone),
    nationalId: cleanValue(form.nationalId),
    address: cleanValue(form.address),
    notes: form.notes.trim(),
  };
}

function validateClientPayload(payload: ReturnType<typeof normalizeClientForm>) {
  if (!payload.name) return "اسم الموكل مطلوب.";

  if (isTooLong(payload.name, 120)) return "اسم الموكل طويل جدًا.";
  if (isTooLong(payload.phone, 30)) return "رقم الهاتف طويل جدًا.";
  if (isTooLong(payload.email, 120)) return "البريد الإلكتروني طويل جدًا.";
  if (isTooLong(payload.nationalId, 30)) return "الرقم الوطني / رقم الهوية طويل جدًا.";
  if (isTooLong(payload.address, 180)) return "العنوان طويل جدًا.";
  if (payload.notes.length > 700) return "الملاحظات طويلة جدًا.";

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return "البريد الإلكتروني غير صالح.";
  }

  if (
    looksLikeBrowserToken(payload.phone) ||
    looksLikeBrowserToken(payload.email) ||
    looksLikeBrowserToken(payload.nationalId) ||
    looksLikeBrowserToken(payload.address)
  ) {
    return "يبدو أن المتصفح عبّأ أحد الحقول تلقائيًا بقيمة غير صحيحة. امسح الحقول وأدخل البيانات يدويًا.";
  }

  return "";
}

function CreateClientModal({ onClose, onCreated }: CreateClientModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    nationalId: "",
    address: "",
    notes: "",
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const payload = normalizeClientForm(form);
    const validationError = validateClientPayload(payload);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        const message = isPlanLimitResponse(data)
          ? planLimitMessage(
              data,
              "وصلت إلى حد الموكلين المسموح في خطتك الحالية.",
            )
          : getApiMessage(data, "تعذر إضافة الموكل");

        setError(message);
        return;
      }

      onCreated();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl rounded-[28px] border border-[#335f49] bg-[#10291d] p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-emerald-50">إضافة موكل</h2>
            <p className="mt-1 text-sm font-semibold text-emerald-100/60">
              إضافة بيانات موكل جديد داخل المكتب
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#08291d] text-xl text-emerald-100 transition hover:bg-[#173827]"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-amber-100">
            <h3 className="font-black">تعذر تنفيذ العملية</h3>
            <p className="mt-1 text-sm font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={submit} autoComplete="off" className="space-y-4">
          <input
            className="hidden"
            name="username"
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            readOnly
          />
          <input
            className="hidden"
            name="password"
            type="password"
            autoComplete="new-password"
            tabIndex={-1}
            aria-hidden="true"
            readOnly
          />
          <div>
            <label className="mb-2 block text-sm font-black text-emerald-100">
              اسم الموكل <span className="text-red-300">*</span>
            </label>
<input
  className="input"
  name="viresto_client_name"
  autoComplete="new-password"
  maxLength={120}
  placeholder="اسم الموكل"
  value={form.name}
  onChange={(event) =>
    setForm({ ...form, name: event.target.value })
  }
  required
/>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black text-emerald-100">
                رقم الهاتف
              </label>
<input
  className="input"
  name="viresto_client_phone"
  type="tel"
  inputMode="tel"
  autoComplete="new-password"
  maxLength={30}
  placeholder="رقم الهاتف"
  value={form.phone}
  onChange={(event) =>
    setForm({ ...form, phone: event.target.value })
  }
/>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-emerald-100">
                البريد الإلكتروني
              </label>
<input
  className="input"
  name="viresto_client_email"
  type="email"
  inputMode="email"
  autoComplete="new-password"
  maxLength={120}
  placeholder="البريد الإلكتروني"
  value={form.email}
  onChange={(event) =>
    setForm({ ...form, email: event.target.value })
  }
/>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black text-emerald-100">
                الرقم الوطني / رقم الهوية
              </label>
<input
  className="input"
  name="viresto_client_national_id"
  autoComplete="new-password"
  maxLength={30}
  placeholder="الرقم الوطني / رقم الهوية"
  value={form.nationalId}
  onChange={(event) =>
    setForm({ ...form, nationalId: event.target.value })
  }
/>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-emerald-100">
                العنوان
              </label>
<input
  className="input"
  name="viresto_client_address"
  autoComplete="new-password"
  maxLength={180}
  placeholder="العنوان"
  value={form.address}
  onChange={(event) =>
    setForm({ ...form, address: event.target.value })
  }
/>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-emerald-100">
              ملاحظات
            </label>
<textarea
  className="input min-h-[120px]"
  name="viresto_client_notes"
  autoComplete="new-password"
  maxLength={700}
  placeholder="ملاحظات"
  value={form.notes}
  onChange={(event) =>
    setForm({ ...form, notes: event.target.value })
  }
/>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-[#2f5f4b] px-5 py-3 text-sm font-black text-emerald-50 transition hover:bg-[#3a735b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "جاري الحفظ..." : "حفظ الموكل"}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-[#335f49] bg-transparent px-5 py-3 text-sm font-black text-emerald-50 transition hover:bg-[#173827] disabled:cursor-not-allowed disabled:opacity-60"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [caseFilter, setCaseFilter] = useState<
    "all" | "withCases" | "withoutCases"
  >("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const url = q.trim()
        ? `/api/clients?q=${encodeURIComponent(q)}&limit=100`
        : "/api/clients?limit=100";

      const response = await fetch(url);
      const data = await response.json().catch(() => ({}));

      setClients(
        Array.isArray(data.data?.data)
          ? data.data.data
          : Array.isArray(data.data)
            ? data.data
            : [],
      );
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  function search(event: React.FormEvent) {
    event.preventDefault();
    load();
  }

  function clearFilters() {
    setQ("");
    setCaseFilter("all");
  }

  function openCreateModal() {
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
  }

  function handleClientCreated() {
    setShowCreateModal(false);
    load();
  }

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const casesCount = client._count?.cases ?? 0;

      if (caseFilter === "withCases") return casesCount > 0;
      if (caseFilter === "withoutCases") return casesCount === 0;

      return true;
    });
  }, [clients, caseFilter]);

  const totalClients = clients.length;
  const clientsWithCases = clients.filter(
    (client) => (client._count?.cases ?? 0) > 0,
  ).length;
  const clientsWithoutCases = clients.filter(
    (client) => (client._count?.cases ?? 0) === 0,
  ).length;

  const newThisMonth = clients.filter((client) => {
    const created = new Date(client.createdAt);
    const now = new Date();

    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth()
    );
  }).length;

  if (loading) return <PageLoader />;

  return (
    <>
      <div className="space-y-5 stagger">
        {/* Hero */}
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
            borderColor: "rgba(255,255,255,0.12)",
            boxShadow: "0 18px 50px rgba(45, 74, 62, 0.18)",
          }}
        >
          <div
            className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
            style={{ background: "rgba(245, 200, 66, 0.16)" }}
          />

          <div
            className="absolute -bottom-20 right-16 h-52 w-52 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />

          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div
                className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                إدارة علاقات الموكلين
              </div>

              <h1 className="text-2xl font-black text-white">الموكلون</h1>

              <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
                تابع بيانات الموكلين، معلومات التواصل، عدد القضايا والمواعيد
                المرتبطة بكل موكل من واجهة منظمة وسريعة.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="btn shrink-0"
              style={{
                background: "#fff",
                color: "var(--sidebar)",
                borderColor: "rgba(255,255,255,0.32)",
              }}
            >
              + موكل جديد
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "كل الموكلين",
              value: totalClients,
              color: "var(--text)",
              bg: "var(--card)",
            },
            {
              label: " هذا الشهر",
              value: newThisMonth,
              color: "var(--sidebar)",
              bg: "var(--green-soft)",
            },
            {
              label: "لديهم قضايا",
              value: clientsWithCases,
              color: "#92400e",
              bg: "var(--amber-soft)",
            },
            {
              label: "بدون قضايا",
              value: clientsWithoutCases,
              color: "#6b7280",
              bg: "var(--card)",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="card p-5"
              style={{
                background: item.bg,
                borderColor: "var(--border)",
              }}
            >
              <p className="text-xs font-black" style={{ color: item.color }}>
                {item.label}
              </p>

              <p
                className="mt-2 text-3xl font-black"
                style={{ color: item.color }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4">
          <form
            onSubmit={search}
            className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_.8fr_auto]"
          >
            <input
              name="clientsSearch"
              autoComplete="off"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="ابحث باسم الموكل، الهاتف، البريد أو الرقم الوطني..."
              className="input"
            />

            <select
              value={caseFilter}
              onChange={(event) =>
                setCaseFilter(
                  event.target.value as "all" | "withCases" | "withoutCases",
                )
              }
              className="input"
              aria-label="فلترة حسب القضايا"
            >
              <option value="all">جميع الموكلين</option>
              <option value="withCases">لديهم قضايا</option>
              <option value="withoutCases">بدون قضايا</option>
            </select>

            <button type="submit" className="btn btn-ghost whitespace-nowrap">
              بحث
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["all", "الكل"],
                ["withCases", "لديهم قضايا"],
                ["withoutCases", "بدون قضايا"],
              ] as ["all" | "withCases" | "withoutCases", string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCaseFilter(key)}
                className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
                style={
                  caseFilter === key
                    ? {
                        background: "var(--sidebar)",
                        color: "#fff",
                      }
                    : {
                        background: "var(--green-soft)",
                        color: "var(--text-2)",
                      }
                }
              >
                {label}
              </button>
            ))}

            {(q || caseFilter !== "all") && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
                style={{
                  background: "var(--card)",
                  color: "var(--text-2)",
                  border: "1px solid var(--border)",
                }}
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {filteredClients.length === 0 ? (
          <div className="card p-8">
            <EmptyState
              icon="👥"
              title="لا يوجد موكلون"
              sub={
                clients.length === 0
                  ? "لم يتم إضافة أي موكل بعد. ابدأ بإضافة أول موكل داخل المكتب."
                  : "لا توجد نتائج مطابقة للفلاتر الحالية."
              }
              action={
                clients.length === 0 ? (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="btn btn-primary"
                  >
                    + إضافة موكل
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="btn btn-ghost"
                  >
                    مسح الفلاتر
                  </button>
                )
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                className="card group cursor-pointer p-5 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
                        style={{
                          background: "var(--green-soft)",
                          color: "var(--sidebar)",
                        }}
                      >
                        {client.name.slice(0, 1)}
                      </div>

                      <div className="min-w-0">
                        <h3
                          className="truncate text-base font-black"
                          style={{ color: "var(--text)" }}
                        >
                          {client.name}
                        </h3>

                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--text-3)" }}
                        >
                          أضيف بتاريخ {formatDate(client.createdAt)}
                        </p>
                      </div>
                    </div>

 <div className="mt-4 flex flex-wrap gap-2">
  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm dark:border-emerald-500/40 dark:bg-[#0b1f16] dark:text-emerald-50">
    ⚖️ {client._count?.cases ?? 0} قضايا
  </span>

  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm dark:border-emerald-500/40 dark:bg-[#0b1f16] dark:text-emerald-50">
    📅 {client._count?.appointments ?? 0} مواعيد
  </span>

  {client.nationalId && (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm dark:border-emerald-500/40 dark:bg-[#0b1f16] dark:text-emerald-50">
      🪪 <span className="truncate">{client.nationalId}</span>
    </span>
  )}
</div>
                  </div>

                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-black"
                    style={{
                      background:
                        (client._count?.cases ?? 0) > 0
                          ? "var(--green-soft)"
                          : "var(--card)",
                      color:
                        (client._count?.cases ?? 0) > 0
                          ? "var(--sidebar)"
                          : "var(--text-3)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {(client._count?.cases ?? 0) > 0 ? "نشط" : "بدون قضايا"}
                  </span>
                </div>

                <div
                  className="mt-5 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--text-3)" }}
                    >
                      الهاتف
                    </p>

                    <p
                      className="mt-1 truncate text-sm font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {client.phone || "-"}
                    </p>
                  </div>

                  <div>
                    <p
                      className="text-xs font-bold"
                      style={{ color: "var(--text-3)" }}
                    >
                      البريد الإلكتروني
                    </p>

                    <p
                      className="mt-1 truncate text-sm font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {client.email || "-"}
                    </p>
                  </div>

                  {client.address && (
                    <div className="sm:col-span-2">
                      <p
                        className="text-xs font-bold"
                        style={{ color: "var(--text-3)" }}
                      >
                        العنوان
                      </p>

                      <p
                        className="mt-1 line-clamp-1 text-sm font-semibold"
                        style={{ color: "var(--text)" }}
                      >
                        {client.address}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateClientModal
          onClose={closeCreateModal}
          onCreated={handleClientCreated}
        />
      )}
    </>
  );
}
