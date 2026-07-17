import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createNotificationsBatch,
  type BatchNotificationInput,
} from "@/lib/notifications";

const APPOINTMENT_SOON_HOURS = 24;
const TASK_SOON_HOURS = 24;
const INVOICE_SOON_HOURS = 72;
const MAX_RULE_ITEMS = 25;

type ActiveUser = {
  id: string;
  isActive: boolean;
};

type FinancialCaseRecipients = {
  leadLawyer: (ActiveUser & { role: string }) | null;
  members: Array<{ userId: string }>;
} | null;

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function formatArabicUnit(
  value: number,
  singular: string,
  dual: string,
  plural: string,
) {
  if (value === 1) return singular;
  if (value === 2) return dual;
  if (value >= 3 && value <= 10) return `${value} ${plural}`;
  return `${value} ${singular}`;
}

function formatRemainingTime(targetDate: Date, fromDate: Date) {
  const diffMs = targetDate.getTime() - fromDate.getTime();

  if (diffMs <= 0) {
    return { ar: "حان الوقت", en: "now" };
  }

  const totalMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const arParts: string[] = [];
  const enParts: string[] = [];

  if (days > 0) {
    arParts.push(formatArabicUnit(days, "يوم واحد", "يومان", "أيام"));
    enParts.push(`${days} ${days === 1 ? "day" : "days"}`);
  }

  if (hours > 0) {
    arParts.push(formatArabicUnit(hours, "ساعة واحدة", "ساعتان", "ساعات"));
    enParts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }

  if (minutes > 0 && days === 0) {
    arParts.push(formatArabicUnit(minutes, "دقيقة واحدة", "دقيقتان", "دقائق"));
    enParts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }

  return {
    ar: arParts.join(" و"),
    en: enParts.join(" and "),
  };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ar-JO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Amman",
  }).format(value);
}

type MonetaryValue = number | string | { toString(): string };

function safeMoney(value: MonetaryValue | null | undefined) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(3) : "0.000";
}

function invoiceOutstanding(
  total: MonetaryValue,
  payments: Array<{ amount: MonetaryValue }>,
) {
  const paid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  return Math.max(Number(total || 0) - paid, 0);
}

function uniqueIds(ids: Array<string | null | undefined>) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function assignedRecipients(
  assignedTo: ActiveUser | null,
  createdBy: ActiveUser | null,
  adminIds: string[],
) {
  if (assignedTo?.isActive) return [assignedTo.id];
  if (createdBy?.isActive) return [createdBy.id];
  return adminIds;
}

function financialRecipients(
  caseItem: FinancialCaseRecipients,
  adminIds: string[],
) {
  return uniqueIds([
    ...adminIds,
    caseItem?.leadLawyer?.isActive && caseItem.leadLawyer.role === "LAWYER"
      ? caseItem.leadLawyer.id
      : null,
    ...(caseItem?.members.map((member) => member.userId) ?? []),
  ]);
}

function versionOf(value: Date | null | undefined) {
  return value?.toISOString() ?? "none";
}

function pushForRecipients(
  target: BatchNotificationInput[],
  recipients: string[],
  ruleKey: string,
  notification: Omit<BatchNotificationInput, "userId" | "dedupeKey">,
) {
  for (const userId of uniqueIds(recipients)) {
    target.push({
      ...notification,
      userId,
      dedupeKey: `${ruleKey}:${userId}`,
    });
  }
}

const financialCaseSelect = {
  title: true,
  leadLawyer: {
    select: {
      id: true,
      isActive: true,
      role: true,
    },
  },
  members: {
    where: {
      user: {
        isActive: true,
        role: "LAWYER" as const,
      },
    },
    select: {
      userId: true,
    },
  },
} as const;

export async function generateImportantNotifications(tenantId: string) {
  const now = new Date();
  const appointmentSoonTo = addHours(now, APPOINTMENT_SOON_HOURS);
  const taskSoonTo = addHours(now, TASK_SOON_HOURS);
  const invoiceSoonTo = addHours(now, INVOICE_SOON_HOURS);

  const [
    admins,
    upcomingAppointments,
    overdueAppointments,
    dueSoonTasks,
    overdueTasks,
    dueSoonInvoices,
    overdueInvoices,
    overduePayments,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: "ADMIN", isActive: true },
      select: { id: true },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        status: "SCHEDULED",
        startTime: { gte: now, lte: appointmentSoonTo },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        assignedTo: { select: { id: true, isActive: true } },
        createdBy: { select: { id: true, isActive: true } },
        case: { select: { title: true } },
        client: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
      take: MAX_RULE_ITEMS,
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        status: "SCHEDULED",
        startTime: { lt: now },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        assignedTo: { select: { id: true, isActive: true } },
        createdBy: { select: { id: true, isActive: true } },
        case: { select: { title: true } },
        client: { select: { name: true } },
      },
      orderBy: { startTime: "desc" },
      take: MAX_RULE_ITEMS,
    }),
    prisma.task.findMany({
      where: {
        tenantId,
        completed: false,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        dueDate: { gte: now, lte: taskSoonTo },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedTo: { select: { id: true, isActive: true } },
        createdBy: { select: { id: true, isActive: true } },
        case: { select: { title: true } },
        client: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: MAX_RULE_ITEMS,
    }),
    prisma.task.findMany({
      where: {
        tenantId,
        completed: false,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedTo: { select: { id: true, isActive: true } },
        createdBy: { select: { id: true, isActive: true } },
        case: { select: { title: true } },
        client: { select: { name: true } },
      },
      orderBy: { dueDate: "desc" },
      take: MAX_RULE_ITEMS,
    }),
    prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ["UNPAID", "PARTIALLY_PAID"] },
        dueDate: { gte: now, lte: invoiceSoonTo },
      },
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        total: true,
        payments: {
          where: { status: "PAID" },
          select: { amount: true },
        },
        client: { select: { name: true } },
        case: { select: financialCaseSelect },
      },
      orderBy: { dueDate: "asc" },
      take: MAX_RULE_ITEMS,
    }),
    prisma.invoice.findMany({
      where: {
        tenantId,
        OR: [
          { status: "OVERDUE" },
          {
            status: { in: ["UNPAID", "PARTIALLY_PAID"] },
            dueDate: { lt: now },
          },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        total: true,
        payments: {
          where: { status: "PAID" },
          select: { amount: true },
        },
        client: { select: { name: true } },
        case: { select: financialCaseSelect },
      },
      orderBy: { dueDate: "desc" },
      take: MAX_RULE_ITEMS,
    }),
    prisma.payment.findMany({
      where: { tenantId, status: "OVERDUE" },
      select: {
        id: true,
        amount: true,
        updatedAt: true,
        case: {
          select: {
            ...financialCaseSelect,
            client: { select: { name: true } },
          },
        },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_RULE_ITEMS,
    }),
  ]);

  const adminIds = admins.map((admin) => admin.id);
  const notifications: BatchNotificationInput[] = [];

  for (const appointment of upcomingAppointments) {
    const remaining = formatRemainingTime(appointment.startTime, now);
    const context = appointment.case?.title
      ? ` للقضية ${appointment.case.title}`
      : appointment.client?.name
        ? ` للموكل ${appointment.client.name}`
        : "";

    pushForRecipients(
      notifications,
      assignedRecipients(appointment.assignedTo, appointment.createdBy, adminIds),
      `appointment:soon:${appointment.id}:${versionOf(appointment.startTime)}`,
      {
        tenantId,
        type: NotificationType.APPOINTMENT,
        titleAr: "موعد قريب",
        titleEn: "Upcoming appointment",
        messageAr: `الموعد ${appointment.title}${context} متبقٍ عليه ${remaining.ar}. الوقت: ${formatDate(appointment.startTime)}.`,
        messageEn: `The appointment ${appointment.title} is due in ${remaining.en}. Time: ${appointment.startTime.toISOString()}.`,
        href: "/dashboard/appointments",
      },
    );
  }

  for (const appointment of overdueAppointments) {
    pushForRecipients(
      notifications,
      assignedRecipients(appointment.assignedTo, appointment.createdBy, adminIds),
      `appointment:overdue:${appointment.id}:${versionOf(appointment.startTime)}`,
      {
        tenantId,
        type: NotificationType.APPOINTMENT,
        titleAr: "موعد متأخر",
        titleEn: "Overdue appointment",
        messageAr: `الموعد ${appointment.title} أصبح متأخرًا ويحتاج متابعة. كان موعده: ${formatDate(appointment.startTime)}.`,
        messageEn: `The appointment ${appointment.title} is overdue and needs follow-up. Scheduled time: ${appointment.startTime.toISOString()}.`,
        href: "/dashboard/appointments",
      },
    );
  }

  for (const task of dueSoonTasks) {
    if (!task.dueDate) continue;
    const remaining = formatRemainingTime(task.dueDate, now);

    pushForRecipients(
      notifications,
      assignedRecipients(task.assignedTo, task.createdBy, adminIds),
      `task:soon:${task.id}:${versionOf(task.dueDate)}`,
      {
        tenantId,
        type: NotificationType.TASK,
        titleAr: "مهمة تستحق قريبًا",
        titleEn: "Task due soon",
        messageAr: `المهمة ${task.title} متبقٍ على استحقاقها ${remaining.ar}. الموعد: ${formatDate(task.dueDate)}.`,
        messageEn: `The task ${task.title} is due in ${remaining.en}. Due: ${task.dueDate.toISOString()}.`,
        href: "/dashboard/tasks",
      },
    );
  }

  for (const task of overdueTasks) {
    if (!task.dueDate) continue;

    pushForRecipients(
      notifications,
      assignedRecipients(task.assignedTo, task.createdBy, adminIds),
      `task:overdue:${task.id}:${versionOf(task.dueDate)}`,
      {
        tenantId,
        type: NotificationType.TASK,
        titleAr: "مهمة متأخرة",
        titleEn: "Overdue task",
        messageAr: `المهمة ${task.title} متأخرة وتحتاج متابعة. موعدها: ${formatDate(task.dueDate)}.`,
        messageEn: `The task ${task.title} is overdue and needs follow-up. Due: ${task.dueDate.toISOString()}.`,
        href: "/dashboard/tasks",
      },
    );
  }

  for (const invoice of dueSoonInvoices) {
    if (!invoice.dueDate) continue;
    const remaining = formatRemainingTime(invoice.dueDate, now);
    const outstanding = invoiceOutstanding(invoice.total, invoice.payments);
    if (outstanding <= 0) continue;

    pushForRecipients(
      notifications,
      financialRecipients(invoice.case, adminIds),
      `invoice:soon:${invoice.id}:${versionOf(invoice.dueDate)}`,
      {
        tenantId,
        type: NotificationType.INVOICE,
        titleAr: "فاتورة تستحق قريبًا",
        titleEn: "Invoice due soon",
        messageAr: `الفاتورة ${invoice.invoiceNumber} للموكل ${invoice.client.name} برصيد ${safeMoney(outstanding)} JOD متبقٍ على استحقاقها ${remaining.ar}.`,
        messageEn: `Invoice ${invoice.invoiceNumber} is due in ${remaining.en}. Outstanding: ${safeMoney(outstanding)} JOD.`,
        href: `/dashboard/invoices/${invoice.id}`,
      },
    );
  }

  for (const invoice of overdueInvoices) {
    const outstanding = invoiceOutstanding(invoice.total, invoice.payments);
    if (outstanding <= 0) continue;

    pushForRecipients(
      notifications,
      financialRecipients(invoice.case, adminIds),
      `invoice:overdue:${invoice.id}:${versionOf(invoice.dueDate)}`,
      {
        tenantId,
        type: NotificationType.INVOICE,
        titleAr: "فاتورة متأخرة",
        titleEn: "Overdue invoice",
        messageAr: `الفاتورة ${invoice.invoiceNumber} للموكل ${invoice.client.name} برصيد ${safeMoney(outstanding)} JOD متأخرة وتحتاج متابعة.`,
        messageEn: `Invoice ${invoice.invoiceNumber} is overdue and needs follow-up. Outstanding: ${safeMoney(outstanding)} JOD.`,
        href: `/dashboard/invoices/${invoice.id}`,
      },
    );
  }

  for (const payment of overduePayments) {
    pushForRecipients(
      notifications,
      financialRecipients(payment.case, adminIds),
      `payment:overdue:${payment.id}:${versionOf(payment.updatedAt)}`,
      {
        tenantId,
        type: NotificationType.PAYMENT,
        titleAr: "دفعة متأخرة",
        titleEn: "Overdue payment",
        messageAr: `هناك دفعة متأخرة بقيمة ${safeMoney(payment.amount)} JOD وتحتاج متابعة.`,
        messageEn: `There is an overdue payment of ${safeMoney(payment.amount)} JOD that needs follow-up.`,
        href: "/dashboard/payments",
      },
    );
  }

  const result = await createNotificationsBatch(notifications);

  return {
    candidates: notifications.length,
    created: result.count,
  };
}
