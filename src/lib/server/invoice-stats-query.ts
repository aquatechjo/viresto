import type { Prisma, PrismaClient } from "@prisma/client";
import { pastDueBefore } from "@/lib/datetime";
import {
  ISSUED_INVOICE_STATUSES,
  OPEN_INVOICE_STATUSES,
  combineInvoiceStats,
  summarizeInvoiceStats,
  type InvoiceStats,
} from "@/lib/invoice-stats";

const ARCHIVED_CLIENT: Prisma.InvoiceWhereInput = {
  OR: [
    { client: { archivedAt: { not: null } } },
    { case: { client: { archivedAt: { not: null } } } },
  ],
};

/**
 * The invoice list's stat cards, aggregated in the database instead of
 * loading every invoice with its payments. `where` is the user's invoice
 * access filter (buildInvoiceAccessWhere). The queries are independent and
 * run in parallel; combineInvoiceStats turns them into the same figures as
 * summarizeInvoiceStats.
 */
export async function loadInvoiceStats(
  db: Pick<PrismaClient, "invoice" | "payment">,
  where: Prisma.InvoiceWhereInput,
  now: Date = new Date(),
): Promise<InvoiceStats> {
  const scoped = (extra: Prisma.InvoiceWhereInput): Prisma.InvoiceWhereInput => ({
    AND: [where, extra],
  });

  const [byStatus, paidOnIssued, paidOnOpen, overdueOpen, archived, legacyRows] =
    await Promise.all([
      db.invoice.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
      db.payment.aggregate({
        where: {
          status: "PAID",
          invoice: scoped({ status: { in: [...ISSUED_INVOICE_STATUSES] } }),
        },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: {
          status: "PAID",
          invoice: scoped({ status: { in: [...OPEN_INVOICE_STATUSES] } }),
        },
        _sum: { amount: true },
      }),
      db.invoice.count({
        where: scoped({
          status: { in: [...OPEN_INVOICE_STATUSES] },
          dueDate: { lt: pastDueBefore(now) },
        }),
      }),
      db.invoice.count({ where: scoped(ARCHIVED_CLIENT) }),
      // Legacy stored OVERDUE: status from its payments, row by row.
      db.invoice.findMany({
        where: scoped({ status: "OVERDUE" }),
        select: {
          total: true,
          status: true,
          dueDate: true,
          payments: { where: { status: "PAID" }, select: { amount: true } },
        },
      }),
    ]);

  return combineInvoiceStats({
    byStatus: byStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
      total: Number(row._sum.total ?? 0),
    })),
    paidOnIssued: Number(paidOnIssued._sum.amount ?? 0),
    paidOnOpen: Number(paidOnOpen._sum.amount ?? 0),
    overdueOpen,
    archived,
    legacyOverdue: summarizeInvoiceStats(legacyRows, now),
  });
}
