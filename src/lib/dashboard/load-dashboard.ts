import "server-only";

import { DateTime } from "luxon";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/lib/api-auth";
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientAccessWhere,
  buildDocumentAccessWhere,
  buildInvoiceAccessWhere,
  buildPaymentAccessWhere,
  buildTaskAccessWhere,
} from "@/lib/access-control";
import { canReadFinance } from "@/lib/permissions";
import { buildVisibleActivityWhere } from "@/lib/activity-query";
import { getTenantBillingLimits } from "@/lib/billing-limits";
import { getTenantAccessCached } from "@/lib/tenant-access-server";
import { daysLeftUntil, isTrialEndingSoon } from "@/lib/tenant-access";
import {
  agingBuckets,
  buildAgenda,
  casesByCourtLevel,
  lastMonthKeys,
  monthlyTotals,
  percentChange,
} from "@/lib/dashboard/aggregates";
import type {
  CaseStatusKey,
  DashboardAccount,
  DashboardData,
  SubscriptionAlert,
} from "@/lib/dashboard/types";

// Everything the main dashboard shows, in one round of parallel queries.
// Every query goes through the access-control builders, so it is scoped
// to the user's office and, below ADMIN, to the cases they work on.

const OPEN_INVOICE_STATUSES = ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] as const;
const OPEN_TASK: Prisma.TaskWhereInput = {
  completed: false,
  status: { notIn: ["COMPLETED", "CANCELLED"] },
};
const ACTIVE_CASE_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

export const DASHBOARD_LIMITS = {
  agenda: 6,
  tasks: 6,
  recentCases: 6,
  recentDocuments: 6,
  activities: 8,
  financeMonths: 6,
  staleCaseDays: 30,
} as const;

const CASE_REF = { select: { id: true, publicId: true, title: true, caseNumber: true } } as const;
const CLIENT_REF = { select: { id: true, publicId: true, name: true } } as const;

export async function loadDashboard(
  user: AuthenticatedUser,
  timeZone: string,
  nowDate: Date = new Date(),
): Promise<DashboardData> {
  const canViewFinance = canReadFinance(user.role);
  const isAdmin = user.role === "ADMIN";

  const now = DateTime.fromJSDate(nowDate).setZone(timeZone);
  const todayStart = now.startOf("day").toJSDate();
  const tomorrowStart = now.plus({ days: 1 }).startOf("day").toJSDate();
  const weekEnd = now.plus({ days: 7 }).startOf("day").toJSDate();
  const in48h = now.plus({ hours: 48 }).toJSDate();
  const monthStart = now.startOf("month").toJSDate();
  const nextMonthStart = now.plus({ months: 1 }).startOf("month").toJSDate();
  const lastMonthStart = now.minus({ months: 1 }).startOf("month").toJSDate();
  const financeStart = now
    .minus({ months: DASHBOARD_LIMITS.financeMonths - 1 })
    .startOf("month")
    .toJSDate();
  const staleBefore = now.minus({ days: DASHBOARD_LIMITS.staleCaseDays }).toJSDate();

  const finance = <T, F>(query: () => Promise<T>, fallback: F) =>
    canViewFinance ? query() : Promise.resolve(fallback);

  const [
    totalClients,
    newClientsThisMonth,
    activeCases,
    statusGroups,
    courtGroups,
    staleCases,
    recentCases,
    agendaAppointments,
    agendaTasks,
    sessionsThisWeek,
    sessionsWithin48h,
    todayAppointments,
    overdueTasks,
    dueTodayTasks,
    upcomingTasks,
    openInvoices,
    openInvoicePaidGroups,
    collectedThisMonth,
    collectedLastMonth,
    financeInvoices,
    financePayments,
    recentDocuments,
    recentActivities,
    accountInfo,
  ] = await Promise.all([
    prisma.client.count({ where: buildClientAccessWhere(user, { archivedAt: null }) }),

    prisma.client.count({
      where: buildClientAccessWhere(user, {
        archivedAt: null,
        createdAt: { gte: monthStart, lt: nextMonthStart },
      }),
    }),

    prisma.case.count({
      where: buildCaseAccessWhere(user, {
        status: { in: [...ACTIVE_CASE_STATUSES] },
        client: { archivedAt: null },
      }),
    }),

    prisma.case.groupBy({
      by: ["status"],
      where: buildCaseAccessWhere(user),
      _count: { _all: true },
    }),

    prisma.case.groupBy({
      by: ["court"],
      where: buildCaseAccessWhere(user, { status: { not: "ARCHIVED" } }),
      _count: { _all: true },
    }),

    // Open cases nobody has touched in 30 days.
    prisma.case.count({
      where: buildCaseAccessWhere(user, {
        status: { in: [...ACTIVE_CASE_STATUSES] },
        client: { archivedAt: null },
        updatedAt: { lt: staleBefore },
      }),
    }),

    prisma.case.findMany({
      where: buildCaseAccessWhere(user, { client: { archivedAt: null } }),
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: DASHBOARD_LIMITS.recentCases,
      select: {
        id: true,
        publicId: true,
        title: true,
        caseNumber: true,
        status: true,
        updatedAt: true,
        client: CLIENT_REF,
      },
    }),

    prisma.appointment.findMany({
      where: buildAppointmentAccessWhere(user, {
        status: "SCHEDULED",
        startTime: { gte: nowDate, lt: weekEnd },
      }),
      orderBy: { startTime: "asc" },
      take: 40,
      select: {
        id: true,
        title: true,
        type: true,
        startTime: true,
        location: true,
        case: CASE_REF,
        client: CLIENT_REF,
      },
    }),

    prisma.task.findMany({
      where: buildTaskAccessWhere(user, {
        ...OPEN_TASK,
        dueDate: { gte: todayStart, lt: weekEnd },
      }),
      orderBy: { dueDate: "asc" },
      take: 20,
      select: { id: true, title: true, dueDate: true, case: CASE_REF, client: CLIENT_REF },
    }),

    prisma.appointment.count({
      where: buildAppointmentAccessWhere(user, {
        type: "COURT_SESSION",
        status: { not: "CANCELLED" },
        startTime: { gte: todayStart, lt: weekEnd },
      }),
    }),

    prisma.appointment.count({
      where: buildAppointmentAccessWhere(user, {
        type: "COURT_SESSION",
        status: "SCHEDULED",
        startTime: { gte: nowDate, lt: in48h },
      }),
    }),

    prisma.appointment.count({
      where: buildAppointmentAccessWhere(user, {
        status: { not: "CANCELLED" },
        startTime: { gte: todayStart, lt: tomorrowStart },
      }),
    }),

    prisma.task.count({
      where: buildTaskAccessWhere(user, { ...OPEN_TASK, dueDate: { lt: todayStart } }),
    }),

    prisma.task.count({
      where: buildTaskAccessWhere(user, {
        ...OPEN_TASK,
        dueDate: { gte: todayStart, lt: tomorrowStart },
      }),
    }),

    // Overdue first (earliest due date), then what is coming up.
    prisma.task.findMany({
      where: buildTaskAccessWhere(user, { ...OPEN_TASK, dueDate: { not: null } }),
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: DASHBOARD_LIMITS.tasks,
      select: { id: true, title: true, dueDate: true, priority: true, case: CASE_REF },
    }),

    finance(
      () =>
        prisma.invoice.findMany({
          where: buildInvoiceAccessWhere(user, { status: { in: [...OPEN_INVOICE_STATUSES] } }),
          select: { id: true, status: true, issueDate: true, dueDate: true, total: true },
        }),
      [],
    ),

    finance(
      () =>
        prisma.payment.groupBy({
          by: ["invoiceId"],
          where: buildPaymentAccessWhere(user, {
            status: "PAID",
            invoiceId: { not: null },
            invoice: {
              is: buildInvoiceAccessWhere(user, { status: { in: [...OPEN_INVOICE_STATUSES] } }),
            },
          }),
          _sum: { amount: true },
        }),
      [],
    ),

    finance(
      () =>
        prisma.payment.aggregate({
          where: buildPaymentAccessWhere(user, {
            status: "PAID",
            paidAt: { gte: monthStart, lt: nextMonthStart },
          }),
          _sum: { amount: true },
        }),
      null,
    ),

    finance(
      () =>
        prisma.payment.aggregate({
          where: buildPaymentAccessWhere(user, {
            status: "PAID",
            paidAt: { gte: lastMonthStart, lt: monthStart },
          }),
          _sum: { amount: true },
        }),
      null,
    ),

    finance(
      () =>
        prisma.invoice.findMany({
          where: buildInvoiceAccessWhere(user, {
            status: { notIn: ["DRAFT", "CANCELLED"] },
            issueDate: { gte: financeStart, lt: nextMonthStart },
          }),
          select: { issueDate: true, total: true },
        }),
      [],
    ),

    finance(
      () =>
        prisma.payment.findMany({
          where: buildPaymentAccessWhere(user, {
            status: "PAID",
            paidAt: { gte: financeStart, lt: nextMonthStart },
          }),
          select: { paidAt: true, amount: true },
        }),
      [],
    ),

    prisma.document.findMany({
      where: buildDocumentAccessWhere(user),
      orderBy: { createdAt: "desc" },
      take: DASHBOARD_LIMITS.recentDocuments,
      select: { id: true, fileName: true, fileType: true, createdAt: true, case: CASE_REF },
    }),

    prisma.activity.findMany({
      where: buildVisibleActivityWhere(user, canViewFinance),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: DASHBOARD_LIMITS.activities,
      select: { id: true, type: true, title: true, message: true, createdAt: true },
    }),

    isAdmin ? loadAccount(user, nowDate) : Promise.resolve(null),
  ]);

  const paidByInvoice = new Map<string, number>();
  for (const group of openInvoicePaidGroups) {
    if (group.invoiceId) paidByInvoice.set(group.invoiceId, Number(group._sum.amount ?? 0));
  }

  const balances = openInvoices
    .map((invoice) => {
      const outstanding = Math.max(Number(invoice.total ?? 0) - (paidByInvoice.get(invoice.id) ?? 0), 0);
      // Due before today, not before now: an invoice due today is not late.
      const isOverdue =
        outstanding > 0 &&
        (invoice.status === "OVERDUE" ||
          Boolean(invoice.dueDate && invoice.dueDate.getTime() < todayStart.getTime()));
      return { issueDate: invoice.issueDate, outstanding, isOverdue };
    })
    .filter((invoice) => invoice.outstanding > 0);

  const overdueBalances = balances.filter((invoice) => invoice.isOverdue);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  const thisMonth = Number(collectedThisMonth?._sum.amount ?? 0);
  const lastMonth = Number(collectedLastMonth?._sum.amount ?? 0);

  const agenda = buildAgenda(
    agendaAppointments.map((item) => ({ ...item, type: String(item.type) })),
    agendaTasks,
    timeZone,
  );

  const caseStatusOrder: CaseStatusKey[] = ["OPEN", "IN_PROGRESS", "CLOSED", "ARCHIVED"];
  const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  const totalCases = sum([...statusCounts.values()]);

  return {
    timeZone,
    generatedAt: nowDate.toISOString(),
    role: user.role,
    permissions: { canViewFinance, canManageBilling: isAdmin && !user.isDemo },

    kpis: {
      activeCases,
      totalCases,
      sessionsThisWeek,
      todayAppointments,
      overdueTasks,
      dueTodayTasks,
      newClientsThisMonth,
      totalClients,
      outstanding: canViewFinance ? sum(balances.map((item) => item.outstanding)) : null,
      collectedThisMonth: canViewFinance ? thisMonth : null,
      collectedChangePct: canViewFinance ? percentChange(thisMonth, lastMonth) : null,
    },

    attention: {
      overdueInvoices: canViewFinance
        ? { count: overdueBalances.length, amount: sum(overdueBalances.map((item) => item.outstanding)) }
        : null,
      overdueTasks,
      sessionsWithin48h,
      staleCases,
      subscription: accountInfo?.alert ?? null,
    },

    agenda: agenda.slice(0, DASHBOARD_LIMITS.agenda),
    agendaTotal: agenda.length,
    upcomingTasks: upcomingTasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate!.toISOString(),
      priority: task.priority,
      case: task.case,
    })),

    finance: canViewFinance
      ? {
          months: monthlyTotals(
            lastMonthKeys(nowDate, timeZone, DASHBOARD_LIMITS.financeMonths),
            financeInvoices.map((item) => ({ issueDate: item.issueDate, total: Number(item.total) })),
            financePayments.map((item) => ({ paidAt: item.paidAt, amount: Number(item.amount) })),
            timeZone,
          ),
          aging: agingBuckets(balances, nowDate),
        }
      : null,

    casesByStatus: caseStatusOrder
      .map((status) => ({ status, count: statusCounts.get(status) ?? 0 }))
      .filter((item) => item.count > 0),
    casesByCourt: casesByCourtLevel(
      courtGroups.map((group) => ({ court: group.court, count: group._count._all })),
    ),

    recentCases: recentCases.map((item) => ({
      id: item.id,
      publicId: item.publicId,
      title: item.title,
      caseNumber: item.caseNumber,
      status: item.status,
      updatedAt: item.updatedAt.toISOString(),
      client: item.client,
    })),

    recentDocuments: recentDocuments.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      fileType: item.fileType,
      createdAt: item.createdAt.toISOString(),
      case: item.case,
    })),

    recentActivities: recentActivities.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),

    account: accountInfo?.account ?? null,
  };
}

/** Plan, usage against its limits, and a renewal or trial warning (ADMIN). */
async function loadAccount(
  user: AuthenticatedUser,
  now: Date,
): Promise<{ account: DashboardAccount; alert: SubscriptionAlert | null }> {
  // A demo sandbox runs on its owner's office plan (billingTenantId) but
  // counts its own records (tenantId).
  const [billing, access, activeUsers, teamMembers, pendingInvitations, storage, clients, cases] =
    await Promise.all([
      getTenantBillingLimits(user.billingTenantId),
      getTenantAccessCached(user.billingTenantId),
      prisma.user.count({ where: { tenantId: user.tenantId, isActive: true } }),
      prisma.user.count({ where: { tenantId: user.tenantId } }),
      prisma.teamInvitation.count({
        where: { tenantId: user.tenantId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      }),
      prisma.document.aggregate({ where: { tenantId: user.tenantId }, _sum: { fileSize: true } }),
      prisma.client.count({ where: { tenantId: user.tenantId, archivedAt: null } }),
      prisma.case.count({ where: { tenantId: user.tenantId } }),
    ]);

  const subscription = access.subscriptionId
    ? await prisma.subscription.findUnique({
        where: { id: access.subscriptionId },
        select: { currentPeriodEnd: true, cancelAtPeriodEnd: true },
      })
    : null;

  const periodEndsAt =
    access.state === "TRIAL" ? access.trialEndsAt : subscription?.currentPeriodEnd ?? null;

  let alert: SubscriptionAlert | null = null;
  if (isTrialEndingSoon(access)) {
    alert = { kind: "TRIAL_ENDING", daysLeft: access.trialDaysLeft };
  } else if (access.paymentFailed) {
    alert = {
      kind: "PAYMENT_FAILED",
      daysLeft: access.pastDueLocksAt ? daysLeftUntil(access.pastDueLocksAt, now) : null,
    };
  } else if (subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    const daysLeft = daysLeftUntil(subscription.currentPeriodEnd, now);
    if (daysLeft <= 14) alert = { kind: "CANCELLING", daysLeft };
  }

  return {
    alert,
    account: {
      planName: billing.plan.name,
      status: access.state === "TRIAL" ? "TRIALING" : billing.subscriptionStatus,
      trialDaysLeft: access.state === "TRIAL" ? access.trialDaysLeft : null,
      periodEndsAt: periodEndsAt?.toISOString() ?? null,
      users: { used: activeUsers, limit: billing.limits.users },
      storageMb: {
        used: Math.round(((storage._sum.fileSize ?? 0) / (1024 * 1024)) * 10) / 10,
        limit: billing.limits.storageMb,
      },
      clients: { used: clients, limit: billing.limits.clients },
      cases: { used: cases, limit: billing.limits.cases },
      teamMembers,
      pendingInvitations,
    },
  };
}
