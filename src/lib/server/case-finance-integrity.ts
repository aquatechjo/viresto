import type { Prisma } from "@prisma/client";
import { roundMoney } from "@/lib/finance";
import { formatJodNumber, moneyExceeds } from "@/lib/money";

export type CaseFinancialSnapshot = {
  caseId: string;
  feeAgreed: number;
  activeInvoicesTotal: number;
  directPaidTotal: number;
  committedTotal: number;
  available: number;
};

export class CaseFinancialLimitError extends Error {
  readonly status = 409;

  constructor(
    message: string,
    readonly details: CaseFinancialSnapshot & { requestedAmount?: number },
  ) {
    super(message);
    this.name = "CaseFinancialLimitError";
  }
}

export function isCaseFinancialLimitError(
  error: unknown,
): error is CaseFinancialLimitError {
  return error instanceof CaseFinancialLimitError;
}

export function calculateCaseFinancialSnapshot(input: {
  caseId: string;
  feeAgreed: number;
  activeInvoicesTotal: number;
  directPaidTotal: number;
}): CaseFinancialSnapshot {
  const feeAgreed = roundMoney(input.feeAgreed);
  const activeInvoicesTotal = roundMoney(input.activeInvoicesTotal);
  const directPaidTotal = roundMoney(input.directPaidTotal);
  const committedTotal = roundMoney(activeInvoicesTotal + directPaidTotal);

  return {
    caseId: input.caseId,
    feeAgreed,
    activeInvoicesTotal,
    directPaidTotal,
    committedTotal,
    available: roundMoney(Math.max(feeAgreed - committedTotal, 0)),
  };
}

type SnapshotInput = {
  tenantId: string;
  caseId: string;
  excludeInvoiceId?: string;
  excludeDirectPaymentId?: string;
};

async function lockCase(
  tx: Prisma.TransactionClient,
  tenantId: string,
  caseId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Case"
    WHERE "id" = ${caseId}
      AND "tenantId" = ${tenantId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new CaseFinancialLimitError("القضية غير موجودة داخل هذا المكتب", {
      caseId,
      feeAgreed: 0,
      activeInvoicesTotal: 0,
      directPaidTotal: 0,
      committedTotal: 0,
      available: 0,
    });
  }
}

export async function getLockedCaseFinancialSnapshot(
  tx: Prisma.TransactionClient,
  input: SnapshotInput,
) {
  await lockCase(tx, input.tenantId, input.caseId);

  const [caseRecord, invoices, directPayments] = await Promise.all([
    tx.case.findFirst({
      where: { id: input.caseId, tenantId: input.tenantId },
      select: { id: true, feeAgreed: true },
    }),
    tx.invoice.aggregate({
      where: {
        tenantId: input.tenantId,
        caseId: input.caseId,
        status: { not: "CANCELLED" },
        ...(input.excludeInvoiceId
          ? { id: { not: input.excludeInvoiceId } }
          : {}),
      },
      _sum: { total: true },
    }),
    tx.payment.aggregate({
      where: {
        tenantId: input.tenantId,
        caseId: input.caseId,
        invoiceId: null,
        status: "PAID",
        ...(input.excludeDirectPaymentId
          ? { id: { not: input.excludeDirectPaymentId } }
          : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  if (!caseRecord) {
    throw new CaseFinancialLimitError("القضية غير موجودة داخل هذا المكتب", {
      caseId: input.caseId,
      feeAgreed: 0,
      activeInvoicesTotal: 0,
      directPaidTotal: 0,
      committedTotal: 0,
      available: 0,
    });
  }

  return calculateCaseFinancialSnapshot({
    caseId: caseRecord.id,
    feeAgreed: Number(caseRecord.feeAgreed || 0),
    activeInvoicesTotal: Number(invoices._sum.total || 0),
    directPaidTotal: Number(directPayments._sum.amount || 0),
  });
}

export async function assertCaseCanAcceptAmount(
  tx: Prisma.TransactionClient,
  input: SnapshotInput & {
    amount: number;
    label: "الفاتورة" | "الدفعة";
  },
) {
  const snapshot = await getLockedCaseFinancialSnapshot(tx, input);
  const requestedAmount = roundMoney(input.amount);

  if (snapshot.feeAgreed <= 0 || moneyExceeds(requestedAmount, snapshot.available)) {
    throw new CaseFinancialLimitError(
      `قيمة ${input.label} تتجاوز السقف المالي للقضية. الأتعاب ${formatJodNumber(
        snapshot.feeAgreed,
      )} د.أ، الملتزم به ${formatJodNumber(
        snapshot.committedTotal,
      )} د.أ، والمتاح ${formatJodNumber(snapshot.available)} د.أ`,
      { ...snapshot, requestedAmount },
    );
  }

  return snapshot;
}

export async function assertCaseFeeCoversCommitments(
  tx: Prisma.TransactionClient,
  input: SnapshotInput & { nextFeeAgreed: number },
) {
  const snapshot = await getLockedCaseFinancialSnapshot(tx, input);
  const nextFeeAgreed = roundMoney(input.nextFeeAgreed);

  if (moneyExceeds(snapshot.committedTotal, nextFeeAgreed)) {
    throw new CaseFinancialLimitError(
      `لا يمكن خفض أتعاب القضية إلى ${formatJodNumber(
        nextFeeAgreed,
      )} د.أ لأن إجمالي الفواتير والدفعات المباشرة الملتزم بها هو ${formatJodNumber(
        snapshot.committedTotal,
      )} د.أ`,
      { ...snapshot, feeAgreed: nextFeeAgreed },
    );
  }

  return snapshot;
}
