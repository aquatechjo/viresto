import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ManualPaymentsPanel from "./ManualPaymentsPanel";
import ManualPaymentSettingsPanel from "./ManualPaymentSettingsPanel";
import TenantDeletionControls from "./TenantDeletionControls";
import TenantSubscriptionControls from "./TenantSubscriptionControls";
import { requireSystemAdmin } from "@/lib/system-admin";
import {
  suspendTenant,
  activateTenant,
  deactivateUser,
  activateUser,
} from "./actions";
import { getEffectiveSubscriptionStatus } from "@/lib/billing-limits";

type AdminSubscription = Prisma.SubscriptionGetPayload<{
  include: {
    plan: true;
  };
}>;

function selectAdminSubscription(subscriptions: AdminSubscription[]) {
  return (
    subscriptions.find((subscription) =>
      ["ACTIVE", "TRIALING"].includes(
        getEffectiveSubscriptionStatus(
          subscription.status,
          subscription.currentPeriodEnd,
        ),
      ),
    ) ??
    subscriptions.find((subscription) =>
      ["ACTIVE", "TRIALING"].includes(subscription.status),
    ) ??
    subscriptions[0] ??
    null
  );
}

const subscriptionStatusLabels: Record<string, string> = {
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
  EXPIRED: "badge badge-amber",
  MISSING: "badge badge-gray",
};

const planClasses: Record<string, string> = {
  BASIC: "badge badge-gray",
  PRO: "badge badge-green",
  BUSINESS: "badge badge-blue",
};

const roleLabels: Record<string, string> = {
  ADMIN: "مدير",
  LAWYER: "محامٍ",
  STAFF: "موظف",
};

function formatDate(value?: Date | null) {
  if (!value) return "-";
  return value.toLocaleDateString("ar-JO");
}

type AdminPageProps = {
  searchParams: Promise<{
    q?: string;
    plan?: string;
    status?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  try {
    await requireSystemAdmin();
  } catch {
    redirect("/login");
  }

  const [tenants, billingPlans] = await Promise.all([
    prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            cases: true,
            payments: true,
            documents: true,
            invoices: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            isSystemAdmin: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            plan: true,
          },
        },
        subscriptionPayments: {
          where: {
            status: "PENDING",
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.billingPlan.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
        priceMonthly: true,
        priceYearly: true,
        maxUsers: true,
      },
    }),
  ]);

  const orderedTenants = [...tenants].sort((first, second) => {
    const firstIsSystemTenant = first.users.some(
      (user) => user.isSystemAdmin,
    );
    const secondIsSystemTenant = second.users.some(
      (user) => user.isSystemAdmin,
    );

    if (firstIsSystemTenant !== secondIsSystemTenant) {
      return firstIsSystemTenant ? -1 : 1;
    }

    return second.createdAt.getTime() - first.createdAt.getTime();
  });

  const totals = orderedTenants.reduce(
    (acc, tenant) => {
      acc.users += tenant._count.users;
      acc.clients += tenant._count.clients;
      acc.cases += tenant._count.cases;
      acc.invoices += tenant._count.invoices;
      acc.documents += tenant._count.documents;

      const subscription = selectAdminSubscription(tenant.subscriptions);
      const effectiveStatus = subscription
        ? getEffectiveSubscriptionStatus(
            subscription.status,
            subscription.currentPeriodEnd,
          )
        : "MISSING";

      if (tenant.isSuspended || tenant.status === "SUSPENDED") {
        acc.suspended += 1;
      } else if (["ACTIVE", "TRIALING"].includes(effectiveStatus)) {
        acc.active += 1;
      }

      return acc;
    },
    {
      users: 0,
      clients: 0,
      cases: 0,
      invoices: 0,
      documents: 0,
      active: 0,
      suspended: 0,
    },
  );

  const params = await searchParams;
  const query = String(params.q || "").trim().toLowerCase();
  const requestedPlan = String(params.plan || "").toUpperCase();
  const requestedStatus = String(params.status || "").toUpperCase();
  const planFilter = ["BASIC", "PRO", "BUSINESS"].includes(requestedPlan)
    ? requestedPlan
    : "ALL";
  const statusFilter = ["ACTIVE", "EXPIRED", "SUSPENDED"].includes(
    requestedStatus,
  )
    ? requestedStatus
    : "ALL";

  const filteredTenants = orderedTenants.filter((tenant) => {
    const subscription = selectAdminSubscription(tenant.subscriptions);
    const effectiveStatus = subscription
      ? getEffectiveSubscriptionStatus(
          subscription.status,
          subscription.currentPeriodEnd,
        )
      : "MISSING";
    const isSuspended =
      tenant.isSuspended || tenant.status === "SUSPENDED";

    const matchesQuery =
      !query ||
      tenant.name.toLowerCase().includes(query) ||
      tenant.slug.toLowerCase().includes(query) ||
      tenant.email?.toLowerCase().includes(query) ||
      tenant.users.some(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query),
      );

    const matchesPlan =
      planFilter === "ALL" || subscription?.plan.code === planFilter;

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "SUSPENDED" && isSuspended) ||
      (statusFilter === "ACTIVE" &&
        !isSuspended &&
        ["ACTIVE", "TRIALING"].includes(effectiveStatus)) ||
      (statusFilter === "EXPIRED" &&
        !isSuspended &&
        !["ACTIVE", "TRIALING"].includes(effectiveStatus));

    return matchesQuery && matchesPlan && matchesStatus;
  });

  return (
    <main className="min-h-screen space-y-6 p-5 md:p-8" dir="rtl">
      {/* Hero */}
      <div
        id="overview"
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

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div
              className="mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              إدارة الشركة
            </div>

            <h1 className="text-2xl font-black text-white">
              لوحة إدارة النظام
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-white/75">
              إدارة المكاتب، الحسابات، الاشتراكات الفعلية، وطلبات الدفع من
              لوحة شركة مركزية واحدة.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-4 py-2 text-xs font-black"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {tenants.length} مكتب
            </span>

            <span
              className="rounded-full px-4 py-2 text-xs font-black"
              style={{
                background: "rgba(184, 115, 51,0.18)",
                color: "#fff",
                border: "1px solid rgba(184, 115, 51,0.35)",
              }}
            >
              {totals.users} مستخدم
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          {
            label: "المكاتب",
            value: tenants.length,
            hint: "إجمالي المكاتب",
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: "اشتراكات نشطة",
            value: totals.active,
            hint: "فعالة حاليًا",
            color: "var(--sidebar)",
            bg: "var(--green-soft)",
          },
          {
            label: "مكاتب معلقة",
            value: totals.suspended,
            hint: "تحتاج مراجعة",
            color: totals.suspended > 0 ? "#dc2626" : "var(--text)",
            bg: totals.suspended > 0 ? "var(--red-soft)" : "var(--card)",
          },
          {
            label: "المستخدمون",
            value: totals.users,
            hint: "كل الحسابات",
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: "القضايا",
            value: totals.cases,
            hint: "كل المكاتب",
            color: "var(--text)",
            bg: "var(--card)",
          },
          {
            label: "الفواتير",
            value: totals.invoices,
            hint: "كل المكاتب",
            color: "var(--text)",
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

            <p
              className="mt-1 text-xs font-bold"
              style={{ color: "var(--text-3)" }}
            >
              {item.hint}
            </p>
          </div>
        ))}
      </div>

      <div id="payment-settings" className="scroll-mt-32">
        <ManualPaymentSettingsPanel />
      </div>

      <div id="manual-payments" className="scroll-mt-32">
        <ManualPaymentsPanel />
      </div>

      {/* Tenants */}
      <section id="offices" className="scroll-mt-32 space-y-4">
        <div className="card p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-black">دليل المكاتب</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
                ابحث عن مكتب أو صفِّ النتائج حسب الخطة وحالة الاشتراك، ثم افتح
                تفاصيل المكتب المطلوب فقط.
              </p>
            </div>

            <p className="text-sm font-black" style={{ color: "var(--text-3)" }}>
              {filteredTenants.length} من {tenants.length} مكتب
            </p>
          </div>

          <form
            method="get"
            action="/admin#offices"
            className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto_auto]"
          >
            <label className="space-y-1 text-sm">
              <span className="font-bold">البحث</span>
              <input
                name="q"
                defaultValue={params.q ?? ""}
                className="input"
                placeholder="اسم المكتب، الرابط أو البريد..."
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-bold">الخطة</span>
              <select name="plan" defaultValue={planFilter} className="input">
                <option value="ALL">كل الخطط</option>
                <option value="BASIC">Basic</option>
                <option value="PRO">Pro</option>
                <option value="BUSINESS">Business</option>
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-bold">الحالة</span>
              <select name="status" defaultValue={statusFilter} className="input">
                <option value="ALL">كل الحالات</option>
                <option value="ACTIVE">نشط</option>
                <option value="EXPIRED">غير نشط</option>
                <option value="SUSPENDED">معلّق</option>
              </select>
            </label>

            <div className="flex items-end">
              <button className="btn btn-primary w-full">تطبيق</button>
            </div>

            <div className="flex items-end">
              <a href="/admin#offices" className="btn btn-ghost w-full">
                مسح
              </a>
            </div>
          </form>
        </div>

        <div className="grid gap-4">
          {filteredTenants.length === 0 && (
            <div className="card p-8 text-center">
              <p className="font-black">لا توجد مكاتب مطابقة</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
                غيّر كلمات البحث أو امسح عوامل التصفية.
              </p>
            </div>
          )}

          {filteredTenants.map((tenant) => {
          const hasSystemAdmin = tenant.users.some(
            (user) => user.isSystemAdmin,
          );
          const currentSubscription = selectAdminSubscription(
            tenant.subscriptions,
          );
          const effectiveSubscriptionStatus = currentSubscription
            ? getEffectiveSubscriptionStatus(
                currentSubscription.status,
                currentSubscription.currentPeriodEnd,
              )
            : "MISSING";

          return (
            <details
              key={tenant.id}
              open={
                filteredTenants.length === 1 &&
                Boolean(query || planFilter !== "ALL" || statusFilter !== "ALL")
              }
              className="card group overflow-hidden p-0"
            >
              {/* Tenant Header */}
              <summary
                className="flex cursor-pointer list-none flex-col gap-4 border-b p-5 xl:flex-row xl:items-start xl:justify-between"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2
                      className="text-xl font-black"
                      style={{ color: "var(--text)" }}
                    >
                      {tenant.name}
                    </h2>

                    <span
                      className={
                        planClasses[currentSubscription?.plan.code ?? ""] ??
                        "badge badge-gray"
                      }
                    >
                      {currentSubscription
                        ? `${currentSubscription.plan.name} - ${currentSubscription.plan.code}`
                        : "لا توجد خطة"}
                    </span>

                    <span
                      className={
                        statusClasses[effectiveSubscriptionStatus] ??
                        "badge badge-gray"
                      }
                    >
                      {subscriptionStatusLabels[
                        effectiveSubscriptionStatus
                      ] ?? effectiveSubscriptionStatus}
                    </span>

                    {hasSystemAdmin && (
                      <span className="badge badge-blue">
                        مكتب النظام الرئيسي
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span
                      className="rounded-full px-3 py-1"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text-3)",
                      }}
                    >
                      رابط المكتب: {tenant.slug}
                    </span>

                    <span
                      className="rounded-full px-3 py-1"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text-3)",
                      }}
                    >
                      حد المستخدمين: {currentSubscription?.plan.maxUsers ?? 0}
                    </span>

                    <span
                      className="rounded-full px-3 py-1"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text-3)",
                      }}
                    >
                      نهاية الاشتراك: {formatDate(
                        currentSubscription?.currentPeriodEnd ??
                          currentSubscription?.trialEndsAt,
                      )}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="inline-flex rounded-xl border px-4 py-2 text-sm font-black group-open:hidden" style={{ borderColor: "var(--border)" }}>
                    عرض التفاصيل ↓
                  </span>
                  <span className="hidden rounded-xl border px-4 py-2 text-sm font-black group-open:inline-flex" style={{ borderColor: "var(--border)" }}>
                    إخفاء التفاصيل ↑
                  </span>
                </div>
              </summary>

              <div
                className="flex justify-end border-b px-5 py-3"
                style={{ borderColor: "var(--border)" }}
              >
                {hasSystemAdmin ? (
                  <span
                    className="inline-flex rounded-xl px-4 py-2 text-sm font-bold"
                    style={{
                      background: "var(--input-bg)",
                      color: "var(--text-3)",
                    }}
                  >
                    مكتب الشركة محمي
                  </span>
                ) : tenant.isSuspended ? (
                  <form action={activateTenant.bind(null, tenant.id)}>
                    <button className="btn btn-primary">رفع تعليق المكتب</button>
                  </form>
                ) : (
                  <form action={suspendTenant.bind(null, tenant.id)}>
                    <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-500/10">
                      تعليق المكتب
                    </button>
                  </form>
                )}
              </div>

              {/* Tenant Stats */}
              <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  ["المستخدمون", tenant._count.users],
                  ["الموكلون", tenant._count.clients],
                  ["القضايا", tenant._count.cases],
                  ["المدفوعات", tenant._count.payments],
                  ["الفواتير", tenant._count.invoices],
                  ["المستندات", tenant._count.documents],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--input-bg)",
                    }}
                  >
                    <p
                      className="text-xs font-black"
                      style={{ color: "var(--text-3)" }}
                    >
                      {label}
                    </p>

                    <p
                      className="mt-1 text-2xl font-black"
                      style={{ color: "var(--text)" }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Billing */}
              <div className="px-5 pb-5">
                <TenantSubscriptionControls
                  tenantId={tenant.id}
                  isProtectedTenant={hasSystemAdmin}
                  plans={billingPlans}
                  current={
                    currentSubscription
                      ? {
                          id: currentSubscription.id,
                          status: currentSubscription.status,
                          effectiveStatus: effectiveSubscriptionStatus,
                          interval: currentSubscription.interval,
                          provider: currentSubscription.provider,
                          currency: currentSubscription.currency,
                          amount: currentSubscription.amount,
                          trialEndsAt:
                            currentSubscription.trialEndsAt?.toISOString() ??
                            null,
                          currentPeriodStart:
                            currentSubscription.currentPeriodStart?.toISOString() ??
                            null,
                          currentPeriodEnd:
                            currentSubscription.currentPeriodEnd?.toISOString() ??
                            null,
                          cancelAtPeriodEnd:
                            currentSubscription.cancelAtPeriodEnd,
                          cancelledAt:
                            currentSubscription.cancelledAt?.toISOString() ??
                            null,
                          plan: {
                            id: currentSubscription.plan.id,
                            code: currentSubscription.plan.code,
                            name: currentSubscription.plan.name,
                            maxUsers: currentSubscription.plan.maxUsers,
                          },
                        }
                      : null
                  }
                />
              </div>

              {/* Users */}
              <div className="px-5 pb-5">
                <div
                  className="overflow-hidden rounded-[24px] border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div
                    className="flex items-center justify-between gap-3 border-b px-4 py-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div>
                      <h3
                        className="font-black"
                        style={{ color: "var(--text)" }}
                      >
                        مستخدمو المكتب
                      </h3>

                      <p
                        className="mt-1 text-xs"
                        style={{ color: "var(--text-3)" }}
                      >
                        {tenant.users.length} مستخدم داخل هذا المكتب
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>الاسم</th>
                          <th>الإيميل</th>
                          <th>الدور</th>
                          <th>مدير النظام</th>
                          <th>الحالة</th>
                          <th>تاريخ الإنشاء</th>
                          <th>إجراء</th>
                        </tr>
                      </thead>

                      <tbody>
                        {tenant.users.map((user) => (
                          <tr key={user.id}>
                            <td className="font-black">{user.name}</td>

                            <td>{user.email}</td>

                            <td>{roleLabels[user.role] ?? user.role}</td>

                            <td>
                              {user.isSystemAdmin ? (
                                <span className="badge badge-blue">نعم</span>
                              ) : (
                                <span className="badge badge-gray">لا</span>
                              )}
                            </td>

                            <td>
                              {user.isActive ? (
                                <span className="badge badge-green">نشط</span>
                              ) : (
                                <span className="badge badge-red">معطل</span>
                              )}
                            </td>

                            <td>{formatDate(user.createdAt)}</td>

                            <td>
                              {user.isSystemAdmin ? (
                                <span
                                  className="rounded-xl px-3 py-1 text-sm font-bold"
                                  style={{
                                    background: "var(--input-bg)",
                                    color: "var(--text-3)",
                                  }}
                                >
                                  محمي
                                </span>
                              ) : user.isActive ? (
                                <form
                                  action={deactivateUser.bind(null, user.id)}
                                >
                                  <button className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-500/10">
                                    تعطيل
                                  </button>
                                </form>
                              ) : (
                                <form action={activateUser.bind(null, user.id)}>
                                  <button className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10">
                                    تفعيل
                                  </button>
                                </form>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Permanent deletion */}
              <div className="px-5 pb-5">
                <TenantDeletionControls
                  tenantId={tenant.id}
                  tenantName={tenant.name}
                  isProtectedTenant={hasSystemAdmin}
                  isSuspended={
                    tenant.isSuspended || tenant.status === "SUSPENDED"
                  }
                  hasActiveSubscription={[
                    "ACTIVE",
                    "TRIALING",
                  ].includes(effectiveSubscriptionStatus)}
                  pendingPaymentCount={tenant.subscriptionPayments.length}
                />
              </div>
            </details>
          );
          })}
        </div>
      </section>
    </main>
  );
}
