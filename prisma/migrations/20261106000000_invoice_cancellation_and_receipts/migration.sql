-- Finance plan, batch 4. Additive only: new nullable columns, a new empty
-- table, indexes and constraints. No existing row is updated or deleted.

-- 1. Invoice cancellation metadata (same columns as Payment).
ALTER TABLE "Invoice"
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledById" TEXT,
ADD COLUMN "cancellationReason" TEXT;

CREATE INDEX "Invoice_cancelledById_idx"
ON "Invoice"("cancelledById");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_cancelledById_tenantId_fkey"
FOREIGN KEY ("cancelledById", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_cancellation_metadata_check"
CHECK (
  "status" = 'CANCELLED'
  OR (
    "cancelledAt" IS NULL
    AND "cancelledById" IS NULL
    AND "cancellationReason" IS NULL
  )
);

-- 2. Payment receipt number: R-YYYY-NNNN, unique per office, only on a
-- collected (PAID) or cancelled payment.
ALTER TABLE "Payment"
ADD COLUMN "receiptNumber" TEXT;

CREATE UNIQUE INDEX "Payment_tenantId_receiptNumber_key"
ON "Payment"("tenantId", "receiptNumber");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_receiptNumber_format_check"
CHECK ("receiptNumber" IS NULL OR "receiptNumber" ~ '^R-[0-9]{4}-[0-9]{4,}$');

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_receiptNumber_status_check"
CHECK ("receiptNumber" IS NULL OR "status" IN ('PAID', 'CANCELLED'));

-- 3. Receipt number counter, per office and year (same shape as
-- InvoiceSequence). Starts empty: no receipt number exists yet.
CREATE TABLE "ReceiptSequence" (
  "tenantId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReceiptSequence_pkey" PRIMARY KEY ("tenantId", "year"),
  CONSTRAINT "ReceiptSequence_year_check" CHECK ("year" BETWEEN 2000 AND 9999),
  CONSTRAINT "ReceiptSequence_nextNumber_check" CHECK ("nextNumber" > 0)
);

ALTER TABLE "ReceiptSequence"
ADD CONSTRAINT "ReceiptSequence_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
