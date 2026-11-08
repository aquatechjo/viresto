import type { Prisma } from "@prisma/client";
import { DateTime } from "luxon";

/** R-YYYY-NNNN, the format the DB checks (Payment_receiptNumber_format_check). */
export function formatReceiptNumber(year: number, sequence: number) {
  if (
    !Number.isSafeInteger(year) ||
    year < 2000 ||
    year > 9999 ||
    !Number.isSafeInteger(sequence) ||
    sequence <= 0
  ) {
    throw new Error("INVALID_RECEIPT_SEQUENCE");
  }

  return `R-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Takes the next receipt number of the office for the current Amman year,
 * inside the caller's transaction (a rolled-back collection gives the
 * number back). Called when a payment is collected, or when an older
 * collected payment without a number is printed for the first time.
 */
export async function allocateReceiptNumber(
  tenantId: string,
  tx: Prisma.TransactionClient,
) {
  const year = DateTime.now().setZone("Asia/Amman").year;
  const allocated = await tx.$queryRaw<Array<{ sequenceNumber: number }>>`
    INSERT INTO "ReceiptSequence" (
      "tenantId",
      "year",
      "nextNumber",
      "createdAt",
      "updatedAt"
    )
    VALUES (${tenantId}, ${year}, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenantId", "year")
    DO UPDATE SET
      "nextNumber" = "ReceiptSequence"."nextNumber" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "nextNumber" - 1 AS "sequenceNumber"
  `;

  const sequenceNumber = allocated[0]?.sequenceNumber;

  if (!sequenceNumber) {
    throw new Error("RECEIPT_SEQUENCE_ALLOCATION_FAILED");
  }

  return formatReceiptNumber(year, Number(sequenceNumber));
}
