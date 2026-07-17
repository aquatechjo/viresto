import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api-handler";
import { requireRole } from "@/lib/api-auth";
import { ok } from "@/lib/api-response";
import {
  buildAppointmentAccessWhere,
  buildCaseAccessWhere,
  buildClientAccessWhere,
  buildInvoiceAccessWhere,
  buildPaymentAccessWhere,
  buildTaskAccessWhere,
} from "@/lib/access-control";
import { canReadFinance } from "@/lib/permissions";

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

    const canViewFinance = canReadFinance(auth.user.role);

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
      archivedCasesCount,
      resolvedCasesCount,
      todayAppts,
      upcomingAppointments,
      totalRevenueAggregate,
      monthlyRevenueAggregate,
      newClientsThisMonth,
      overdueTasksCount,
      dueTodayTasksCount,
      upcomingTasks,
      openInvoices,
      openInvoicePaidGroups,
    ] = await Promise.all([
      /*
       * الموكلون غير المؤرشفين فقط.
       */
      prisma.client.count({
        where: buildClientAccessWhere(auth.user, {
          archivedAt: null,
        }),
      }),

      prisma.case.count({
        where: buildCaseAccessWhere(auth.user, {
          status: {
            in: ["OPEN", "IN_PROGRESS"],
          },
          client: {
            archivedAt: null,
          },
        }),
      }),

      prisma.case.count({
        where: buildCaseAccessWhere(auth.user),
      }),

      prisma.case.count({
        where: buildCaseAccessWhere(auth.user, {
          status: "CLOSED",
          client: {
            archivedAt: null,
          },
        }),
      }),

      prisma.case.count({
        where: buildCaseAccessWhere(auth.user, {
          OR: [
            { status: "ARCHIVED" },
            { client: { archivedAt: { not: null } } },
          ],
        }),
      }),

      prisma.case.count({
        where: buildCaseAccessWhere(auth.user, {
          status: {
            in: ["CLOSED", "ARCHIVED"],
          },
        }),
      }),

      /*
       * جميع مواعيد اليوم ما عدا الملغاة.
       */
      prisma.appointment.findMany({
        where: buildAppointmentAccessWhere(auth.user, {
          status: {
            not: "CANCELLED",
          },
          startTime: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        }),
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
        where: buildAppointmentAccessWhere(auth.user, {
          status: "SCHEDULED",
          startTime: {
            gte: now,
            lte: weekEnd,
          },
        }),
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
      canViewFinance
        ? prisma.payment.aggregate({
            where: buildPaymentAccessWhere(auth.user, {
              status: "PAID",
            }),
            _sum: {
              amount: true,
            },
          })
        : Promise.resolve({ _sum: { amount: null } }),

      /*
       * الدفعات المحصلة خلال الشهر الحالي.
       */
      canViewFinance
        ? prisma.payment.aggregate({
            where: buildPaymentAccessWhere(auth.user, {
              status: "PAID",
              paidAt: {
                gte: monthStart,
                lt: nextMonthStart,
              },
            }),
            _sum: {
              amount: true,
            },
          })
        : Promise.resolve({ _sum: { amount: null } }),

      prisma.client.count({
        where: buildClientAccessWhere(auth.user, {
          archivedAt: null,
          createdAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        }),
      }),

      /*
       * المهام المتأخرة: غير مكتملة وتاريخها قبل اليوم.
       */
      prisma.task.count({
        where: buildTaskAccessWhere(auth.user, {
          completed: false,
          status: {
            notIn: ["COMPLETED", "CANCELLED"],
          },
          dueDate: {
            lt: todayStart,
          },
        }),
      }),

      /*
       * المهام المستحقة خلال اليوم الحالي فقط.
       */
      prisma.task.count({
        where: buildTaskAccessWhere(auth.user, {
          completed: false,
          status: {
            notIn: ["COMPLETED", "CANCELLED"],
          },
          dueDate: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        }),
      }),

      /*
       * أقرب المهام، ويشمل المتأخر منها حتى يظهر أولًا.
       */
      prisma.task.findMany({
        where: buildTaskAccessWhere(auth.user, {
          completed: false,
          status: {
            notIn: ["COMPLETED", "CANCELLED"],
          },
          dueDate: {
            not: null,
          },
        }),
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
       * نجلب الحقول الحسابية فقط، ثم نجمع الدفعات باستعلام groupBy منفصل
       * حتى لا نحمّل كل سجلات الدفعات وعلاقات الفواتير إلى الذاكرة.
       */
      canViewFinance
        ? prisma.invoice.findMany({
            where: buildInvoiceAccessWhere(auth.user, {
              status: {
                in: [...OPEN_INVOICE_STATUSES],
              },
            }),
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
            },
          })
        : Promise.resolve([]),

      canViewFinance
        ? prisma.payment.groupBy({
            by: ["invoiceId"],
            where: buildPaymentAccessWhere(auth.user, {
              status: "PAID",
              invoiceId: { not: null },
              invoice: {
                is: buildInvoiceAccessWhere(auth.user, {
                  status: { in: [...OPEN_INVOICE_STATUSES] },
                }),
              },
            }),
            _sum: { amount: true },
          })
        : Promise.resolve([]),
    ]);

    const paidAmountByInvoice = new Map<string, number>();

    for (const group of openInvoicePaidGroups) {
      if (!group.invoiceId) continue;
      paidAmountByInvoice.set(
        group.invoiceId,
        Number(group._sum.amount || 0),
      );
    }

    /*
     * نحسب رصيد كل فاتورة:
     * إجمالي الفاتورة - الدفعات المدفوعة.
     */
    const invoiceBalances = openInvoices.map((invoice) => {
      const paidAmount = paidAmountByInvoice.get(invoice.id) || 0;

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
      };
    });

    const unpaidInvoices = invoiceBalances.filter(
      (invoice) => invoice.outstandingAmount > 0,
    );

    const overdueInvoices = unpaidInvoices.filter(
      (invoice) => invoice.isOverdue,
    );

    const overduePreviewIds = overdueInvoices
      .slice(0, 5)
      .map((invoice) => invoice.id);

    const overduePreviewRelations = overduePreviewIds.length
      ? await prisma.invoice.findMany({
          where: buildInvoiceAccessWhere(auth.user, {
            id: { in: overduePreviewIds },
          }),
          select: {
            id: true,
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
        })
      : [];

    const overdueRelationMap = new Map(
      overduePreviewRelations.map((invoice) => [invoice.id, invoice]),
    );

    const overdueInvoicePreview = overdueInvoices
      .slice(0, 5)
      .map((invoice) => {
        const relations = overdueRelationMap.get(invoice.id);

        return {
          ...invoice,
          client: relations?.client ?? null,
          case: relations?.case ?? null,
        };
      });

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

    const resolvedCaseRate =
      totalCasesCount > 0
        ? Math.round((resolvedCasesCount / totalCasesCount) * 100)
        : 0;

    const dueTasksCount =
      overdueTasksCount + dueTodayTasksCount;

    return ok({
      timeZone,
      role: auth.user.role,
      permissions: {
        canViewFinance,
      },

      clientCount,
      activeCaseCount,
      totalCasesCount,
      closedCasesCount,
      closedCaseRate,
      archivedCasesCount,
      resolvedCasesCount,
      resolvedCaseRate,
      newClientsThisMonth,

      todayApptCount: todayAppts.length,
      todayAppts,
      upcomingAppointments,

      overdueTasksCount,
      dueTodayTasksCount,
      dueTasksCount,
      upcomingTasks,

      totalRevenue: canViewFinance ? totalRevenue : 0,
      monthlyRevenue: canViewFinance ? monthlyRevenue : 0,

      /*
       * المستحقات الحقيقية من الفواتير.
       */
      pendingAmount: canViewFinance ? pendingAmount : 0,
      overdueAmount: canViewFinance ? overdueAmount : 0,
      unpaidInvoicesCount: canViewFinance ? unpaidInvoices.length : 0,
      overdueInvoicesCount: canViewFinance ? overdueInvoices.length : 0,

      /*
       * نرسل أول خمس فواتير متأخرة لقسم "يحتاج انتباهك".
       */
      overdueInvoices: canViewFinance ? overdueInvoicePreview : [],
    });
  });
}
