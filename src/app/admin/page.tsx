import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ManualPaymentsPanel from "./ManualPaymentsPanel";
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

export default async function AdminPage() {
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

  const totals = tenants.reduce(
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

  return (
    <main className="min-h-screen space-y-6 p-5 md:p-8" dir="rtl">
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
              System Admin
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

      <ManualPaymentsPanel />

      {/* Tenants */}
      <div className="grid gap-5">
        {tenants.map((tenant) => {
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
            <section key={tenant.id} className="card overflow-hidden p-0">
              {/* Tenant Header */}
              <div
                className="flex flex-col gap-4 border-b p-5 xl:flex-row xl:items-start xl:justify-between"
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
                      Slug: {tenant.slug}
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
                  {hasSystemAdmin ? (
                    <span
                      className="inline-flex rounded-xl px-4 py-2 text-sm font-bold"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text-3)",
                      }}
                    >
                      محمي
                    </span>
                  ) : tenant.isSuspended ? (
                    <form action={activateTenant.bind(null, tenant.id)}>
                      <button className="btn btn-primary">تفعيل المكتب</button>
                    </form>
                  ) : (
                    <form action={suspendTenant.bind(null, tenant.id)}>
                      <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">
                        تعليق المكتب
                      </button>
                    </form>
                  )}
                </div>
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
                          <th>System Admin</th>
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
                                  <button className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50">
                                    تعطيل
                                  </button>
                                </form>
                              ) : (
                                <form action={activateUser.bind(null, user.id)}>
                                  <button className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50">
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
            </section>
          );
        })}
      </div>
    </main>
  );
}
