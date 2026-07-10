import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";

const DEFAULT_TIME_ZONE = "Asia/Amman";

const OPEN_INVOICE_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "OVERDUE",
] as const;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const auth = await requireRole(req, ["ADMIN", "LAWYER", "STAFF"]);
    if (auth.error || !auth.user) return auth.error;

    const tenantId = auth.user.tenantId;

    /*
     * نستخدم توقيت جهاز المستخدم عند إرساله من الواجهة.
     * إذا كانت القيمة غير صالحة، نرجع إلى توقيت الأردن.
     */
    const requestedTimeZone =
      req.nextUrl.searchParams.get("tz") || DEFAULT_TIME_ZONE;

    const requestedDateTime =
      DateTime.now().setZone(requestedTimeZone);

    const timeZone = requestedDateTime.isValid
      ? requestedTimeZone
      : DEFAULT_TIME_ZONE;

    const nowInZone = DateTime.now().setZone(timeZone);

    const now = nowInZone.toUTC().toJSDate();
    const todayStart = nowInZone.startOf("day").toUTC().toJSDate();
    const tomorrowStart = nowInZone
      .plus({ days: 1 })
      .startOf("day")
      .toUTC()
      .toJSDate();

    const weekEnd = nowInZone
      .plus({ days: 7 })
      .endOf("day")
      .toUTC()
      .toJSDate();

    const monthStart = nowInZone.startOf("month").toUTC().toJSDate();
    const nextMonthStart = nowInZone
      .plus({ months: 1 })
      .startOf("month")
      .toUTC()
      .toJSDate();

    const [
      clientCount,
      activeCaseCount,
      totalCasesCount,
      closedCasesCount,
      todayAppts,
      upcomingAppointments,
      totalRevenueAggregate,
      monthlyRevenueAggregate,
      newClientsThisMonth,
      overdueTasksCount,
      dueTodayTasksCount,
      upcomingTasks,
      openInvoices,
    ] = await Promise.all([
      /*
       * الموكلون غير المؤرشفين فقط.
       */
      prisma.client.count({
        where: {
          tenantId,
          archivedAt: null,
        },
      }),

      prisma.case.count({
        where: {
          tenantId,
          status: {
            in: ["OPEN", "IN_PROGRESS"],
          },
        },
      }),

      prisma.case.count({
        where: {
          tenantId,
        },
      }),

      prisma.case.count({
        where: {
          tenantId,
          status: "CLOSED",
        },
      }),

      /*
       * جميع مواعيد اليوم ما عدا الملغاة.
       */
      prisma.appointment.findMany({
        where: {
          tenantId,
          status: {
            not: "CANCELLED",
          },
          startTime: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        orderBy: {
          startTime: "asc",
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          location: true,
          type: true,
          status: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
        },
      }),

      /*
       * أقرب خمسة مواعيد خلال الأيام السبعة القادمة.
       */
      prisma.appointment.findMany({
        where: {
          tenantId,
          status: "SCHEDULED",
          startTime: {
            gte: now,
            lte: weekEnd,
          },
        },
        orderBy: {
          startTime: "asc",
        },
        take: 5,
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          location: true,
          type: true,
          status: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
        },
      }),

      /*
       * إجمالي الدفعات المحصلة.
       */
      prisma.payment.aggregate({
        where: {
          tenantId,
          status: "PAID",
        },
        _sum: {
          amount: true,
        },
      }),

      /*
       * الدفعات المحصلة خلال الشهر الحالي.
       */
      prisma.payment.aggregate({
        where: {
          tenantId,
          status: "PAID",
          paidAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.client.count({
        where: {
          tenantId,
          archivedAt: null,
          createdAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
      }),

      /*
       * المهام المتأخرة: غير مكتملة وتاريخها قبل اليوم.
       */
      prisma.task.count({
        where: {
          tenantId,
          completed: false,
          dueDate: {
            lt: todayStart,
          },
        },
      }),

      /*
       * المهام المستحقة خلال اليوم الحالي فقط.
       */
      prisma.task.count({
        where: {
          tenantId,
          completed: false,
          dueDate: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
      }),

      /*
       * أقرب المهام، ويشمل المتأخر منها حتى يظهر أولًا.
       */
      prisma.task.findMany({
        where: {
          tenantId,
          completed: false,
          dueDate: {
            not: null,
          },
        },
        orderBy: {
          dueDate: "asc",
        },
        take: 5,
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          priority: true,
          completed: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
        },
      }),

      /*
       * الفواتير التي لا تزال قابلة للتحصيل.
       * نقرأ دفعاتها المدفوعة لحساب الرصيد الحقيقي المتبقي.
       */
      prisma.invoice.findMany({
        where: {
          tenantId,
          status: {
            in: [...OPEN_INVOICE_STATUSES],
          },
        },
        orderBy: [
          {
            dueDate: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          issueDate: true,
          dueDate: true,
          total: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
            },
          },
          payments: {
            where: {
              status: "PAID",
            },
            select: {
              amount: true,
            },
          },
        },
      }),
    ]);

    /*
     * نحسب رصيد كل فاتورة:
     * إجمالي الفاتورة - الدفعات المدفوعة.
     */
    const invoiceBalances = openInvoices.map((invoice) => {
      const paidAmount = invoice.payments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0,
      );

      const outstandingAmount = Math.max(
        Number(invoice.total || 0) - paidAmount,
        0,
      );

      /*
       * dueDate قبل بداية اليوم، وليس قبل اللحظة الحالية،
       * حتى لا تعتبر فاتورة مستحقة اليوم متأخرة.
       */
      const isOverdue =
        outstandingAmount > 0 &&
        (invoice.status === "OVERDUE" ||
          Boolean(
            invoice.dueDate &&
              invoice.dueDate.getTime() < todayStart.getTime(),
          ));

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        total: Number(invoice.total || 0),
        paidAmount,
        outstandingAmount,
        isOverdue,
        client: invoice.client,
        case: invoice.case,
      };
    });

    const unpaidInvoices = invoiceBalances.filter(
      (invoice) => invoice.outstandingAmount > 0,
    );

    const overdueInvoices = unpaidInvoices.filter(
      (invoice) => invoice.isOverdue,
    );

    const pendingAmount = unpaidInvoices.reduce(
      (sum, invoice) => sum + invoice.outstandingAmount,
      0,
    );

    const overdueAmount = overdueInvoices.reduce(
      (sum, invoice) => sum + invoice.outstandingAmount,
      0,
    );

    const totalRevenue = Number(
      totalRevenueAggregate._sum.amount || 0,
    );

    const monthlyRevenue = Number(
      monthlyRevenueAggregate._sum.amount || 0,
    );

    const closedCaseRate =
      totalCasesCount > 0
        ? Math.round((closedCasesCount / totalCasesCount) * 100)
        : 0;

    const dueTasksCount =
      overdueTasksCount + dueTodayTasksCount;

    return ok({
      timeZone,

      clientCount,
      activeCaseCount,
      totalCasesCount,
      closedCasesCount,
      closedCaseRate,
      newClientsThisMonth,

      todayApptCount: todayAppts.length,
      todayAppts,
      upcomingAppointments,

      overdueTasksCount,
      dueTodayTasksCount,
      dueTasksCount,
      upcomingTasks,

      totalRevenue,
      monthlyRevenue,

      /*
       * المستحقات الحقيقية من الفواتير.
       */
      pendingAmount,
      overdueAmount,
      unpaidInvoicesCount: unpaidInvoices.length,
      overdueInvoicesCount: overdueInvoices.length,

      /*
       * نرسل أول خمس فواتير متأخرة لقسم "يحتاج انتباهك".
       */
      overdueInvoices: overdueInvoices.slice(0, 5),
    });
  });
}