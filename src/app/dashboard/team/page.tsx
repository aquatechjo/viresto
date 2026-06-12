"use client";
import AppLoader from "@/components/ui/AppLoader"
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { toast } from "sonner";

import PageLoader from "@/components/ui/PageLoader";
import EmptyState from "@/components/ui/EmptyState";
import {
  getApiMessage,
  isPlanLimitResponse,
  planLimitMessage,
} from "@/lib/plan-ui";
import { useLocale } from "@/lib/useLocale";

type Role = "ADMIN" | "LAWYER" | "STAFF";
type StatusFilter = "all" | "active" | "inactive";

type Locale = "ar" | "en";

const TEAM_COPY = {
  ar: {
    roles: {
      ADMIN: "مدير النظام",
      LAWYER: "محامٍ",
      STAFF: "موظف",
    } satisfies Record<Role, string>,
    status: {
      active: "مفعل",
      inactive: "معطل",
    },
    plan: {
      title: "وصلت إلى حد الخطة الحالية",
      billing: "عرض الاشتراك",
      close: "إغلاق",
      fallback: "وصلت إلى الحد المسموح من المستخدمين في خطتك الحالية.",
    },
    messages: {
      loadError: "تعذر تحميل الفريق",
      loadUnexpected: "حدث خطأ أثناء تحميل الفريق",
      required: "الاسم والبريد وكلمة المرور مطلوبة",
      addSuccess: "تمت إضافة المستخدم",
      addError: "حدث خطأ أثناء إضافة المستخدم",
      updateSuccess: "تم تحديث المستخدم",
      updateError: "تعذر تحديث المستخدم",
      updateUnexpected: "حدث خطأ أثناء تحديث المستخدم",
    },
    unauthorized: {
      title: "إدارة الفريق",
      subtitle: "هذه الصفحة مخصصة لإدارة مستخدمي المكتب وصلاحياتهم.",
      heading: "غير مصرح",
      body: "فقط مدير النظام يستطيع إدارة الفريق.",
    },
    hero: {
      badge: "إدارة الصلاحيات والمستخدمين",
      title: "الفريق",
      subtitle:
        "أضف أعضاء المكتب، وحدد صلاحيات كل مستخدم، وفعّل أو عطّل الوصول للنظام من مكان واحد واضح وآمن.",
      addButton: "+ عضو جديد",
    },
    stats: {
      total: "كل الأعضاء",
      active: "المفعلون",
      admins: "المدراء",
      inactive: "المعطلون",
    },
    filters: {
      search: "ابحث باسم المستخدم أو البريد الإلكتروني...",
      roleAria: "فلترة حسب الدور",
      statusAria: "فلترة حسب الحالة",
      allRoles: "جميع الصلاحيات",
      allStatuses: "جميع الحالات",
      filter: "بحث",
      clear: "مسح الفلاتر",
      all: "الكل",
      admins: "المدراء",
      lawyers: "المحامون",
      staff: "الموظفون",
    },
    form: {
      title: "إضافة مستخدم",
      subtitle: "المستخدم الجديد سيدخل باستخدام البريد وكلمة المرور المؤقتة.",
      name: "الاسم الكامل",
      email: "البريد الإلكتروني",
      roleAria: "صلاحية المستخدم الجديد",
      password: "كلمة المرور المؤقتة",
      saving: "جاري الإضافة...",
      submit: "إضافة المستخدم",
      hint: "الأفضل استخدام كلمة مرور مؤقتة قوية، ثم مطالبة المستخدم بتغييرها بعد أول دخول.",
    },
    list: {
      title: "أعضاء الفريق",
      results: (count: number) => `${count} مستخدم ضمن النتائج الحالية`,
      lawyers: (count: number) => `${count} محامٍ`,
      staff: (count: number) => `${count} موظف`,
      emptyTitle: "لا يوجد أعضاء",
      emptyNoUsers: "أضف أول مستخدم للفريق.",
      emptyFiltered: "لا توجد نتائج مطابقة للفلاتر الحالية.",
      createdAt: (date: string) => `تاريخ الإضافة: ${date}`,
      roleChangeAria: "تغيير صلاحية المستخدم",
      roleChangeTitle: "تغيير صلاحية المستخدم",
      deactivate: "تعطيل",
      activate: "تفعيل",
      unknownInitial: "؟",
    },
  },
  en: {
    roles: {
      ADMIN: "System admin",
      LAWYER: "Lawyer",
      STAFF: "Staff",
    } satisfies Record<Role, string>,
    status: {
      active: "Active",
      inactive: "Disabled",
    },
    plan: {
      title: "Current plan limit reached",
      billing: "View subscription",
      close: "Close",
      fallback:
        "You have reached the allowed user limit for your current plan.",
    },
    messages: {
      loadError: "Unable to load team",
      loadUnexpected: "An error occurred while loading the team",
      required: "Name, email, and password are required",
      addSuccess: "User added successfully",
      addError: "An error occurred while adding the user",
      updateSuccess: "User updated successfully",
      updateError: "Unable to update user",
      updateUnexpected: "An error occurred while updating the user",
    },
    unauthorized: {
      title: "Team management",
      subtitle: "This page is used to manage office users and permissions.",
      heading: "Unauthorized",
      body: "Only the system admin can manage the team.",
    },
    hero: {
      badge: "Permissions and users management",
      title: "Team",
      subtitle:
        "Add office members, assign each user’s permissions, and enable or disable system access from one clear and secure place.",
      addButton: "+ New member",
    },
    stats: {
      total: "All members",
      active: "Active users",
      admins: "Admins",
      inactive: "Disabled users",
    },
    filters: {
      search: "Search by user name or email...",
      roleAria: "Filter by role",
      statusAria: "Filter by status",
      allRoles: "All roles",
      allStatuses: "All statuses",
      filter: "Filter",
      clear: "Clear filters",
      all: "All",
      admins: "Admins",
      lawyers: "Lawyers",
      staff: "Staff",
    },
    form: {
      title: "Add user",
      subtitle:
        "The new user will sign in using the email and temporary password.",
      name: "Full name",
      email: "Email address",
      roleAria: "New user role",
      password: "Temporary password",
      saving: "Adding...",
      submit: "Add user",
      hint: "Use a strong temporary password, then ask the user to change it after their first sign-in.",
    },
    list: {
      title: "Team members",
      results: (count: number) =>
        `${count} user${count === 1 ? "" : "s"} in the current results`,
      lawyers: (count: number) => `${count} lawyer${count === 1 ? "" : "s"}`,
      staff: (count: number) => `${count} staff`,
      emptyTitle: "No members found",
      emptyNoUsers: "Add the first team user.",
      emptyFiltered: "No results match the current filters.",
      createdAt: (date: string) => `Created at: ${date}`,
      roleChangeAria: "Change user role",
      roleChangeTitle: "Change user role",
      deactivate: "Disable",
      activate: "Enable",
      unknownInitial: "?",
    },
  },
} as const;

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN:
    "rounded-full border border-white/10 bg-white/[.06] px-3 py-1 text-xs font-bold text-[var(--text-2)]",
  LAWYER:
    "rounded-full border border-white/10 bg-white/[.06] px-3 py-1 text-xs font-bold text-[var(--text-2)]",
  STAFF:
    "rounded-full border border-white/10 bg-white/[.06] px-3 py-1 text-xs font-bold text-[var(--text-2)]",
};

const INIT_FORM = {
  name: "",
  email: "",
  role: "LAWYER" as Role,
  password: "",
};

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString(locale === "ar" ? "ar-JO" : "en-US");
}

function PlanLimitBanner({
  message,
  onClose,
  copy,
  isRtl,
}: {
  message: string;
  onClose: () => void;
  copy: (typeof TEAM_COPY)[Locale];
  isRtl: boolean;
}) {
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-start">
          <h2 className="text-base font-black">{copy.plan.title}</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/billing" className="btn btn-primary">
            {copy.plan.billing}
          </Link>

          <button type="button" onClick={onClose} className="btn">
            {copy.plan.close}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const localeState = useLocale() as { locale?: Locale };
  const locale: Locale = localeState?.locale === "en" ? "en" : "ar";
  const copy = TEAM_COPY[locale];
  const isRtl = locale === "ar";
  const fieldStyle = {
    textAlign: isRtl ? "right" : "left",
    direction: isRtl ? "rtl" : "ltr",
  } satisfies CSSProperties;
  const ltrFieldStyle = {
    textAlign: isRtl ? "right" : "left",
    direction: "ltr",
  } satisfies CSSProperties;

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentRole, setCurrentRole] = useState("");
  const [planLimit, setPlanLimit] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [form, setForm] = useState(INIT_FORM);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/team");
      const data = await response.json().catch(() => ({}));

      if (data.success) {
        setUsers(Array.isArray(data.data?.users) ? data.data.users : []);
        setCurrentRole(data.data?.currentRole || "");
      } else {
        toast.error(getApiMessage(data, copy.messages.loadError));
      }
    } catch {
      toast.error(copy.messages.loadUnexpected);
    } finally {
      setLoading(false);
    }
  }, [copy.messages.loadError, copy.messages.loadUnexpected]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const adminsCount = users.filter((user) => user.role === "ADMIN").length;
  const lawyersCount = users.filter((user) => user.role === "LAWYER").length;
  const staffCount = users.filter((user) => user.role === "STAFF").length;
  const activeCount = users.filter((user) => user.isActive).length;
  const inactiveCount = users.filter((user) => !user.isActive).length;

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.isActive) ||
        (statusFilter === "inactive" && !user.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  function clearFilters() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  async function addUser(event: FormEvent) {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error(copy.messages.required);
      return;
    }

    try {
      setSaving(true);
      setPlanLimit("");

      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (data.success) {
        toast.success(copy.messages.addSuccess);
        setForm(INIT_FORM);
        loadUsers();
      } else if (isPlanLimitResponse(data)) {
        setPlanLimit(planLimitMessage(data, copy.plan.fallback));
      } else {
        toast.error(getApiMessage(data, copy.messages.addError));
      }
    } catch {
      toast.error(copy.messages.addError);
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(id: string, payload: Partial<TeamUser>) {
    try {
      const response = await fetch(`/api/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (data.success) {
        toast.success(copy.messages.updateSuccess);
        setUsers((previous) =>
          previous.map((user) => (user.id === id ? data.data : user)),
        );
      } else {
        toast.error(getApiMessage(data, copy.messages.updateError));
      }
    } catch {
      toast.error(copy.messages.updateUnexpected);
    }
  }

 if (loading) {
  return <AppLoader fullScreen={false} />
}
;

  if (currentRole && currentRole !== "ADMIN") {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 stagger">
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
            borderColor: "rgba(255,255,255,0.12)",
            boxShadow: "0 18px 50px rgba(45, 74, 62, 0.18)",
          }}
        >
          <h1 className="text-2xl font-black text-white">
            {copy.unauthorized.title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
            {copy.unauthorized.subtitle}
          </p>
        </div>

        <div className="card p-10 text-center">
          <h2 className="text-2xl font-black" style={{ color: "var(--text)" }}>
            {copy.unauthorized.heading}
          </h2>

          <p className="mt-3 text-sm" style={{ color: "var(--text-3)" }}>
            {copy.unauthorized.body}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 stagger">
      {planLimit && (
        <PlanLimitBanner
          message={planLimit}
          onClose={() => setPlanLimit("")}
          copy={copy}
          isRtl={isRtl}
        />
      )}

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
          <div className="text-start">
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {copy.hero.badge}
            </div>

            <h1 className="text-2xl font-black text-white">
              {copy.hero.title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75">
              {copy.hero.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const element = document.getElementById("add-team-user");
              element?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="btn shrink-0"
            style={{
              background: "#fff",
              color: "var(--sidebar)",
              borderColor: "rgba(255,255,255,0.32)",
            }}
          >
            {copy.hero.addButton}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: copy.stats.total,
            value: users.length,
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: copy.stats.active,
            value: activeCount,
            color: "var(--sidebar)",
            bg: "var(--green-soft)",
          },
          {
            label: copy.stats.admins,
            value: adminsCount,
            color: "#2563eb",
            bg: "var(--card)",
          },
          {
            label: copy.stats.inactive,
            value: inactiveCount,
            color: inactiveCount > 0 ? "#dc2626" : "var(--text-3)",
            bg: inactiveCount > 0 ? "var(--red-soft)" : "var(--card)",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="card p-5 text-start"
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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_.8fr_.8fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.filters.search}
            className="input"
            style={fieldStyle}
          />

          <select
            aria-label={copy.filters.roleAria}
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value as "all" | Role)
            }
            className="input"
            style={fieldStyle}
          >
            <option value="all">{copy.filters.allRoles}</option>
            <option value="ADMIN">{copy.roles.ADMIN}</option>
            <option value="LAWYER">{copy.roles.LAWYER}</option>
            <option value="STAFF">{copy.roles.STAFF}</option>
          </select>

          <select
            aria-label={copy.filters.statusAria}
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            className="input"
            style={fieldStyle}
          >
            <option value="all">{copy.filters.allStatuses}</option>
            <option value="active">{copy.status.active}</option>
            <option value="inactive">{copy.status.inactive}</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-ghost whitespace-nowrap"
          >
            {copy.filters.filter}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["all", copy.filters.all],
            ["ADMIN", copy.stats.admins],
            ["LAWYER", copy.filters.lawyers],
            ["STAFF", copy.filters.staff],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRoleFilter(key as "all" | Role)}
              className="rounded-2xl px-4 py-2 text-xs font-black transition-all"
              style={
                roleFilter === key
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

          {(search || roleFilter !== "all" || statusFilter !== "all") && (
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
              {copy.filters.clear}
            </button>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
        {/* Add User */}
        <form
          id="add-team-user"
          onSubmit={addUser}
          className="card p-5 text-start"
        >
          <div className="mb-5">
            <h2 className="text-xl font-black" style={{ color: "var(--text)" }}>
              {copy.form.title}
            </h2>

            <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
              {copy.form.subtitle}
            </p>
          </div>

          <div className="space-y-3">
            <input
              className="input"
              style={fieldStyle}
              placeholder={copy.form.name}
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
            />

            <input
              className="input"
              style={ltrFieldStyle}
              type="email"
              placeholder={copy.form.email}
              value={form.email}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
            />

            <select
              aria-label={copy.form.roleAria}
              className="input"
              style={fieldStyle}
              value={form.role}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  role: event.target.value as Role,
                }))
              }
            >
              <option value="ADMIN">{copy.roles.ADMIN}</option>
              <option value="LAWYER">{copy.roles.LAWYER}</option>
              <option value="STAFF">{copy.roles.STAFF}</option>
            </select>

            <input
              className="input"
              style={ltrFieldStyle}
              type="password"
              placeholder={copy.form.password}
              value={form.password}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
            />

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary w-full"
            >
              {saving ? copy.form.saving : copy.form.submit}
            </button>
          </div>

          <div
            className="mt-5 rounded-2xl border p-3 text-xs leading-6"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-3)",
              background: "var(--green-soft)",
            }}
          >
            {copy.form.hint}
          </div>
        </form>

        {/* Team List */}
        <div className="card overflow-hidden p-0">
          <div
            className="flex items-center justify-between gap-4 border-b px-5 py-4"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="text-start">
              <h2 className="font-black" style={{ color: "var(--text)" }}>
                {copy.list.title}
              </h2>

              <p className="mt-1 text-xs font-semibold text-[var(--text-2)]">
                {copy.list.results(filteredUsers.length)}
              </p>
            </div>

            <div className="hidden gap-2 sm:flex">
              <span className="rounded-full border border-white/10 bg-white/[.07] px-3 py-1 text-xs font-bold text-[var(--text-2)]">
                {copy.list.lawyers(lawyersCount)}
              </span>

              <span className="rounded-full border border-white/10 bg-white/[.07] px-3 py-1 text-xs font-bold text-[var(--text-2)]">
                {copy.list.staff(staffCount)}
              </span>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon="👥"
                title={copy.list.emptyTitle}
                sub={
                  users.length === 0
                    ? copy.list.emptyNoUsers
                    : copy.list.emptyFiltered
                }
                action={
                  users.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="btn btn-ghost"
                    >
                      {copy.filters.clear}
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3 text-start">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-black text-white"
                      style={{
                        background: user.isActive
                          ? "var(--sidebar)"
                          : "#9ca3af",
                      }}
                    >
                      {user.name?.charAt(0) || copy.list.unknownInitial}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className="truncate font-black"
                          style={{ color: "var(--text)" }}
                        >
                          {user.name}
                        </p>

                        <span className={ROLE_BADGE[user.role]}>
                          {copy.roles[user.role]}
                        </span>

                        <span
                          className="rounded-full px-3 py-1 text-xs font-black"
                          style={
                            user.isActive
                              ? {
                                  background: "var(--green-soft)",
                                  color: "var(--sidebar)",
                                }
                              : {
                                  background: "var(--red-soft)",
                                  color: "#dc2626",
                                }
                          }
                        >
                          {user.isActive
                            ? copy.status.active
                            : copy.status.inactive}
                        </span>
                      </div>

                      <p
                        className="mt-1 truncate text-sm"
                        dir="ltr"
                        style={{
                          color: "var(--text-3)",
                          textAlign: isRtl ? "right" : "left",
                        }}
                      >
                        {user.email}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-[var(--text-2)]">
                        {copy.list.createdAt(
                          formatDate(user.createdAt, locale),
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      aria-label={copy.list.roleChangeAria}
                      title={copy.list.roleChangeTitle}
                      className="input min-w-[150px]"
                      style={fieldStyle}
                      value={user.role}
                      onChange={(event) =>
                        updateUser(user.id, {
                          role: event.target.value as Role,
                        })
                      }
                    >
                      <option value="ADMIN">{copy.roles.ADMIN}</option>
                      <option value="LAWYER">{copy.roles.LAWYER}</option>
                      <option value="STAFF">{copy.roles.STAFF}</option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        updateUser(user.id, {
                          isActive: !user.isActive,
                        })
                      }
                      className="btn whitespace-nowrap"
                      style={
                        user.isActive
                          ? {
                              background: "var(--red-soft)",
                              color: "#dc2626",
                            }
                          : {
                              background: "var(--green-soft)",
                              color: "var(--sidebar)",
                            }
                      }
                    >
                      {user.isActive
                        ? copy.list.deactivate
                        : copy.list.activate}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
