import type { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { formatSequentialInvoiceNumber } from "@/lib/financial-audit";

/**
 * Takes the next invoice number of the office for the current Amman year,
 * inside the caller's transaction, so a rolled-back create or issue gives
 * the number back. Called when an invoice is issued: at creation, or when
 * a draft is issued (drafts have no number, so issued numbers have no gaps).
 */
export async function allocateInvoiceNumber(
  tenantId: string,
  tx: Prisma.TransactionClient,
) {
  const year = DateTime.now().setZone("Asia/Amman").year;
  const allocated = await tx.$queryRaw<Array<{ sequenceNumber: number }>>`
    INSERT INTO "InvoiceSequence" (
      "tenantId",
      "year",
      "nextNumber",
      "createdAt",
      "updatedAt"
    )
    VALUES (${tenantId}, ${year}, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenantId", "year")
    DO UPDATE SET
      "nextNumber" = "InvoiceSequence"."nextNumber" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "nextNumber" - 1 AS "sequenceNumber"
  `;

  const sequenceNumber = allocated[0]?.sequenceNumber;

  if (!sequenceNumber) {
    throw new Error("INVOICE_SEQUENCE_ALLOCATION_FAILED");
  }

  return formatSequentialInvoiceNumber(year, sequenceNumber);
}
