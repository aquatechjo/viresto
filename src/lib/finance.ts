import type { InvoiceStatus, Prisma } from "@prisma/client";

const MONEY_EPSILON = 0.005;

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

interface CalculateInvoiceStatusInput {
  currentStatus: InvoiceStatus;
  total: number;
  paidTotal: number;
  dueDate: Date | null;
  now?: Date;
}

export function calculateInvoiceStatus({
  currentStatus,
  total,
  paidTotal,
  dueDate,
  now = new Date(),
}: CalculateInvoiceStatusInput): InvoiceStatus {
  // الفاتورة المسودة أو الملغاة لا تتغير تلقائيًا.
  if (currentStatus === "DRAFT" || currentStatus === "CANCELLED") {
    return currentStatus;
  }

  const normalizedTotal = roundMoney(total);
  const normalizedPaidTotal = roundMoney(paidTotal);

  if (
    normalizedTotal > 0 &&
    normalizedPaidTotal + MONEY_EPSILON >= normalizedTotal
  ) {
    return "PAID";
  }

  if (normalizedPaidTotal > MONEY_EPSILON) {
    return "PARTIALLY_PAID";
  }

  if (dueDate && dueDate.getTime() < now.getTime()) {
    return "OVERDUE";
  }

  return "UNPAID";
}

interface SyncInvoiceStatusInput {
  tenantId: string;
  invoiceId: string;
}

export async function syncInvoiceStatus(
  tx: Prisma.TransactionClient,
  { tenantId, invoiceId }: SyncInvoiceStatusInput,
) {
  const invoice = await tx.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId,
    },
    select: {
      id: true,
      status: true,
      total: true,
      dueDate: true,
      payments: {
        where: {
          status: "PAID",
        },
        select: {
          amount: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("INVOICE_NOT_FOUND");
  }

  const paidTotal = roundMoney(
    invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    ),
  );

  const total = roundMoney(Number(invoice.total));
  const remaining = roundMoney(Math.max(0, total - paidTotal));

  const nextStatus = calculateInvoiceStatus({
    currentStatus: invoice.status,
    total,
    paidTotal,
    dueDate: invoice.dueDate,
  });

  if (nextStatus !== invoice.status) {
    await tx.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        status: nextStatus,
      },
    });
  }

  return {
    invoiceId: invoice.id,
    previousStatus: invoice.status,
    status: nextStatus,
    total,
    paidTotal,
    remaining,
  };
}