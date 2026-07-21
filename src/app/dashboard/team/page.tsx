"use client";
import AppLoader from "@/components/ui/AppLoader";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { toast } from "sonner";

import {
  VDSBadge,
  VDSDataTable,
  type VDSDataTableColumn,
} from "@/components/ui/vds";
import { VDSSearchInput } from "@/components/ui/vds/table";
import {
  getApiMessage,
  isPlanLimitResponse,
  planLimitMessage,
} from "@/lib/plan-ui";
import { useLocale } from "@/lib/useLocale";
import SubscriptionReadOnlyBanner from "@/components/billing/SubscriptionReadOnlyBanner";
import { useTenantWriteAccess } from "@/hooks/useTenantWriteAccess";

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
      required: "الاسم والبريد والصلاحية مطلوبة",
      addSuccess: "تم إرسال دعوة الانضمام",
      addError: "تعذر إرسال دعوة الانضمام",
      revokeSuccess: "تم إلغاء الدعوة",
      revokeError: "تعذر إلغاء الدعوة",
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
      title: "دعوة عضو جديد",
      subtitle: "سنرسل رابطًا آمنًا ليختار العضو كلمة مروره بنفسه.",
      name: "الاسم الكامل",
      email: "البريد الإلكتروني",
      roleAria: "صلاحية المستخدم الجديد",
      saving: "جاري إرسال الدعوة...",
      submit: "إرسال الدعوة",
      hint: "تنتهي صلاحية رابط الدعوة خلال 72 ساعة، وتحجز الدعوة مقعدًا من الخطة حتى قبولها أو إلغائها.",
      pendingTitle: "الدعوات المعلقة",
      pendingEmpty: "لا توجد دعوات معلقة.",
      expires: (date: string) => `تنتهي: ${date}`,
      revoke: "إلغاء الدعوة",
      seats: (used: number, pending: number, limit: number | null) =>
        `المقاعد: ${used} مستخدم + ${pending} دعوة / ${limit ?? "∞"}`,
    },
    list: {
      title: "أعضاء الفريق",
      member: "العضو",
      role: "الصلاحية",
      status: "الحالة",
      createdAtHeader: "تاريخ الإضافة",
      actions: "الإجراءات",
      results: (count: number) => `${count} مستخدم ضمن النتائج الحالية`,
      lawyers: (count: number) => `${count} محامٍ`,
      staff: (count: number) => `${count} موظف`,
      emptyTitle: "لا يوجد أعضاء",
      emptyNoUsers: "أضف أول مستخدم للفريق.",
      emptyFiltered: "لا توجد نتائج مطابقة للفلاتر الحالية.",
      createdAt: (date: string) => `تاريخ الإضافة: ${date}`,
      roleChangeAria: "تغيير صلاحية المستخدم",
      roleChangeTitle: "تغيير صلاحية المستخدم",
      systemAdminFixed: "منصب مدير النظام ثابت",
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
      required: "Name, email, and role are required",
      addSuccess: "Invitation sent successfully",
      addError: "Unable to send the invitation",
      revokeSuccess: "Invitation revoked",
      revokeError: "Unable to revoke the invitation",
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
      title: "Invite a new member",
      subtitle:
        "We will send a secure link so the member chooses their own password.",
      name: "Full name",
      email: "Email address",
      roleAria: "New user role",
      saving: "Sending invitation...",
      submit: "Send invitation",
      hint: "The invitation expires after 72 hours and reserves a plan seat until it is accepted or revoked.",
      pendingTitle: "Pending invitations",
      pendingEmpty: "No pending invitations.",
      expires: (date: string) => `Expires: ${date}`,
      revoke: "Revoke",
      seats: (used: number, pending: number, limit: number | null) =>
        `Seats: ${used} users + ${pending} invites / ${limit ?? "∞"}`,
    },
    list: {
      title: "Team members",
      member: "Member",
      role: "Role",
      status: "Status",
      createdAtHeader: "Created at",
      actions: "Actions",
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
      systemAdminFixed: "The system admin role is fixed",
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
  isSystemAdmin: boolean;
  createdAt: string;
}

interface TeamInvitation {
  id: string;
  name: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

interface SeatUsage {
  used: number;
  pending: number;
  limit: number | null;
}

const ROLE_TONE = {
  ADMIN: "gold",
  LAWYER: "teal",
  STAFF: "slate",
} as const satisfies Record<Role, "gold" | "teal" | "slate">;

const INIT_FORM = {
  name: "",
  email: "",
  role: "LAWYER" as Role,
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

function getTeamFeatureFallback(locale: Locale) {
  return locale === "en"
    ? "Team management is not included in your current plan. Upgrade to Pro or Business to continue."
    : "إدارة الفريق غير متاحة في خطتك الحالية. قم بالترقية إلى Pro أو Business للمتابعة.";
}

export default function TeamPage() {
  const localeState = useLocale() as { locale?: Locale };
  const locale: Locale = localeState?.locale === "en" ? "en" : "ar";
  const copy = TEAM_COPY[locale];
  const isRtl = locale === "ar";
  const writeAccess = useTenantWriteAccess(locale);
  const canManageTeam =
    writeAccess.canWrite && writeAccess.entitlements?.teamManagement === true;
  const teamAccessMessage =
    writeAccess.message || getTeamFeatureFallback(locale);
  const fieldStyle = {
    textAlign: isRtl ? "right" : "left",
    direction: isRtl ? "rtl" : "ltr",
  } satisfies CSSProperties;
  const ltrFieldStyle = {
    textAlign: isRtl ? "right" : "left",
    direction: "ltr",
  } satisfies CSSProperties;

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<
    TeamInvitation[]
  >([]);
  const [seats, setSeats] = useState<SeatUsage>({
    used: 0,
    pending: 0,
    limit: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentRole, setCurrentRole] = useState("");
  const [planLimit, setPlanLimit] = useState("");
  const [credentialFieldsReady, setCredentialFieldsReady] = useState(false);

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
        setPendingInvitations(
          Array.isArray(data.data?.pendingInvitations)
            ? data.data.pendingInvitations
            : [],
        );
        if (data.data?.seats) setSeats(data.data.seats);
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

    const matches = users.filter((user) => {
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

    return matches.sort((first, second) => {
      if (first.isSystemAdmin === second.isSystemAdmin) return 0;
      return first.isSystemAdmin ? -1 : 1;
    });
  }, [users, search, roleFilter, statusFilter]);

  const columns: VDSDataTableColumn<TeamUser>[] = [
    {
      id: "member",
      header: copy.list.member,
      accessor: "name",
      sortable: true,
      width: "32%",
      cell: (user) => (
        <div className="flex min-w-[240px] items-center gap-3 text-start">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white"
            style={{
              background: user.isActive ? "var(--sidebar)" : "#9ca3af",
            }}
          >
            {user.name?.charAt(0) || copy.list.unknownInitial}
          </div>

          <div className="min-w-0">
            <p
              className="max-w-[240px] truncate text-sm font-black"
              style={{ color: "var(--text)" }}
              title={user.name}
            >
              {user.name}
            </p>

            <p
              dir="ltr"
              className="mt-1 max-w-[240px] truncate text-xs"
              style={{
                color: "var(--text-3)",
                textAlign: isRtl ? "right" : "left",
              }}
              title={user.email}
            >
              {user.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: copy.list.role,
      accessor: "role",
      sortable: true,
      align: "center",
      cell: (user) => (
        <VDSBadge tone={ROLE_TONE[user.role]}>{copy.roles[user.role]}</VDSBadge>
      ),
    },
    {
      id: "status",
      header: copy.list.status,
      accessor: "isActive",
      sortable: true,
      align: "center",
      cell: (user) => (
        <VDSBadge tone={user.isActive ? "teal" : "red"}>
          {user.isActive ? copy.status.active : copy.status.inactive}
        </VDSBadge>
      ),
    },
    {
      id: "createdAt",
      header: copy.list.createdAtHeader,
      accessor: "createdAt",
      sortable: true,
      align: "center",
      cell: (user) => (
        <span className="whitespace-nowrap text-xs font-bold">
          {formatDate(user.createdAt, locale)}
        </span>
      ),
    },
    {
      id: "actions",
      header: copy.list.actions,
      align: "center",
      width: "300px",
      cell: (user) =>
        user.isSystemAdmin ? (
          <span title={copy.list.systemAdminFixed}>
            <VDSBadge tone="gold">{copy.list.systemAdminFixed}</VDSBadge>
          </span>
        ) : (
          <div className="flex min-w-[280px] items-center justify-center gap-2">
            <select
              aria-label={copy.list.roleChangeAria}
              className="input min-w-[150px] disabled:cursor-not-allowed disabled:opacity-60"
              style={fieldStyle}
              value={user.role}
              disabled={!canManageTeam}
              title={
                !canManageTeam ? teamAccessMessage : copy.list.roleChangeTitle
              }
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
              disabled={!canManageTeam}
              title={!canManageTeam ? teamAccessMessage : undefined}
              onClick={() =>
                updateUser(user.id, {
                  isActive: !user.isActive,
                })
              }
              className="btn whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
              style={
                user.isActive
                  ? {
                      background: "var(--red-soft)",
                      color: "#dc2626",
                    }
                  : {
                      background: "var(--green-soft)",
                      color: "var(--text)",
                    }
              }
            >
              {user.isActive ? copy.list.deactivate : copy.list.activate}
            </button>
          </div>
        ),
    },
  ];

  function clearFilters() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  async function addUser(event: FormEvent) {
    event.preventDefault();

    if (!canManageTeam) {
      toast.error(teamAccessMessage);
      return;
    }

    if (!form.name.trim() || !form.email.trim()) {
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
        setCredentialFieldsReady(false);
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

  async function revokeInvitation(id: string) {
    if (!canManageTeam) return;

    try {
      const response = await fetch(`/api/team/invitations/${id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        toast.error(getApiMessage(data, copy.messages.revokeError));
        return;
      }

      toast.success(copy.messages.revokeSuccess);
      loadUsers();
    } catch {
      toast.error(copy.messages.revokeError);
    }
  }

  async function updateUser(id: string, payload: Partial<TeamUser>) {
    if (!canManageTeam) {
      toast.error(teamAccessMessage);
      return;
    }

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
    return <AppLoader fullScreen={false} />;
  }
  if (currentRole && currentRole !== "ADMIN") {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5 stagger">
        <div
          className="relative overflow-hidden rounded-[28px] border p-6"
          style={{
            background:
              "linear-gradient(135deg, var(--sidebar) 0%, var(--sidebar-hover) 60%, var(--sidebar-dark) 100%)",
            borderColor: "rgba(255,255,255,0.12)",
            boxShadow: "0 18px 50px rgba(15, 61, 62, 0.18)",
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
      <SubscriptionReadOnlyBanner
        visible={!canManageTeam}
        message={teamAccessMessage}
        isRtl={isRtl}
      />
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
              if (!canManageTeam) return;
              const element = document.getElementById("add-team-user");
              element?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            disabled={!canManageTeam}
            title={!canManageTeam ? teamAccessMessage : copy.hero.addButton}
            className="btn shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
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
          <VDSSearchInput
            value={search}
            onChange={setSearch}
            placeholder={copy.filters.search}
            dir={isRtl ? "rtl" : "ltr"}
            clearLabel={isRtl ? "مسح البحث" : "Clear search"}
          />

          <select
            aria-label={copy.filters.roleAria}
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value as "all" | Role)
            }
            className="input h-12"
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
            className="input h-12"
            style={fieldStyle}
          >
            <option value="all">{copy.filters.allStatuses}</option>
            <option value="active">{copy.status.active}</option>
            <option value="inactive">{copy.status.inactive}</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            disabled={!search && roleFilter === "all" && statusFilter === "all"}
            className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl border px-5 text-sm font-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c47a31] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--card-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            {copy.filters.clear}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Add User */}
        <form
          id="add-team-user"
          onSubmit={addUser}
          autoComplete="off"
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
              name="team-member-full-name"
              autoComplete="off"
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
              name="team-member-email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              readOnly={!credentialFieldsReady}
              onFocus={() => setCredentialFieldsReady(true)}
              data-lpignore="true"
              data-1p-ignore="true"
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

            <button
              type="submit"
              disabled={saving || !canManageTeam}
              title={!canManageTeam ? teamAccessMessage : copy.form.submit}
              className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
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

          <div
            className="mt-4 rounded-2xl border p-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <h3
                className="text-sm font-black"
                style={{ color: "var(--text)" }}
              >
                {copy.form.pendingTitle}
              </h3>
              <span
                className="text-xs font-bold"
                style={{ color: "var(--text-3)" }}
              >
                {copy.form.seats(seats.used, seats.pending, seats.limit)}
              </span>
            </div>

            {pendingInvitations.length === 0 ? (
              <p className="mt-3 text-xs" style={{ color: "var(--text-3)" }}>
                {copy.form.pendingEmpty}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--card-2)",
                    }}
                  >
                    <p
                      className="truncate text-sm font-black"
                      style={{ color: "var(--text)" }}
                    >
                      {invitation.name}
                    </p>
                    <p
                      dir="ltr"
                      className="truncate text-start text-xs"
                      style={{ color: "var(--text-3)" }}
                    >
                      {invitation.email}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--text-3)" }}
                      >
                        {copy.form.expires(
                          formatDate(invitation.expiresAt, locale),
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => revokeInvitation(invitation.id)}
                        disabled={!canManageTeam}
                        className="text-xs font-black text-red-500 disabled:opacity-50"
                      >
                        {copy.form.revoke}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Team List */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-start">
              <h2 className="font-black" style={{ color: "var(--text)" }}>
                {copy.list.title}
              </h2>

              <p className="mt-1 text-xs font-semibold text-[var(--text-2)]">
                {copy.list.results(filteredUsers.length)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <VDSBadge tone="teal">{copy.list.lawyers(lawyersCount)}</VDSBadge>

              <VDSBadge tone="slate">{copy.list.staff(staffCount)}</VDSBadge>
            </div>
          </div>

          <VDSDataTable<TeamUser>
            rows={filteredUsers}
            columns={columns}
            getRowId={(user) => user.id}
            loading={false}
            isRtl={isRtl}
            labels={{
              emptyTitle: copy.list.emptyTitle,
              emptyDescription:
                users.length === 0
                  ? copy.list.emptyNoUsers
                  : copy.list.emptyFiltered,
            }}
            emptyAction={
              users.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!canManageTeam) return;
                    document
                      .getElementById("add-team-user")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  disabled={!canManageTeam}
                  title={
                    !canManageTeam ? teamAccessMessage : copy.hero.addButton
                  }
                  className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copy.hero.addButton}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn btn-ghost"
                >
                  {copy.filters.clear}
                </button>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
