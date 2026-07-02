"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import Modal from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import EmptyState from "@/components/ui/EmptyState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import {
  getApiMessage,
  isPlanLimitResponse,
  planLimitMessage,
} from "@/lib/plan-ui";
import { useLocale } from "@/lib/useLocale";
import SubscriptionReadOnlyBanner from "@/components/billing/SubscriptionReadOnlyBanner";
import { useTenantWriteAccess } from "@/hooks/useTenantWriteAccess";

interface Case {
  id: string;
  title: string;
  caseNumber?: string;
  status: string;
  feeAgreed: number;
  court?: string | null;
  judgeName?: string | null;
  plaintiffName?: string | null;
  defendantName?: string | null;
  description?: string | null;

  client?: {
    id?: string;
    name: string;
    archivedAt?: string | null;
  };

  payments: { amount: number; status: string }[];

  _count?: {
    appointments: number;
    documents: number;
  };
}

interface ClientOpt {
  id: string;
  name: string;
  phone?: string | null;
  nationalId?: string | null;
  archivedAt?: string | null;
}

const STATUS_KEYS = [
  "all",
  "OPEN",
  "IN_PROGRESS",
  "CLOSED",
  "ARCHIVED",
  "ARCHIVED_CLIENT",
] as const;

type StatusFilter = (typeof STATUS_KEYS)[number];

const CASE_STATUS_KEYS = ["OPEN", "IN_PROGRESS", "CLOSED", "ARCHIVED"] as const;

const STATUS_BADGE: Record<string, string> = {
  OPEN: "badge badge-green",
  IN_PROGRESS: "badge badge-blue",
  CLOSED: "badge badge-gray",
  ARCHIVED: "badge badge-gray",
};

const COPY = {
  ar: {
    loadError: "فشل تحميل القضايا",
    requiredError: "الموكل وعنوان القضية مطلوبان",
    archivedClientCreateError: "لا يمكن إنشاء قضية جديدة لموكل مؤرشف",
    created: "تمت إضافة القضية",
    updated: "تم تعديل القضية",
    addError: "تعذر إضافة القضية",
    updateError: "تعذر تعديل القضية",
    addUnexpected: "حدث خطأ أثناء إضافة القضية",
    updateUnexpected: "حدث خطأ أثناء تعديل القضية",
    planLimitTitle: "وصلت إلى حد الخطة الحالية",
    planLimitFallback: "وصلت إلى حد القضايا المسموح في خطتك الحالية.",
    viewBilling: "عرض الاشتراك",
    close: "إغلاق",
    archivedClientBadge: "موكل مؤرشف",
    openClientFile: "ملف الموكل ←",
    editCase: "تعديل القضية",
    hero: {
      badge: "إدارة القضايا",
      title: "القضايا",
      subtitle:
        "تابع ملفات القضايا، الموكلين، الأتعاب، المدفوعات والمستحقات من واجهة واحدة تساعدك على إدارة العمل القانوني بوضوح.",
      newCase: "+ قضية جديدة",
    },
    stats: {
      active: "نشطة",
      inProgress: "قيد المتابعة",
      closed: "مغلقة",
      archived: "مؤرشفة",
      archivedClients: "موكلون مؤرشفون",
      totalFees: "إجمالي الأتعاب",
      paid: "المدفوع",
      remaining: "المتبقي",
    },
    filters: {
      searchAria: "البحث في القضايا",
      searchPlaceholder: "ابحث في رقم القضية، العنوان، الموكل، المحكمة، القاضي أو الأطراف...",
      clear: "مسح الفلاتر",
      statuses: {
        all: "الكل",
        OPEN: "نشطة",
        IN_PROGRESS: "قيد المتابعة",
        CLOSED: "مغلقة",
        ARCHIVED: "مؤرشفة",
        ARCHIVED_CLIENT: "موكل مؤرشف",
      },
    },
    empty: {
      title: "لا توجد قضايا",
      noCases: "قم بإنشاء أول قضية للبدء بإدارة العمل القانوني.",
      noResults: "لا توجد قضايا مطابقة للفلاتر الحالية.",
      add: "+ قضية جديدة",
    },
    table: {
      case: "القضية",
      client: "الموكل",
      fees: "الأتعاب",
      paid: "المدفوع",
      remaining: "المتبقي",
      appointments: "المواعيد",
      documents: "المستندات",
      status: "الحالة",
    },
    modal: {
      title: "إضافة قضية جديدة",
      editTitle: "تعديل القضية",
      client: "الموكل",
      chooseClient: "اختر موكلاً...",
      clientSearchPlaceholder: "ابحث باسم الموكل...",
      noClientResults: "لا يوجد موكل بهذا الاسم",
      caseTitle: "عنوان القضية",
      caseNumber: "رقم القضية",
      fees: "الأتعاب",
      court: "المحكمة",
      judgeName: "اسم القاضي",
      plaintiffName: "المدعي",
      defendantName: "المدعى عليه",
      officialData: "بيانات القضية الرسمية",
      description: "الوصف",
      status: "حالة القضية",
      cancel: "إلغاء",
      save: "حفظ",
      update: "حفظ التعديل",
    },
  },
  en: {
    loadError: "Failed to load cases",
    requiredError: "Client and case title are required",
    archivedClientCreateError:
      "You cannot create a new case for an archived client",
    created: "Case added successfully",
    updated: "Case updated successfully",
    addError: "Could not add case",
    updateError: "Could not update case",
    addUnexpected: "Something went wrong while adding the case",
    updateUnexpected: "Something went wrong while updating the case",
    planLimitTitle: "Current plan limit reached",
    planLimitFallback:
      "You have reached the case limit allowed by your current plan.",
    viewBilling: "View billing",
    close: "Close",
    archivedClientBadge: "Archived client",
    openClientFile: "Client file →",
    editCase: "Edit case",
    hero: {
      badge: "Case management",
      title: "Cases",
      subtitle:
        "Track case files, clients, fees, payments, and receivables from one clear legal workspace.",
      newCase: "+ New case",
    },
    stats: {
      active: "Active",
      inProgress: "In progress",
      closed: "Closed",
      archived: "Archived",
      archivedClients: "Archived clients",
      totalFees: "Total fees",
      paid: "Paid",
      remaining: "Remaining",
    },
    filters: {
      searchAria: "Search cases",
      searchPlaceholder: "Search by case number, title, client, court, judge, or parties...",
      clear: "Clear filters",
      statuses: {
        all: "All",
        OPEN: "Active",
        IN_PROGRESS: "In progress",
        CLOSED: "Closed",
        ARCHIVED: "Archived",
        ARCHIVED_CLIENT: "Archived client",
      },
    },
    empty: {
      title: "No cases found",
      noCases: "Create the first case to start managing legal work.",
      noResults: "No cases match the current filters.",
      add: "+ New case",
    },
    table: {
      case: "Case",
      client: "Client",
      fees: "Fees",
      paid: "Paid",
      remaining: "Remaining",
      appointments: "Appointments",
      documents: "Documents",
      status: "Status",
    },
    modal: {
      title: "Add new case",
      editTitle: "Edit case",
      client: "Client",
      chooseClient: "Choose a client...",
      clientSearchPlaceholder: "Search by client name...",
      noClientResults: "No client found with this name",
      caseTitle: "Case title",
      caseNumber: "Case number",
      fees: "Fees",
      court: "Court",
      judgeName: "Judge name",
      plaintiffName: "Plaintiff",
      defendantName: "Defendant",
      officialData: "Official case details",
      description: "Description",
      status: "Case status",
      cancel: "Cancel",
      save: "Save",
      update: "Save changes",
    },
  },
} as const;

const INIT = {
  clientId: "",
  title: "",
  caseNumber: "",
  court: "",
  judgeName: "",
  plaintiffName: "",
  defendantName: "",
  feeAgreed: "",
  description: "",
};

const EDIT_INIT = {
  title: "",
  caseNumber: "",
  court: "",
  judgeName: "",
  plaintiffName: "",
  defendantName: "",
  feeAgreed: "",
  description: "",
  status: "OPEN",
};

function formatMoney(value: number) {
  const amount = Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `JOD ${amount}`;
}

function isArchivedClientCase(item: Case) {
  return Boolean(item.client?.archivedAt);
}

function PlanLimitBanner({
  message,
  onClose,
  text,
}: {
  message: string;
  onClose: () => void;
  text: (typeof COPY)["ar"] | (typeof COPY)["en"];
}) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-black">{text.planLimitTitle}</h2>
          <p className="mt-1 text-sm font-semibold">{message}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/billing" className="btn btn-primary">
            {text.viewBilling}
          </Link>

          <button type="button" onClick={onClose} className="btn">
            {text.close}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CasesPage() {
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const localeKey = (locale === "ar" ? "ar" : "en") as keyof typeof COPY;
  const text = COPY[localeKey];

  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [form, setForm] = useState(INIT);
  const [editForm, setEditForm] = useState(EDIT_INIT);
  const [clientSearch, setClientSearch] = useState("");
  const [clientListOpen, setClientListOpen] = useState(false);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOpt | null>(null);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [planLimit, setPlanLimit] = useState("");
  const writeAccess = useTenantWriteAccess(localeKey);

  const selectedClientArchived = Boolean(selectedClient?.archivedAt);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const casesRes = await fetch(
        "/api/cases?page=1&limit=100&includeArchivedClients=true",
      );

      if (!casesRes.ok) {
        setCases([]);
        return;
      }

      const casesData = await casesRes.json().catch(() => ({ data: [] }));

      setCases(Array.isArray(casesData.data?.data) ? casesData.data.data : []);
    } catch {
      toast.error(text.loadError);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setClientSearchLoading(true);

        const params = new URLSearchParams({
          page: "1",
          limit: "10",
          archive: "active",
        });

        const query = clientSearch.trim();

        if (query) {
          params.set("q", query);
        }

        const response = await fetch(`/api/clients?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setClients([]);
          return;
        }

        const data = await response.json().catch(() => ({ data: [] }));
        const rows = Array.isArray(data.data?.data) ? data.data.data : [];

        setClients(
          rows.filter((client: ClientOpt) => !client.archivedAt),
        );
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setClients([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setClientSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [clientSearch, open]);

  const activeCount = cases.filter((item) => item.status === "OPEN").length;
  const progressCount = cases.filter(
    (item) => item.status === "IN_PROGRESS",
  ).length;
  const closedCount = cases.filter((item) => item.status === "CLOSED").length;
  const archivedCount = cases.filter(
    (item) => item.status === "ARCHIVED",
  ).length;
  const archivedClientCount = cases.filter(isArchivedClientCase).length;

  function paid(item: Case) {
    return item.payments
      .filter((payment) => payment.status === "PAID")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  function remaining(item: Case) {
    return Math.max(0, Number(item.feeAgreed || 0) - paid(item));
  }

  const totalFees = cases.reduce(
    (sum, item) => sum + Number(item.feeAgreed || 0),
    0,
  );
  const totalPaid = cases.reduce((sum, item) => sum + paid(item), 0);
  const totalRemaining = Math.max(0, totalFees - totalPaid);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return cases.filter((item) => {
      const matchesStatus =
        filter === "all" ||
        (filter === "ARCHIVED_CLIENT"
          ? isArchivedClientCase(item)
          : item.status === filter);

      const matchesSearch =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.caseNumber?.toLowerCase().includes(query) ||
        item.court?.toLowerCase().includes(query) ||
        item.judgeName?.toLowerCase().includes(query) ||
        item.plaintiffName?.toLowerCase().includes(query) ||
        item.defendantName?.toLowerCase().includes(query) ||
        item.client?.name?.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [cases, filter, search]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || text.planLimitFallback);
      return;
    }

    if (!form.clientId || !form.title.trim()) {
      toast.error(text.requiredError);
      return;
    }

    if (selectedClientArchived) {
      toast.error(text.archivedClientCreateError);
      return;
    }

    try {
      setSaving(true);
      setPlanLimit("");

      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          feeAgreed: parseFloat(form.feeAgreed) || 0,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (data.success) {
        toast.success(text.created);
        closeCreateCaseModal();
        load();
      } else if (isPlanLimitResponse(data)) {
        setOpen(false);
        setPlanLimit(planLimitMessage(data, text.planLimitFallback));
      } else {
        toast.error(getApiMessage(data, text.addError));
      }
    } catch {
      toast.error(text.addUnexpected);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || text.planLimitFallback);
      return;
    }

    if (!editingCase || !editForm.title.trim()) {
      toast.error(text.requiredError);
      return;
    }

    try {
      setEditSaving(true);

      const response = await fetch(`/api/cases/${editingCase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          caseNumber: editForm.caseNumber,
          court: editForm.court,
          judgeName: editForm.judgeName,
          plaintiffName: editForm.plaintiffName,
          defendantName: editForm.defendantName,
          description: editForm.description,
          status: editForm.status,
          feeAgreed: parseFloat(editForm.feeAgreed) || 0,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (data.success) {
        toast.success(text.updated);
        closeEditCaseModal();
        load();
      } else if (isPlanLimitResponse(data)) {
        setEditOpen(false);
        setPlanLimit(planLimitMessage(data, text.planLimitFallback));
      } else {
        toast.error(getApiMessage(data, text.updateError));
      }
    } catch {
      toast.error(text.updateUnexpected);
    } finally {
      setEditSaving(false);
    }
  }

  function f(key: keyof typeof INIT) {
    return (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setForm((previous) => ({
        ...previous,
        [key]: event.target.value,
      }));
    };
  }

  function ef(key: keyof typeof EDIT_INIT) {
    return (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setEditForm((previous) => ({
        ...previous,
        [key]: event.target.value,
      }));
    };
  }

  function clearFilters() {
    setSearch("");
    setFilter("all");
  }

  function resetCreateCaseForm() {
    setForm(INIT);
    setClients([]);
    setClientSearch("");
    setClientListOpen(false);
    setClientSearchLoading(false);
    setSelectedClient(null);
  }

  function closeCreateCaseModal() {
    setOpen(false);
    resetCreateCaseForm();
  }

  function chooseClient(client: ClientOpt) {
    setSelectedClient(client);
    setForm((previous) => ({
      ...previous,
      clientId: client.id,
    }));
    setClientSearch(client.name);
    setClientListOpen(false);
  }

  function openCreateCaseModal() {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || text.planLimitFallback);
      return;
    }

    resetCreateCaseForm();
    setOpen(true);
  }

  function closeEditCaseModal() {
    setEditOpen(false);
    setEditingCase(null);
    setEditForm(EDIT_INIT);
  }

  function openEditCaseModal(item: Case) {
    if (!writeAccess.canWrite) {
      toast.warning(writeAccess.message || text.planLimitFallback);
      return;
    }

    setEditingCase(item);
    setEditForm({
      title: item.title || "",
      caseNumber: item.caseNumber || "",
      court: item.court || "",
      judgeName: item.judgeName || "",
      plaintiffName: item.plaintiffName || "",
      defendantName: item.defendantName || "",
      feeAgreed: String(Number(item.feeAgreed || 0)),
      description: item.description || "",
      status: CASE_STATUS_KEYS.includes(
        item.status as (typeof CASE_STATUS_KEYS)[number],
      )
        ? item.status
        : "OPEN",
    });
    setEditOpen(true);
  }

  return (
    <div
      className="min-w-0 max-w-full space-y-5 overflow-x-hidden stagger"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {planLimit && (
        <PlanLimitBanner
          message={planLimit}
          onClose={() => setPlanLimit("")}
          text={text}
        />
      )}

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
          boxShadow: "0 18px 50px rgba(45, 74, 62, 0.18)",
        }}
      >
        <div
          className={`absolute -top-14 h-40 w-40 rounded-full ${
            isRtl ? "-right-14" : "-left-14"
          }`}
          style={{ background: "rgba(245, 200, 66, 0.16)" }}
        />

        <div
          className={`absolute -bottom-20 h-52 w-52 rounded-full ${
            isRtl ? "left-16" : "right-16"
          }`}
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {text.hero.badge}
            </div>

            <h1 className="text-2xl font-black text-white">
              {text.hero.title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {text.hero.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateCaseModal}
            disabled={!writeAccess.canWrite}
            title={!writeAccess.canWrite ? writeAccess.message || text.planLimitFallback : text.hero.newCase}
            className="btn h-11 shrink-0 px-5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "#fff",
              color: "var(--sidebar)",
              borderColor: "rgba(255,255,255,0.32)",
            }}
          >
            {text.hero.newCase}
          </button>
        </div>
      </div>

      {/* Status Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: text.stats.active,
            value: activeCount,
            color: "var(--sidebar)",
            bg: "var(--green-soft)",
          },
          {
            label: text.stats.inProgress,
            value: progressCount,
            color: "#92400e",
            bg: "var(--amber-soft)",
          },
          {
            label: text.stats.closed,
            value: closedCount,
            color: "#6b7280",
            bg: "var(--card)",
          },
          {
            label: text.stats.archived,
            value: archivedCount,
            color: "var(--text-2)",
            bg: "var(--card)",
          },
          {
            label: text.stats.archivedClients,
            value: archivedClientCount,
            color: archivedClientCount > 0 ? "#b45309" : "var(--text-2)",
            bg: archivedClientCount > 0 ? "#fff7ed" : "var(--card)",
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

      {/* Filters */}
      <div className="card p-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px_auto]">
          <input
            dir={isRtl ? "rtl" : "ltr"}
            aria-label={text.filters.searchAria}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={text.filters.searchPlaceholder}
            className={`input h-14 w-full ${isRtl ? "!text-right" : "!text-left"}`}
            style={{
              textAlign: isRtl ? "right" : "left",
              direction: isRtl ? "rtl" : "ltr",
            }}
          />

          <select
            dir={isRtl ? "rtl" : "ltr"}
            value={filter}
            onChange={(event) => setFilter(event.target.value as StatusFilter)}
            className={`input h-14 w-full cursor-pointer ${isRtl ? "!text-right" : "!text-left"}`}
            style={{
              textAlign: isRtl ? "right" : "left",
              direction: isRtl ? "rtl" : "ltr",
            }}
            aria-label={text.table.status}
          >
            {STATUS_KEYS.map((key) => (
              <option key={key} value={key}>
                {text.filters.statuses[key]}
              </option>
            ))}
          </select>

          {(search || filter !== "all") && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-14 rounded-2xl px-5 text-sm font-black transition-all"
              style={{
                background: "var(--card)",
                color: "var(--text-2)",
                border: "1px solid var(--border)",
              }}
            >
              {text.filters.clear}
            </button>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <FinancialCard
          label={text.stats.totalFees}
          value={formatMoney(totalFees)}
          isRtl={isRtl}
        />
        <FinancialCard
          label={text.stats.paid}
          value={formatMoney(totalPaid)}
          color="var(--sidebar)"
          isRtl={isRtl}
        />
        <FinancialCard
          label={text.stats.remaining}
          value={formatMoney(totalRemaining)}
          danger={totalRemaining > 0}
          isRtl={isRtl}
        />
      </div>

      {/* Content */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon="⚖️"
            title={text.empty.title}
            sub={cases.length === 0 ? text.empty.noCases : text.empty.noResults}
            action={
              cases.length === 0 ? (
                <button
                  onClick={openCreateCaseModal}
                  disabled={!writeAccess.canWrite}
                  title={!writeAccess.canWrite ? writeAccess.message || text.planLimitFallback : text.empty.add}
                  className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {text.empty.add}
                </button>
              ) : (
                <button onClick={clearFilters} className="btn btn-ghost">
                  {text.filters.clear}
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[1180px]">
              <div className="grid grid-cols-[1fr_1.35fr_0.9fr_0.9fr_1fr_0.9fr_0.85fr_1fr_1.05fr] items-center gap-x-4 border-b border-emerald-300/20 px-5 py-4 text-sm font-black text-emerald-50/90">
                <div className="text-start">{text.table.case}</div>
                <div className="text-start">{text.table.client}</div>
                <div className="text-end">{text.table.fees}</div>
                <div className="text-end">{text.table.paid}</div>
                <div className="text-end">{text.table.remaining}</div>
                <div className="text-center">{text.table.appointments}</div>
                <div className="text-center">{text.table.documents}</div>
                <div className="text-center">{text.table.status}</div>
                <div />
              </div>

              {filtered.map((item) => {
                const paidAmount = paid(item);
                const remainingAmount = remaining(item);
                const archivedClient = isArchivedClientCase(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/dashboard/cases/${item.id}`)}
                    className="grid cursor-pointer grid-cols-[1fr_1.35fr_0.9fr_0.9fr_1fr_0.9fr_0.85fr_1fr_1.05fr] items-center gap-x-4 border-b border-emerald-300/15 px-5 py-5 transition last:border-b-0 hover:bg-emerald-300/5"
                  >
                    <div className="min-w-0 text-start">
                      <p dir="ltr" className="font-mono text-sm font-black text-emerald-50">
                        {item.caseNumber ?? `#${item.id.slice(-6)}`}
                      </p>

                      <p
                        dir={isRtl ? "rtl" : "ltr"}
                        className={`mt-1 max-w-[180px] truncate text-xs font-bold ${
                          isRtl ? "text-right" : "text-left"
                        }`}
                        style={{ color: "var(--text-3)" }}
                      >
                        {item.title}
                      </p>
                    </div>

                    <div className="min-w-0 text-start">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          dir={isRtl ? "rtl" : "ltr"}
                          className={`max-w-[190px] truncate text-sm font-black text-emerald-50 ${
                            isRtl ? "text-right" : "text-left"
                          }`}
                        >
                          {item.client?.name}
                        </span>

                        {archivedClient && (
                          <span
                            className="w-fit rounded-full border px-2 py-0.5 text-[11px] font-black"
                            style={{
                              background: "#fff7ed",
                              borderColor: "rgba(180, 83, 9, 0.22)",
                              color: "#b45309",
                            }}
                          >
                            {text.archivedClientBadge}
                          </span>
                        )}
                      </div>
                    </div>

                    <div dir="ltr" className="text-end text-sm font-black text-emerald-50">
                      {formatMoney(item.feeAgreed)}
                    </div>

                    <div
                      dir="ltr"
                      className="text-end text-sm font-black"
                      style={{ color: "var(--sidebar)" }}
                    >
                      {formatMoney(paidAmount)}
                    </div>

                    <div
                      dir="ltr"
                      className="text-end text-sm font-black"
                      style={{
                        color: remainingAmount > 0 ? "#dc2626" : "var(--text)",
                      }}
                    >
                      {formatMoney(remainingAmount)}
                    </div>

                    <div className="text-center text-sm font-black text-emerald-50/95">
                      {item._count?.appointments ?? 0}
                    </div>

                    <div className="text-center text-sm font-black text-emerald-50/95">
                      {item._count?.documents ?? 0}
                    </div>

                    <div className="flex justify-center">
                      <div className="flex flex-wrap justify-center gap-2">
                        <span className={STATUS_BADGE[item.status] ?? "badge badge-gray"}>
                          {text.filters.statuses[
                            item.status as keyof typeof text.filters.statuses
                          ] ?? item.status}
                        </span>

                        {archivedClient && (
                          <span
                            className="rounded-full border px-2.5 py-1 text-xs font-black"
                            style={{
                              background: "#fff7ed",
                              color: "#b45309",
                              borderColor: "rgba(180, 83, 9, 0.22)",
                            }}
                          >
                            {text.archivedClientBadge}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap justify-center gap-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openEditCaseModal(item)}
                        disabled={!writeAccess.canWrite}
                        title={
                          !writeAccess.canWrite
                            ? writeAccess.message || text.planLimitFallback
                            : text.editCase
                        }
                        className="inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-black transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          borderColor: "rgba(16,185,129,0.28)",
                          color: "var(--sidebar)",
                        }}
                      >
                        {text.editCase}
                      </button>

                      {item.client?.id && (
                        <Link
                          href={`/dashboard/clients/${item.client.id}`}
                          className="inline-flex min-w-[120px] items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-black transition hover:bg-black/5 dark:hover:bg-white/5"
                          style={{
                            borderColor: "var(--border)",
                            color: "var(--text-2)",
                          }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {text.openClientFile}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Modal
        open={open}
        onClose={closeCreateCaseModal}
        title={text.modal.title}
      >
        <form
          onSubmit={handleAdd}
          className="space-y-3"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <FormField label={text.modal.client} required>
            <div className="relative">
              <input
                dir={isRtl ? "rtl" : "ltr"}
                value={
                  clientListOpen
                    ? clientSearch
                    : selectedClient?.name || clientSearch
                }
                onChange={(event) => {
                  const value = event.target.value;

                  setClientSearch(value);
                  setClientListOpen(true);
                  setSelectedClient(null);

                  if (form.clientId) {
                    setForm((previous) => ({
                      ...previous,
                      clientId: "",
                    }));
                  }
                }}
                onFocus={() => {
                  setClientSearch(selectedClient?.name || "");
                  setClientListOpen(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => setClientListOpen(false), 120);
                }}
                placeholder={text.modal.clientSearchPlaceholder}
                autoComplete="off"
                autoFocus
                className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
              />

              {clientListOpen && (
                <div
                  className={`absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border shadow-2xl ${
                    isRtl ? "right-0" : "left-0"
                  }`}
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                  }}
                >
                  {clientSearchLoading ? (
                    <div
                      className={`px-4 py-3 text-sm font-bold ${
                        isRtl ? "text-right" : "text-left"
                      }`}
                      style={{ color: "var(--text-3)" }}
                    >
                      {localeKey === "ar" ? "جاري البحث..." : "Searching..."}
                    </div>
                  ) : clients.length > 0 ? (
                    clients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          chooseClient(client);
                        }}
                        className={`block w-full px-4 py-3 text-sm font-black transition hover:bg-emerald-300/10 ${
                          isRtl ? "text-right" : "text-left"
                        }`}
                        style={{ color: "var(--text)" }}
                      >
                        <span className="block">{client.name}</span>
                        {(client.phone || client.nationalId) && (
                          <span
                            dir="ltr"
                            className={`mt-1 block text-xs font-bold ${
                              isRtl ? "text-right" : "text-left"
                            }`}
                            style={{ color: "var(--text-3)" }}
                          >
                            {client.phone || ""}
                            {client.nationalId ? ` - ${client.nationalId}` : ""}
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div
                      className={`px-4 py-3 text-sm font-bold ${
                        isRtl ? "text-right" : "text-left"
                      }`}
                      style={{ color: "var(--text-3)" }}
                    >
                      {text.modal.noClientResults}
                    </div>
                  )}
                </div>
              )}
            </div>
          </FormField>

          {selectedClientArchived && (
            <div
              className="rounded-2xl border p-3 text-xs font-bold"
              style={{
                background: "#fff7ed",
                color: "#b45309",
                borderColor: "rgba(180, 83, 9, 0.22)",
              }}
            >
              {text.archivedClientCreateError}
            </div>
          )}

          <FormField label={text.modal.caseTitle} required>
            <input
              dir={isRtl ? "rtl" : "ltr"}
              value={form.title}
              onChange={f("title")}
              className={`input ${isRtl ? "!text-right" : "!text-left"}`}
              style={{
                textAlign: isRtl ? "right" : "left",
                direction: isRtl ? "rtl" : "ltr",
              }}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={text.modal.caseNumber}>
              <input
                dir={isRtl ? "rtl" : "ltr"}
                value={form.caseNumber}
                onChange={f("caseNumber")}
                className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
              />
            </FormField>

            <FormField label={text.modal.fees}>
              <input
                dir="ltr"
                type="number"
                value={form.feeAgreed}
                onChange={f("feeAgreed")}
                className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: "ltr",
                }}
                min="0"
              />
            </FormField>
          </div>

          <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card-2)" }}>
            <p className="mb-3 text-sm font-black" style={{ color: "var(--text)" }}>
              {text.modal.officialData}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label={text.modal.court}>
                <input
                  dir={isRtl ? "rtl" : "ltr"}
                  value={form.court}
                  onChange={f("court")}
                  className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                  style={{
                    textAlign: isRtl ? "right" : "left",
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                />
              </FormField>

              <FormField label={text.modal.judgeName}>
                <input
                  dir={isRtl ? "rtl" : "ltr"}
                  value={form.judgeName}
                  onChange={f("judgeName")}
                  className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                  style={{
                    textAlign: isRtl ? "right" : "left",
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                />
              </FormField>

              <FormField label={text.modal.plaintiffName}>
                <input
                  dir={isRtl ? "rtl" : "ltr"}
                  value={form.plaintiffName}
                  onChange={f("plaintiffName")}
                  className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                  style={{
                    textAlign: isRtl ? "right" : "left",
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                />
              </FormField>

              <FormField label={text.modal.defendantName}>
                <input
                  dir={isRtl ? "rtl" : "ltr"}
                  value={form.defendantName}
                  onChange={f("defendantName")}
                  className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                  style={{
                    textAlign: isRtl ? "right" : "left",
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                />
              </FormField>
            </div>
          </div>

          <FormField label={text.modal.description}>
            <textarea
              dir={isRtl ? "rtl" : "ltr"}
              value={form.description}
              onChange={f("description")}
              className={`input min-h-[105px] resize-none ${
                isRtl ? "!text-right" : "!text-left"
              }`}
              style={{
                textAlign: isRtl ? "right" : "left",
                direction: isRtl ? "rtl" : "ltr",
              }}
            />
          </FormField>

          <div
            className={`flex gap-2 pt-1 ${isRtl ? "flex-row" : "flex-row-reverse"}`}
          >
            <button
              type="button"
              onClick={closeCreateCaseModal}
              className="btn btn-ghost flex-1"
            >
              {text.modal.cancel}
            </button>

            <button
              type="submit"
              disabled={saving || selectedClientArchived}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="spinner spinner-sm" />
              ) : (
                text.modal.save
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={closeEditCaseModal}
        title={text.modal.editTitle}
      >
        <form
          onSubmit={handleUpdate}
          className="space-y-3"
          dir={isRtl ? "rtl" : "ltr"}
        >
          <FormField label={text.modal.caseTitle} required>
            <input
              dir={isRtl ? "rtl" : "ltr"}
              value={editForm.title}
              onChange={ef("title")}
              className={`input ${isRtl ? "!text-right" : "!text-left"}`}
              style={{
                textAlign: isRtl ? "right" : "left",
                direction: isRtl ? "rtl" : "ltr",
              }}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={text.modal.caseNumber}>
              <input
                dir={isRtl ? "rtl" : "ltr"}
                value={editForm.caseNumber}
                onChange={ef("caseNumber")}
                className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: isRtl ? "rtl" : "ltr",
                }}
              />
            </FormField>

            <FormField label={text.modal.fees}>
              <input
                dir="ltr"
                type="number"
                value={editForm.feeAgreed}
                onChange={ef("feeAgreed")}
                className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                style={{
                  textAlign: isRtl ? "right" : "left",
                  direction: "ltr",
                }}
                min="0"
              />
            </FormField>
          </div>

          <FormField label={text.modal.status}>
            <select
              dir={isRtl ? "rtl" : "ltr"}
              value={editForm.status}
              onChange={ef("status")}
              className={`input ${isRtl ? "!text-right" : "!text-left"}`}
              style={{
                textAlign: isRtl ? "right" : "left",
                direction: isRtl ? "rtl" : "ltr",
              }}
            >
              {CASE_STATUS_KEYS.map((status) => (
                <option key={status} value={status}>
                  {text.filters.statuses[status]}
                </option>
              ))}
            </select>
          </FormField>

          <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card-2)" }}>
            <p className="mb-3 text-sm font-black" style={{ color: "var(--text)" }}>
              {text.modal.officialData}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label={text.modal.court}>
                <input
                  dir={isRtl ? "rtl" : "ltr"}
                  value={editForm.court}
                  onChange={ef("court")}
                  className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                  style={{
                    textAlign: isRtl ? "right" : "left",
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                />
              </FormField>

              <FormField label={text.modal.judgeName}>
                <input
                  dir={isRtl ? "rtl" : "ltr"}
                  value={editForm.judgeName}
                  onChange={ef("judgeName")}
                  className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                  style={{
                    textAlign: isRtl ? "right" : "left",
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                />
              </FormField>

              <FormField label={text.modal.plaintiffName}>
                <input
                  dir={isRtl ? "rtl" : "ltr"}
                  value={editForm.plaintiffName}
                  onChange={ef("plaintiffName")}
                  className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                  style={{
                    textAlign: isRtl ? "right" : "left",
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                />
              </FormField>

              <FormField label={text.modal.defendantName}>
                <input
                  dir={isRtl ? "rtl" : "ltr"}
                  value={editForm.defendantName}
                  onChange={ef("defendantName")}
                  className={`input ${isRtl ? "!text-right" : "!text-left"}`}
                  style={{
                    textAlign: isRtl ? "right" : "left",
                    direction: isRtl ? "rtl" : "ltr",
                  }}
                />
              </FormField>
            </div>
          </div>

          <FormField label={text.modal.description}>
            <textarea
              dir={isRtl ? "rtl" : "ltr"}
              value={editForm.description}
              onChange={ef("description")}
              className={`input min-h-[105px] resize-none ${
                isRtl ? "!text-right" : "!text-left"
              }`}
              style={{
                textAlign: isRtl ? "right" : "left",
                direction: isRtl ? "rtl" : "ltr",
              }}
            />
          </FormField>

          <div
            className={`flex gap-2 pt-1 ${isRtl ? "flex-row" : "flex-row-reverse"}`}
          >
            <button
              type="button"
              onClick={closeEditCaseModal}
              className="btn btn-ghost flex-1"
            >
              {text.modal.cancel}
            </button>

            <button
              type="submit"
              disabled={editSaving}
              className="btn btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {editSaving ? (
                <span className="spinner spinner-sm" />
              ) : (
                text.modal.update
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function FinancialCard({
  label,
  value,
  color = "var(--text)",
  danger,
  isRtl,
}: {
  label: string;
  value: string;
  color?: string;
  danger?: boolean;
  isRtl?: boolean;
}) {
  return (
    <div
      className="card p-5"
      style={{
        background: danger ? "var(--red-soft)" : "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <p
        className="text-xs font-black"
        style={{ color: danger ? "#dc2626" : "var(--text-3)" }}
      >
        {label}
      </p>

      <p
        dir="ltr"
        className={`mt-2 whitespace-nowrap text-xl font-black leading-tight ${
          isRtl ? "text-right" : "text-left"
        }`}
        style={{ color: danger ? "#dc2626" : color }}
      >
        {value}
      </p>
    </div>
  );
}
