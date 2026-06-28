import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTenantNotification } from "@/lib/notifications";

const APPOINTMENT_SOON_HOURS = 24;
const INVOICE_SOON_HOURS = 72;
const MAX_RULE_ITEMS = 25;

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ar-JO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function safeMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export async function generateImportantNotifications(tenantId: string) {
  try {
    const now = new Date();
    const appointmentSoonTo = addHours(now, APPOINTMENT_SOON_HOURS);
    const invoiceSoonTo = addHours(now, INVOICE_SOON_HOURS);

    const [
      upcomingAppointments,
      overdueAppointments,
      dueSoonInvoices,
      overdueInvoices,
      overduePayments,
    ] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          tenantId,
          status: "SCHEDULED",
          startTime: {
            gte: now,
            lte: appointmentSoonTo,
          },
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          type: true,
          case: {
            select: {
              title: true,
            },
          },
          client: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          startTime: "asc",
        },
        take: MAX_RULE_ITEMS,
      }),

      prisma.appointment.findMany({
        where: {
          tenantId,
          status: "SCHEDULED",
          startTime: {
            lt: now,
          },
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          type: true,
          case: {
            select: {
              title: true,
            },
          },
          client: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          startTime: "asc",
        },
        take: MAX_RULE_ITEMS,
      }),

      prisma.invoice.findMany({
        where: {
          tenantId,
          status: "UNPAID",
          dueDate: {
            gte: now,
            lte: invoiceSoonTo,
          },
        },
        select: {
          id: true,
          invoiceNumber: true,
          dueDate: true,
          total: true,
          client: {
            select: {
              name: true,
            },
          },
          case: {
            select: {
              title: true,
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
        take: MAX_RULE_ITEMS,
      }),

      prisma.invoice.findMany({
        where: {
          tenantId,
          OR: [
            {
              status: "OVERDUE",
            },
            {
              status: "UNPAID",
              dueDate: {
                lt: now,
              },
            },
          ],
        },
        select: {
          id: true,
          invoiceNumber: true,
          dueDate: true,
          total: true,
          status: true,
          client: {
            select: {
              name: true,
            },
          },
          case: {
            select: {
              title: true,
            },
          },
        },
        orderBy: {
          dueDate: "asc",
        },
        take: MAX_RULE_ITEMS,
      }),

      prisma.payment.findMany({
        where: {
          tenantId,
          status: "OVERDUE",
        },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          case: {
            select: {
              title: true,
              client: {
                select: {
                  name: true,
                },
              },
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: MAX_RULE_ITEMS,
      }),
    ]);

    await Promise.all([
      ...upcomingAppointments.map((appointment) => {
        const caseText = appointment.case?.title
          ? ` للقضية ${appointment.case.title}`
          : "";
        const clientText = appointment.client?.name
          ? ` للموكل ${appointment.client.name}`
          : "";

        return createTenantNotification({
          tenantId,
          type: NotificationType.APPOINTMENT,
          titleAr: "موعد قريب",
          titleEn: "Upcoming appointment",
          messageAr: `الموعد ${appointment.title}${caseText}${clientText} قريب خلال ${APPOINTMENT_SOON_HOURS} ساعة. الوقت: ${formatDate(appointment.startTime)}.`,
          messageEn: `The appointment ${appointment.title} is due within ${APPOINTMENT_SOON_HOURS} hours. Time: ${appointment.startTime.toISOString()}.`,
          href: "/dashboard/appointments",
          dedupeForever: true,
        });
      }),

      ...overdueAppointments.map((appointment) => {
        const caseText = appointment.case?.title
          ? ` للقضية ${appointment.case.title}`
          : "";
        const clientText = appointment.client?.name
          ? ` للموكل ${appointment.client.name}`
          : "";

        return createTenantNotification({
          tenantId,
          type: NotificationType.APPOINTMENT,
          titleAr: "موعد متأخر",
          titleEn: "Overdue appointment",
          messageAr: `الموعد ${appointment.title}${caseText}${clientText} أصبح متأخرًا ويحتاج متابعة. كان موعده: ${formatDate(appointment.startTime)}.`,
          messageEn: `The appointment ${appointment.title} is overdue and needs follow-up. Scheduled time: ${appointment.startTime.toISOString()}.`,
          href: "/dashboard/appointments",
          dedupeForever: true,
        });
      }),

      ...dueSoonInvoices.map((invoice) => {
        const clientText = invoice.client?.name
          ? ` للموكل ${invoice.client.name}`
          : "";
        const caseText = invoice.case?.title
          ? ` على القضية ${invoice.case.title}`
          : "";
        const dueDateText = invoice.dueDate
          ? formatDate(invoice.dueDate)
          : "غير محدد";

        return createTenantNotification({
          tenantId,
          type: NotificationType.INVOICE,
          titleAr: "فاتورة تستحق قريبًا",
          titleEn: "Invoice due soon",
          messageAr: `الفاتورة ${invoice.invoiceNumber}${clientText}${caseText} بقيمة ${safeMoney(invoice.total)} JOD تستحق خلال ${INVOICE_SOON_HOURS} ساعة. تاريخ الاستحقاق: ${dueDateText}.`,
          messageEn: `Invoice ${invoice.invoiceNumber} is due within ${INVOICE_SOON_HOURS} hours. Total: ${safeMoney(invoice.total)} JOD.`,
          href: `/dashboard/invoices/${invoice.id}`,
          dedupeForever: true,
        });
      }),

      ...overdueInvoices.map((invoice) => {
        const clientText = invoice.client?.name
          ? ` للموكل ${invoice.client.name}`
          : "";
        const caseText = invoice.case?.title
          ? ` على القضية ${invoice.case.title}`
          : "";
        const dueDateText = invoice.dueDate
          ? formatDate(invoice.dueDate)
          : "غير محدد";

        return createTenantNotification({
          tenantId,
          type: NotificationType.INVOICE,
          titleAr: "فاتورة متأخرة",
          titleEn: "Overdue invoice",
          messageAr: `الفاتورة ${invoice.invoiceNumber}${clientText}${caseText} بقيمة ${safeMoney(invoice.total)} JOD متأخرة وتحتاج متابعة. تاريخ الاستحقاق: ${dueDateText}.`,
          messageEn: `Invoice ${invoice.invoiceNumber} is overdue and needs follow-up. Total: ${safeMoney(invoice.total)} JOD.`,
          href: `/dashboard/invoices/${invoice.id}`,
          dedupeForever: true,
        });
      }),

      ...overduePayments.map((payment) => {
        const clientText = payment.case?.client?.name
          ? ` للموكل ${payment.case.client.name}`
          : "";
        const caseText = payment.case?.title
          ? ` على القضية ${payment.case.title}`
          : "";
        const invoiceText = payment.invoice?.invoiceNumber
          ? ` المرتبطة بالفاتورة ${payment.invoice.invoiceNumber}`
          : "";

        return createTenantNotification({
          tenantId,
          type: NotificationType.PAYMENT,
          titleAr: "دفعة متأخرة",
          titleEn: "Overdue payment",
          messageAr: `هناك دفعة متأخرة بقيمة ${safeMoney(payment.amount)} JOD${clientText}${caseText}${invoiceText} وتحتاج متابعة.`,
          messageEn: `There is an overdue payment of ${safeMoney(payment.amount)} JOD that needs follow-up.`,
          href: "/dashboard/payments",
          dedupeForever: true,
        });
      }),
    ]);
  } catch (error) {
    console.error("[GENERATE_IMPORTANT_NOTIFICATIONS_ERROR]", error);
  }
}