import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { ok, err } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientAccessWhere,
  buildInvoiceAccessWhere,
  buildPaymentAccessWhere,
  buildTaskAccessWhere,
} from "@/lib/access-control";
import {
  buildMonthlyRevenue,
  calculateInvoiceFinancialSummary,
  getInvoicePaidAmount,
  getInvoiceRemainingAmount,
  getReportPeriod,
  isInvoiceOverdue,
  normalizeReportTimeZone,
} from "@/lib/report-finance";
import { roundMoney } from "@/lib/finance";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  REPORT_EXPORT_LIMIT,
  REPORT_SUMMARY_SCAN_LIMIT,
  exceedsReportLimit,
  getReportDetailQueryLimit,
} from "@/lib/report-limits";
import {
  assertTenantCanWrite,
  assertTenantHasFeature,
} from "@/lib/billing-limits";

type ReportType = "monthly" | "yearly";
type CaseStatus = "OPEN" | "IN_PROGRESS" | "CLOSED" | "ARCHIVED";
type PaymentStatus = "PAID" | "PENDING" | "OVERDUE" | "CANCELLED";
type InvoiceStatus =
  | "DRAFT"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

const caseStatuses = ["OPEN", "IN_PROGRESS", "CLOSED", "ARCHIVED"] as const;
const paymentStatuses = ["PAID", "PENDING", "OVERDUE", "CANCELLED"] as const;
const invoiceStatuses = [
  "DRAFT",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

function parseReportParams(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const timeZone = normalizeReportTimeZone(sp.get("tz"));
  const nowInZone = DateTime.now().setZone(timeZone);

  const type = (sp.get("type") || "yearly") as ReportType;
  const year = Number(sp.get("year") || nowInZone.year);
  const month = Number(sp.get("month") || nowInZone.month - 1);
  const caseStatus = sp.get("caseStatus") || "";
  const paymentStatus = sp.get("paymentStatus") || "";
  const invoiceStatus = sp.get("invoiceStatus") || "";
  const clientId = sp.get("clientId") || "";
  const detailMode = sp.get("details") === "all" ? "all" : "preview";

  if (!["monthly", "yearly"].includes(type)) {
    return { error: "نوع التقرير غير صالح" } as const;
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "السنة غير صالحة" } as const;
  }

  if (type === "monthly" && (!Number.isInteger(month) || month < 0 || month > 11)) {
    return { error: "الشهر غير صالح" } as const;
  }

  if (caseStatus && !caseStatuses.includes(caseStatus as CaseStatus)) {
    return { error: "حالة القضية غير صالحة" } as const;
  }

  if (paymentStatus && !paymentStatuses.includes(paymentStatus as PaymentStatus)) {
    return { error: "حالة الدفعة غير صالحة" } as const;
  }

  if (invoiceStatus && !invoiceStatuses.includes(invoiceStatus as InvoiceStatus)) {
    return { error: "حالة الفاتورة غير صالحة" } as const;
  }

  const period = getReportPeriod({ type, year, month, timeZone });
  const yearPeriod = getReportPeriod({
    type: "yearly",
    year,
    month: 0,
    timeZone,
  });

  return {
    type,
    year,
    month,
    start: period.start,
    end: period.end,
    yearStart: yearPeriod.start,
    yearEnd: yearPeriod.end,
    timeZone: period.timeZone,
    caseStatus,
    paymentStatus,
    invoiceStatus,
    clientId,
    detailMode,
  } as const;
}

function paymentPeriodWhere(params: {
  start: Date;
  end: Date;
  paymentStatus: string;
}): Prisma.PaymentWhereInput {
  const range = { gte: params.start, lt: params.end };

  if (params.paymentStatus === "PAID") {
    return { status: "PAID", paidAt: range };
  }

  if (params.paymentStatus) {
    return {
      status: params.paymentStatus as PaymentStatus,
      createdAt: range,
    };
  }

  return {
    OR: [
      { status: "PAID", paidAt: range },
      { status: { not: "PAID" }, createdAt: range },
    ],
  };
}

function invoiceStatusWhere(
  status: string,
  now: Date,
): Prisma.InvoiceWhereInput {
  if (!status) return {};

  if (status === "OVERDUE") {
    return {
      OR: [
        { status: "OVERDUE" },
        {
          status: { in: ["UNPAID", "PARTIALLY_PAID"] },
          dueDate: { lt: now },
        },
      ],
    };
  }

  return { status: status as InvoiceStatus };
}

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER"]);
    if (auth.error || !auth.user) return auth.error;

    const reportAccess = await assertTenantHasFeature(
      auth.user.tenantId,
      "advancedReports",
    );

    if (!reportAccess.ok) {
      return err(reportAccess.message, reportAccess.status, {
        code: "PLAN_FEATURE_UNAVAILABLE",
        feature: "advancedReports",
      });
    }

    const reportRateLimit = await checkRateLimit(
      `${auth.user.tenantId}:${auth.user.userId}`,
      {
        windowMs: 60_000,
        max: 30,
        keyPrefix: "reports-summary",
      },
    );

    if (!reportRateLimit.allowed) {
      return err("طلبات التقارير كثيرة جدًا. حاول مرة أخرى بعد دقيقة.", 429);
    }

    const params = parseReportParams(req);
    if ("error" in params) {
      return err(params.error || "بيانات التقرير غير صالحة", 400);
    }

    if (params.detailMode === "all") {
      const [exportAccess, writeAccess] = await Promise.all([
        assertTenantHasFeature(auth.user.tenantId, "fullExport"),
        assertTenantCanWrite(auth.user.tenantId, "تصدير التقرير الكامل"),
      ]);

      if (!exportAccess.ok) {
        return err(exportAccess.message, exportAccess.status, {
          code: "PLAN_FEATURE_UNAVAILABLE",
          feature: "fullExport",
        });
      }

      if (!writeAccess.ok) {
        return err(writeAccess.message, writeAccess.status, {
          code: "SUBSCRIPTION_INACTIVE",
        });
      }
    }

    const now = new Date();
    const clients = await prisma.client.findMany({
      where: buildClientAccessWhere(auth.user),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    if (params.clientId && !clients.some((client) => client.id === params.clientId)) {
      return err("الموكل غير موجود داخل هذا المكتب", 404);
    }

    const cases = await prisma.case.findMany({
      where: buildCaseAccessWhere(auth.user, {
        ...(params.clientId ? { clientId: params.clientId } : {}),
        ...(params.caseStatus ? { status: params.caseStatus as CaseStatus } : {}),
      }),
      select: {
        id: true,
        title: true,
        status: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: REPORT_SUMMARY_SCAN_LIMIT + 1,
    });

    if (exceedsReportLimit(cases.length, REPORT_SUMMARY_SCAN_LIMIT)) {
      return err(
        "عدد القضايا أكبر من الحد الآمن للتقرير. استخدم فلتر موكل أو حالة قضية.",
        413,
      );
    }

    const caseIds = cases.map((item) => item.id);
    const relationScope: {
      clientId?: string;
      caseId?: { in: string[] };
    } = {
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.caseStatus ? { caseId: { in: caseIds } } : {}),
    };

    const paymentBaseWhere: Prisma.PaymentWhereInput = relationScope;
    const invoiceBaseWhere: Prisma.InvoiceWhereInput = relationScope;
    const appointmentBaseWhere: Prisma.AppointmentWhereInput = relationScope;
    const taskBaseWhere: Prisma.TaskWhereInput = relationScope;

    const periodPaymentWhere = buildPaymentAccessWhere(auth.user, {
      AND: [paymentBaseWhere, paymentPeriodWhere(params)],
    });

    const periodInvoiceWhere = buildInvoiceAccessWhere(auth.user, {
      AND: [
        invoiceBaseWhere,
        { issueDate: { gte: params.start, lt: params.end } },
        invoiceStatusWhere(params.invoiceStatus, now),
      ],
    });

    const allInvoiceWhere = buildInvoiceAccessWhere(auth.user, invoiceBaseWhere);
    const upcomingStart = new Date(Math.max(now.getTime(), params.start.getTime()));
    const overdueEnd = new Date(Math.min(now.getTime(), params.end.getTime()));

    const upcomingAppointmentWhere = buildAppointmentAccessWhere(auth.user, {
      ...appointmentBaseWhere,
      status: { not: "CANCELLED" },
      startTime: { gte: upcomingStart, lt: params.end },
    });

    const overdueTaskWhere = buildTaskAccessWhere(auth.user, {
      ...taskBaseWhere,
      completed: false,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      dueDate: { gte: params.start, lt: overdueEnd },
    });

    const periodRevenuePromise =
      params.paymentStatus && params.paymentStatus !== "PAID"
        ? Promise.resolve({ _sum: { amount: null as number | null } })
        : prisma.payment.aggregate({
            where: buildPaymentAccessWhere(auth.user, {
              ...paymentBaseWhere,
              status: "PAID",
              paidAt: { gte: params.start, lt: params.end },
            }),
            _sum: { amount: true },
          });

    const detailQueryLimit = getReportDetailQueryLimit(params.detailMode);

    const [
      periodPaymentsRaw,
      periodPaymentCount,
      periodRevenueAggregate,
      allPaidAggregate,
      pendingPaymentsAggregate,
      periodInvoicesRaw,
      periodInvoiceCount,
      allInvoices,
      upcomingAppointments,
      upcomingAppointmentsCount,
      overdueTasks,
      overdueTasksCount,
      yearlyPaidPayments,
      paymentClientGroups,
      invoiceClientGroups,
    ] = await Promise.all([
      prisma.payment.findMany({
        where: periodPaymentWhere,
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          paidAt: true,
          createdAt: true,
          notes: true,
          client: { select: { id: true, name: true } },
          case: { select: { id: true, title: true } },
        },
        orderBy:
          params.paymentStatus === "PAID"
            ? [{ paidAt: "desc" }, { createdAt: "desc" }]
            : { createdAt: "desc" },
        take: detailQueryLimit,
      }),
      prisma.payment.count({ where: periodPaymentWhere }),
      periodRevenuePromise,
      prisma.payment.aggregate({
        where: buildPaymentAccessWhere(auth.user, {
          ...paymentBaseWhere,
          status: "PAID",
        }),
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: buildPaymentAccessWhere(auth.user, {
          ...paymentBaseWhere,
          status: { in: ["PENDING", "OVERDUE"] },
        }),
        _sum: { amount: true },
      }),
      prisma.invoice.findMany({
        where: periodInvoiceWhere,
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          issueDate: true,
          dueDate: true,
          client: { select: { id: true, name: true } },
          case: { select: { id: true, title: true } },
          payments: {
            where: { status: "PAID" },
            select: { amount: true },
          },
        },
        orderBy: { issueDate: "desc" },
        take: detailQueryLimit,
      }),
      prisma.invoice.count({ where: periodInvoiceWhere }),
      prisma.invoice.findMany({
        where: allInvoiceWhere,
        select: {
          total: true,
          status: true,
          dueDate: true,
          payments: {
            where: { status: "PAID" },
            select: { amount: true },
          },
        },
        take: REPORT_SUMMARY_SCAN_LIMIT + 1,
      }),
      prisma.appointment.findMany({
        where: upcomingAppointmentWhere,
        select: {
          id: true,
          title: true,
          startTime: true,
          location: true,
          case: { select: { id: true, title: true } },
        },
        orderBy: { startTime: "asc" },
        take: 10,
      }),
      prisma.appointment.count({ where: upcomingAppointmentWhere }),
      prisma.task.findMany({
        where: overdueTaskWhere,
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          case: { select: { id: true, title: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
      prisma.task.count({ where: overdueTaskWhere }),
      prisma.payment.findMany({
        where: buildPaymentAccessWhere(auth.user, {
          ...paymentBaseWhere,
          status: "PAID",
          paidAt: { gte: params.yearStart, lt: params.yearEnd },
        }),
        select: { amount: true, paidAt: true },
        take: REPORT_SUMMARY_SCAN_LIMIT + 1,
      }),
      prisma.payment.groupBy({
        by: ["clientId"],
        where: periodPaymentWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.groupBy({
        by: ["clientId"],
        where: periodInvoiceWhere,
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);

    if (
      params.detailMode === "all" &&
      (exceedsReportLimit(periodPaymentsRaw.length, REPORT_EXPORT_LIMIT) ||
        exceedsReportLimit(periodInvoicesRaw.length, REPORT_EXPORT_LIMIT))
    ) {
      return err(
        `حجم التصدير يتجاوز الحد الآمن (${REPORT_EXPORT_LIMIT} سجل لكل قسم). ضيّق الفلاتر أو استخدم تقريرًا شهريًا.`,
        413,
        {
          limit: REPORT_EXPORT_LIMIT,
          payments: periodPaymentCount,
          invoices: periodInvoiceCount,
        },
      );
    }

    if (
      exceedsReportLimit(allInvoices.length, REPORT_SUMMARY_SCAN_LIMIT) ||
      exceedsReportLimit(yearlyPaidPayments.length, REPORT_SUMMARY_SCAN_LIMIT)
    ) {
      return err(
        "حجم البيانات المالية أكبر من الحد الآمن للتقرير. استخدم فلتر موكل أو حالة قضية لتضييق النتائج.",
        413,
      );
    }

    const periodPayments = periodPaymentsRaw.map((payment) => ({
      ...payment,
      reportDate: payment.status === "PAID" ? payment.paidAt : payment.createdAt,
    }));

    const periodInvoices = periodInvoicesRaw.map((invoice) => ({
      ...invoice,
      paidAmount: getInvoicePaidAmount(invoice),
      remainingAmount: getInvoiceRemainingAmount(invoice),
      isOverdue: isInvoiceOverdue(invoice, now),
      payments: undefined,
    }));

    const invoiceSummary = calculateInvoiceFinancialSummary(allInvoices, now);
    const monthlyRevenue = buildMonthlyRevenue(
      yearlyPaidPayments,
      params.year,
      params.timeZone,
    );

    const caseStatus = {
      OPEN: 0,
      IN_PROGRESS: 0,
      CLOSED: 0,
      ARCHIVED: 0,
    };

    const clientMap = new Map(clients.map((client) => [client.id, client]));
    const topClientMap = new Map<
      string,
      {
        id: string;
        name: string;
        casesCount: number;
        paymentsTotal: number;
        invoicesTotal: number;
        activityScore: number;
      }
    >();

    const ensureTopClient = (clientId: string) => {
      const client = clientMap.get(clientId);
      if (!client) return null;

      if (!topClientMap.has(clientId)) {
        topClientMap.set(clientId, {
          id: client.id,
          name: client.name,
          casesCount: 0,
          paymentsTotal: 0,
          invoicesTotal: 0,
          activityScore: 0,
        });
      }

      return topClientMap.get(clientId)!;
    };

    for (const item of cases) {
      caseStatus[item.status as keyof typeof caseStatus] += 1;
      const client = ensureTopClient(item.client.id);
      if (client) {
        client.casesCount += 1;
        client.activityScore += 3;
      }
    }

    for (const group of paymentClientGroups) {
      const client = ensureTopClient(group.clientId);
      if (!client) continue;

      client.paymentsTotal = roundMoney(Number(group._sum.amount || 0));
      client.activityScore += group._count._all * 2;
    }

    for (const group of invoiceClientGroups) {
      const client = ensureTopClient(group.clientId);
      if (!client) continue;

      client.invoicesTotal = roundMoney(Number(group._sum.total || 0));
      client.activityScore += group._count._all;
    }

    const topClients = Array.from(topClientMap.values())
      .map((client) => ({
        ...client,
        activityScore: roundMoney(
          client.activityScore +
            client.paymentsTotal / 1000 +
            client.invoicesTotal / 2000,
        ),
      }))
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 5);

    const totalCases = cases.length;
    const openCases = caseStatus.OPEN + caseStatus.IN_PROGRESS;
    const closedCases = caseStatus.CLOSED + caseStatus.ARCHIVED;

    return ok({
      filters: {
        type: params.type,
        year: params.year,
        month: params.month,
        timeZone: params.timeZone,
        caseStatus: params.caseStatus,
        paymentStatus: params.paymentStatus,
        invoiceStatus: params.invoiceStatus,
        clientId: params.clientId,
      },
      clients,
      summary: {
        periodRevenue: roundMoney(Number(periodRevenueAggregate._sum.amount || 0)),
        totalPaidAll: roundMoney(Number(allPaidAggregate._sum.amount || 0)),
        pendingPaymentsAmount: roundMoney(
          Number(pendingPaymentsAggregate._sum.amount || 0),
        ),
        ...invoiceSummary,
        totalCases,
        openCases,
        closedCases,
        upcomingAppointmentsCount,
        overdueTasksCount,
      },
      caseStatus,
      topClients,
      monthlyRevenue,
      detailMode: params.detailMode,
      detailCounts: {
        payments: periodPaymentCount,
        invoices: periodInvoiceCount,
      },
      periodPayments,
      periodInvoices,
      upcomingAppointments,
      overdueTasks,
    });
  });
}
