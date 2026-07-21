"use client";
import AppLoader from "@/components/ui/AppLoader";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { VDSDataTable, type VDSDataTableColumn } from "@/components/ui/vds";
import { VDSSearchInput } from "@/components/ui/vds/table";
import { useLocale } from "@/lib/useLocale";
import SubscriptionReadOnlyBanner from "@/components/billing/SubscriptionReadOnlyBanner";
import { useTenantWriteAccess } from "@/hooks/useTenantWriteAccess";
import {
  getApiMessage,
  isPlanLimitResponse,
  planLimitMessage,
} from "@/lib/plan-ui";

interface Client {
  id: string;
  publicId?: number;
  name: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  archivedAt?: string | null;
  _count?: {
    cases: number;
    appointments: number;
  };
}

type ArchiveFilter = "active" | "archived" | "all";
type LocaleKey = "ar" | "en";

const pageText = {
  ar: {
    heroBadge: "إدارة علاقات الموكلين",
    title: "الموكلون",
    subtitle:
      "تابع بيانات الموكلين، معلومات التواصل، عدد القضايا والمواعيد المرتبطة بكل موكل من واجهة منظمة وسريعة.",
    newClient: "+ موكل جديد",
    stats: {
      total: "كل الموكلين",
      thisMonth: "هذا الشهر",
      withCases: "لديهم قضايا",
      withoutCases: "بدون قضايا",
    },
    filters: {
      searchPlaceholder:
        "ابحث باسم الموكل، الهاتف، البريد أو الرقم الوطني...",
      ariaCaseFilter: "فلترة حسب القضايا",
      allClients: "جميع الموكلين",
      withCases: "لديهم قضايا",
      withoutCases: "بدون قضايا",
      search: "بحث",
      all: "الكل",
      clear: "مسح الفلاتر",
      activeClients: "النشطون",
      archivedClients: "المؤرشفون",
    },
    empty: {
      title: "لا يوجد موكلون",
      noClients:
        "لم يتم إضافة أي موكل بعد. ابدأ بإضافة أول موكل داخل المكتب.",
      noResults:
        "لا توجد نتائج مطابقة للفلاتر الحالية.",
      addClient: "+ إضافة موكل",
    },
    card: {
      addedAt: "أضيف بتاريخ",
      cases: "قضايا",
      appointments: "مواعيد",
      active: "نشط",
      withoutCases: "بدون قضايا",
      phone: "الهاتف",
      email: "البريد الإلكتروني",
      address: "العنوان",
      dash: "-",
      archived: "مؤرشف",
    },
    modal: {
      title: "إضافة موكل",
      subtitle:
        "إضافة بيانات موكل جديد داخل المكتب",
      close: "إغلاق",
      operationFailed: "تعذر تنفيذ العملية",
      labels: {
        name: "اسم الموكل",
        phone: "رقم الهاتف",
        email: "البريد الإلكتروني",
        nationalId: "الرقم الوطني",
        address: "العنوان",
        notes: "ملاحظات",
      },
      placeholders: {
        name: "اسم الموكل",
        phone: "رقم الهاتف",
        email: "البريد الإلكتروني",
        nationalId: "الرقم الوطني",
        address: "العنوان",
        notes: "ملاحظات",
      },
      save: "حفظ الموكل",
      saving: "جاري الحفظ...",
      cancel: "إلغاء",
    },
    validation: {
      nameRequired: "اسم الموكل مطلوب.",
      phoneRequired: "رقم الهاتف مطلوب.",
      nationalIdRequired: "الرقم الوطني مطلوب.",
      phoneInvalid:
        "رقم الهاتف يجب أن يتكون من 10 أرقام فقط.",
      nationalIdInvalid:
        "الرقم الوطني يجب أن يتكون من 10 أرقام فقط.",
      nameTooLong: "اسم الموكل طويل جدًا.",
      phoneTooLong: "رقم الهاتف طويل جدًا.",
      emailTooLong: "البريد الإلكتروني طويل جدًا.",
      nationalIdTooLong: "الرقم الوطني طويل جدًا.",
      addressTooLong: "العنوان طويل جدًا.",
      notesTooLong: "الملاحظات طويلة جدًا.",
      invalidEmail: "البريد الإلكتروني غير صالح.",
      browserToken:
        "يبدو أن المتصفح عبّأ أحد الحقول تلقائيًا بقيمة غير صحيحة. امسح الحقول وأدخل البيانات يدويًا.",
      planLimit:
        "وصلت إلى حد الموكلين المسموح في خطتك الحالية.",
      addFailed: "تعذر إضافة الموكل",
      connectionFailed:
        "تعذر الاتصال بالخادم. حاول مرة أخرى.",
    },
  },
  en: {
    heroBadge: "Client relationship management",
    title: "Clients",
    subtitle:
      "Track client details, contact information, linked cases, and appointments from a clean and fast workspace.",
    newClient: "+ New client",
    stats: {
      total: "All clients",
      thisMonth: "This month",
      withCases: "With cases",
      withoutCases: "Without cases",
    },
    filters: {
      searchPlaceholder:
        "Search by client name, phone, email, or national ID...",
      ariaCaseFilter: "Filter by cases",
      allClients: "All clients",
      withCases: "With cases",
      withoutCases: "Without cases",
      search: "Search",
      all: "All",
      clear: "Clear filters",

      activeClients: "Active",
      archivedClients: "Archived",
    },
    empty: {
      title: "No clients found",
      noClients:
        "No clients have been added yet. Start by adding your first client.",
      noResults: "No clients match the current filters.",
      addClient: "+ Add client",
    },
    card: {
      addedAt: "Added on",
      cases: "cases",
      appointments: "appointments",
      active: "Active",
      withoutCases: "Without cases",
      phone: "Phone",
      email: "Email",
      address: "Address",
      dash: "-",
      archived: "Archived",
    },
    modal: {
      title: "Add client",
      subtitle: "Add a new client record to the office workspace",
      close: "Close",
      operationFailed: "Operation failed",
      labels: {
        name: "Client name",
        phone: "Phone number",
        email: "Email",
        nationalId: "National ID",
        address: "Address",
        notes: "Notes",
      },
      placeholders: {
        name: "Client name",
        phone: "Phone number",
        email: "Email address",
        nationalId: "National ID",
        address: "Address",
        notes: "Notes",
      },
      save: "Save client",
      saving: "Saving...",
      cancel: "Cancel",
    },
    validation: {
      nameRequired: "Client name is required.",
      phoneRequired: "Phone number is required.",
      nationalIdRequired: "National ID is required.",
      phoneInvalid: "Phone number must be exactly 10 digits.",
      nationalIdInvalid: "National ID must be exactly 10 digits.",
      nameTooLong: "Client name is too long.",
      phoneTooLong: "Phone number is too long.",
      emailTooLong: "Email is too long.",
      nationalIdTooLong: "National ID is too long.",
      addressTooLong: "Address is too long.",
      notesTooLong: "Notes are too long.",
      invalidEmail: "Email address is invalid.",
      browserToken:
        "It looks like the browser auto-filled one of the fields with an invalid value. Clear the fields and enter the data manually.",
      planLimit:
        "You have reached the allowed client limit for your current plan.",
      addFailed: "Could not add the client",
      connectionFailed: "Could not connect to the server. Please try again.",
    },
  },
} as const;

type ClientsText = (typeof pageText)[LocaleKey];

interface CreateClientModalProps {
  isRtl: boolean;
  text: ClientsText;
  onClose: () => void;
  onCreated: () => void;
}

function formatDate(date: string, locale: LocaleKey) {
  return new Date(date).toLocaleDateString(locale === "ar" ? "ar-JO" : "en-US");
}

function cleanValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
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

function validateClientPayload(
  payload: ReturnType<typeof normalizeClientForm>,
  text: ClientsText,
) {
  if (!payload.name) return text.validation.nameRequired;
  if (!payload.phone) return text.validation.phoneRequired;
  if (!payload.nationalId) return text.validation.nationalIdRequired;

  if (!/^\d{10}$/.test(payload.phone)) return text.validation.phoneInvalid;
  if (!/^\d{10}$/.test(payload.nationalId))
    return text.validation.nationalIdInvalid;
  if (!payload.phone) return text.validation.phoneRequired;
  if (!payload.nationalId) return text.validation.nationalIdRequired;
  if (isTooLong(payload.name, 120)) return text.validation.nameTooLong;
  if (isTooLong(payload.phone, 30)) return text.validation.phoneTooLong;
  if (isTooLong(payload.email, 120)) return text.validation.emailTooLong;
  if (isTooLong(payload.nationalId, 30))
    return text.validation.nationalIdTooLong;
  if (isTooLong(payload.address, 180)) return text.validation.addressTooLong;
  if (payload.notes.length > 700) return text.validation.notesTooLong;

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return text.validation.invalidEmail;
  }

  if (
    looksLikeBrowserToken(payload.phone) ||
    looksLikeBrowserToken(payload.email) ||
    looksLikeBrowserToken(payload.nationalId) ||
    looksLikeBrowserToken(payload.address)
  ) {
    return text.validation.browserToken;
  }

  return "";
}

function CreateClientModal({
  isRtl,
  text,
  onClose,
  onCreated,
}: CreateClientModalProps) {
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

  async function submit(event: FormEvent) {
    event.preventDefault();

    const payload = normalizeClientForm(form);
    const validationError = validateClientPayload(payload, text);

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
          ? planLimitMessage(data, text.validation.planLimit)
          : getApiMessage(data, text.validation.addFailed);

        setError(message);
        return;
      }

      onCreated();
    } catch {
      setError(text.validation.connectionFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl rounded-[28px] border border-[#286061] bg-[#0b292a] p-6 text-start shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-emerald-50">
              {text.modal.title}
            </h2>
            <p className="mt-1 text-sm font-semibold text-emerald-100/60">
              {text.modal.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#082c2d] text-xl text-emerald-100 transition hover:bg-[#123f40]"
            aria-label={text.modal.close}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-amber-100">
            <h3 className="font-black">{text.modal.operationFailed}</h3>
            <p className="mt-1 text-sm font-semibold">{error}</p>
          </div>
        )}

        <form
          onSubmit={submit}
          autoComplete="off"
          className="space-y-4"
          dir={isRtl ? "rtl" : "ltr"}
        >
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
              {text.modal.labels.name} <span className="text-red-300">*</span>
            </label>
            <input
              dir={isRtl ? "rtl" : "ltr"}
              className={`input ${isRtl ? "!text-right" : "!text-left"}`}
              style={{
                textAlign: isRtl ? "right" : "left",
                direction: isRtl ? "rtl" : "ltr",
              }}
              name="viresto_client_name"
              autoComplete="new-password"
              maxLength={120}
              placeholder={text.modal.placeholders.name}
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
                {text.modal.labels.phone}{" "}
                <span className="text-red-300">*</span>
              </label>
              <input
                dir={isRtl ? "rtl" : "ltr"}
                className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
                name="viresto_client_phone"
                type="text"
                inputMode="numeric"
                pattern="\d{10}"
                autoComplete="new-password"
                maxLength={10}
                placeholder={text.modal.placeholders.phone}
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: digitsOnly(event.target.value) })
                }
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-emerald-100">
                {text.modal.labels.email}
              </label>
              <input
                dir="ltr"
                className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
                name="viresto_client_email"
                type="email"
                inputMode="email"
                autoComplete="new-password"
                maxLength={120}
                placeholder={text.modal.placeholders.email}
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
                {text.modal.labels.nationalId}{" "}
                <span className="text-red-300">*</span>
              </label>
              <input
                dir={isRtl ? "rtl" : "ltr"}
                className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
                type="text"
                inputMode="numeric"
                name="viresto_client_national_id"
                autoComplete="new-password"
                pattern="\d{10}"
                maxLength={10}
                placeholder={text.modal.placeholders.nationalId}
                value={form.nationalId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    nationalId: digitsOnly(event.target.value),
                  })
                }
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-emerald-100">
                {text.modal.labels.address}
              </label>
              <input
                dir={isRtl ? "rtl" : "ltr"}
                className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
                name="viresto_client_address"
                autoComplete="new-password"
                maxLength={180}
                placeholder={text.modal.placeholders.address}
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-emerald-100">
              {text.modal.labels.notes}
            </label>
            <textarea
              dir={isRtl ? "rtl" : "ltr"}
              className={`input min-h-[120px] resize-none ${
                isRtl ? "!text-right" : "!text-left"
              }`}
              style={{
                textAlign: isRtl ? "right" : "left",
                direction: isRtl ? "rtl" : "ltr",
              }}
              name="viresto_client_notes"
              autoComplete="new-password"
              maxLength={700}
              placeholder={text.modal.placeholders.notes}
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
              className="rounded-2xl bg-[#1b6262] px-5 py-3 text-sm font-black text-emerald-50 transition hover:bg-[#2b7778] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? text.modal.saving : text.modal.save}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-[#286061] bg-transparent px-5 py-3 text-sm font-black text-emerald-50 transition hover:bg-[#123f40] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {text.modal.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const localeKey = (locale === "en" ? "en" : "ar") as LocaleKey;
  const text = pageText[localeKey];

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({
    total: 0,
    withCases: 0,
    withoutCases: 0,
    newThisMonth: 0,
  });
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const writeAccess = useTenantWriteAccess(localeKey);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [archiveFilter, debouncedQ]);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setLoadError(false);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      params.set("archive", archiveFilter);
      if (debouncedQ) params.set("q", debouncedQ);

      const response = await fetch(`/api/clients?${params.toString()}`, {
        signal,
      });
      if (!response.ok) throw new Error("CLIENTS_LOAD_FAILED");
      const data = await response.json().catch(() => ({}));

      setClients(
        Array.isArray(data.data?.data)
          ? data.data.data
          : Array.isArray(data.data)
            ? data.data
            : [],
      );
      const meta = data.data?.meta;
      setTotalPages(Math.max(1, Number(meta?.pages) || 1));
      if (meta?.summary) setSummary(meta.summary);
    } catch (error) {
      if ((error as Error).name !== "AbortError") setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [archiveFilter, debouncedQ, page]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function clearFilters() {
    setQ("");
    setArchiveFilter("active");
  }

  function openCreateModal() {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || text.validation.planLimit);
      return;
    }

    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
  }

  function handleClientCreated() {
    setShowCreateModal(false);
    load();
  }

  const columns = useMemo<VDSDataTableColumn<Client>[]>(
    () => [
      {
        id: "name",
        header: localeKey === "ar" ? "الموكل" : "Client",
        accessor: "name",
        sortable: true,
        width: "28%",
        cell: (client) => (
          <div className="flex min-w-[220px] items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
              style={{
                background: "var(--green-soft)",
                color: "var(--brand-text)",
              }}
            >
              {client.name.slice(0, 1)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="max-w-[220px] truncate font-black"
                  style={{ color: "var(--text)" }}
                >
                  {client.name}
                </span>

                {client.archivedAt ? (
                  <span
                    className="rounded-full border px-2 py-0.5 text-[10px] font-black"
                    style={{
                      background: "rgba(245,158,11,0.16)",
                      borderColor: "rgba(245,158,11,0.38)",
                      color: "#f59e0b",
                    }}
                  >
                    {text.card.archived}
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>
                {text.card.addedAt} {formatDate(client.createdAt, localeKey)}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "phone",
        header: text.card.phone,
        accessor: "phone",
        sortable: true,
        cell: (client) => (
          <span dir="ltr" className="whitespace-nowrap font-semibold">
            {client.phone || text.card.dash}
          </span>
        ),
      },
      {
        id: "email",
        header: text.card.email,
        accessor: "email",
        sortable: true,
        hideOnMobile: true,
        cell: (client) => (
          <span
            dir="ltr"
            className="block max-w-[220px] truncate font-semibold"
          >
            {client.email || text.card.dash}
          </span>
        ),
      },
      {
        id: "nationalId",
        header: localeKey === "ar" ? "الرقم الوطني" : "National ID",
        accessor: "nationalId",
        sortable: true,
        hideOnMobile: true,
        cell: (client) => (
          <span dir="ltr" className="whitespace-nowrap font-semibold">
            {client.nationalId || text.card.dash}
          </span>
        ),
      },
      {
        id: "cases",
        header: text.card.cases,
        align: "center",
        cell: (client) => (
          <span
            className="inline-flex min-w-10 items-center justify-center rounded-full border px-2.5 py-1 text-xs font-black"
            style={{
              background: "var(--green-soft)",
              borderColor: "var(--border)",
              color: "var(--brand-text)",
            }}
          >
            {client._count?.cases ?? 0}
          </span>
        ),
      },
      {
        id: "appointments",
        header: text.card.appointments,
        align: "center",
        hideOnMobile: true,
        cell: (client) => (
          <span
            className="inline-flex min-w-10 items-center justify-center rounded-full border px-2.5 py-1 text-xs font-black"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--text-2)",
            }}
          >
            {client._count?.appointments ?? 0}
          </span>
        ),
      },
      {
        id: "status",
        header: localeKey === "ar" ? "الحالة" : "Status",
        align: "center",
        cell: (client) => {
          const hasCases = (client._count?.cases ?? 0) > 0;

          return (
            <span
              className="inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black"
              style={{
                background: hasCases ? "var(--green-soft)" : "var(--card)",
                borderColor: "var(--border)",
                color: hasCases ? "var(--brand-text)" : "var(--text-2)",
              }}
            >
              {hasCases ? text.card.active : text.card.withoutCases}
            </span>
          );
        },
      },
    ],
    [localeKey, text],
  );

  if (loading && clients.length === 0) {
    return <AppLoader fullScreen={false} />;
  }

  return (
    <>
      <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 text-start stagger">
        <SubscriptionReadOnlyBanner
          visible={!writeAccess.canWrite}
          message={writeAccess.message}
          isRtl={isRtl}
        />

        {/* Hero */}
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
            borderColor: "rgba(255,255,255,0.12)",
            boxShadow: "0 18px 50px rgba(15, 61, 62, 0.18)",
          }}
        >
          <div
            className="absolute -left-14 -top-14 h-40 w-40 rounded-full"
            style={{ background: "rgba(184, 115, 51, 0.16)" }}
          />

          <div
            className="absolute -bottom-20 right-16 h-52 w-52 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />

          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div
                className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
                style={{
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {text.heroBadge}
              </div>

              <h1 className="text-2xl font-black text-white">{text.title}</h1>

              <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
                {text.subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              disabled={!writeAccess.canWrite}
              title={
                !writeAccess.canWrite
                  ? writeAccess.message || text.validation.planLimit
                  : text.newClient
              }
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl px-5 text-sm font-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "#fff",
                color: "var(--sidebar)",
                borderColor: "rgba(255,255,255,0.32)",
              }}
            >
              {text.newClient}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: text.stats.total,
              value: summary.total,
              color: "var(--text)",
              bg: "var(--card)",
            },
            {
              label: text.stats.thisMonth,
              value: summary.newThisMonth,
              color: "var(--brand-text)",
              bg: "var(--green-soft)",
            },
            {
              label: text.stats.withCases,
              value: summary.withCases,
              color: "var(--warning-text)",
              bg: "var(--amber-soft)",
            },
            {
              label: text.stats.withoutCases,
              value: summary.withoutCases,
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
                className="mt-2 text-2xl font-black leading-tight"
                style={{ color: item.color }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Clients table */}
        <VDSDataTable<Client>
          rows={clients}
          columns={columns}
          getRowId={(client) => client.id}
          isRtl={isRtl}
          loading={loading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRowClick={(client) =>
            router.push(`/dashboard/clients/${client.publicId ?? client.id}`)
          }
          toolbar={
            <div
              dir={isRtl ? "rtl" : "ltr"}
              className="space-y-4 border-b p-4"
              style={{ borderColor: "var(--border)" }}
            >
              <VDSSearchInput
                dir={isRtl ? "rtl" : "ltr"}
                name="clientsSearch"
                autoComplete="off"
                value={q}
                onChange={setQ}
                placeholder={text.filters.searchPlaceholder}
                clearLabel={isRtl ? "مسح البحث" : "Clear search"}
              />

              <div className="flex w-full items-center gap-2 overflow-x-auto pb-1">
                {(
                  [
                    ["active", text.filters.activeClients],
                    ["archived", text.filters.archivedClients],
                    ["all", text.filters.allClients],
                  ] as [ArchiveFilter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setArchiveFilter(key)}
                    className="h-10 min-w-[112px] shrink-0 rounded-2xl px-4 text-xs font-black transition-all"
                    style={
                      archiveFilter === key
                        ? {
                            background: "rgba(184,115,51,0.18)",
                            color: "var(--text-1)",
                            border: "1px solid rgba(184,115,51,0.35)",
                          }
                        : {
                            background: "var(--green-soft)",
                            color: "var(--text-2)",
                            border: "1px solid var(--border)",
                          }
                    }
                  >
                    {label}
                  </button>
                ))}

                {q || archiveFilter !== "active" ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="h-10 min-w-[112px] shrink-0 rounded-2xl px-4 text-xs font-black transition-all"
                    style={{
                      background: "var(--card)",
                      color: "var(--text-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {text.filters.clear}
                  </button>
                ) : null}
              </div>
            </div>
          }
          labels={{
            emptyTitle: loadError
              ? localeKey === "ar" ? "تعذر تحميل الموكلين" : "Could not load clients"
              : text.empty.title,
            emptyDescription:
              loadError
                ? localeKey === "ar" ? "تحقق من الاتصال ثم أعد المحاولة." : "Check your connection and try again."
                : clients.length === 0
                ? text.empty.noClients
                : text.empty.noResults,
            previousPage: localeKey === "ar" ? "السابق" : "Previous",
            nextPage: localeKey === "ar" ? "التالي" : "Next",
            pageLabel: (current, total) =>
              localeKey === "ar"
                ? `صفحة ${current} من ${total}`
                : `Page ${current} of ${total}`,
          }}
          emptyAction={
            loadError ? (
              <button type="button" onClick={() => load()} className="btn btn-primary">
                {localeKey === "ar" ? "إعادة المحاولة" : "Try again"}
              </button>
            ) : clients.length === 0 && !q ? (
              <button
                type="button"
                onClick={openCreateModal}
                disabled={!writeAccess.canWrite}
                title={
                  !writeAccess.canWrite
                    ? writeAccess.message || text.validation.planLimit
                    : text.empty.addClient
                }
                className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {text.empty.addClient}
              </button>
            ) : (
              <button
                type="button"
                onClick={clearFilters}
                className="btn btn-ghost"
              >
                {text.filters.clear}
              </button>
            )
          }
        />
      </div>

      {showCreateModal && (
        <CreateClientModal
          isRtl={isRtl}
          text={text}
          onClose={closeCreateModal}
          onCreated={handleClientCreated}
        />
      )}
    </>
  );
}
