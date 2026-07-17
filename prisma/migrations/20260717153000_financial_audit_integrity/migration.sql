ALTER TABLE "Payment"
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledById" TEXT,
ADD COLUMN "cancellationReason" TEXT;

CREATE INDEX "Payment_cancelledById_idx"
ON "Payment"("cancelledById");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_cancelledById_fkey"
FOREIGN KEY ("cancelledById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_cancellation_metadata_check"
CHECK (
  "status" = 'CANCELLED'
  OR (
    "cancelledAt" IS NULL
    AND "cancelledById" IS NULL
    AND "cancellationReason" IS NULL
  )
);

CREATE TABLE "InvoiceSequence" (
  "tenantId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("tenantId", "year"),
  CONSTRAINT "InvoiceSequence_year_check" CHECK ("year" BETWEEN 2000 AND 9999),
  CONSTRAINT "InvoiceSequence_nextNumber_check" CHECK ("nextNumber" > 0)
);

ALTER TABLE "InvoiceSequence"
ADD CONSTRAINT "InvoiceSequence_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "InvoiceSequence" (
  "tenantId",
  "year",
  "nextNumber",
  "createdAt",
  "updatedAt"
)
SELECT
  "tenantId",
  CAST(substring("invoiceNumber" FROM '^INV-([0-9]{4})-[0-9]+$') AS INTEGER),
  MAX(
    CAST(substring("invoiceNumber" FROM '^INV-[0-9]{4}-([0-9]+)$') AS INTEGER)
  ) + 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Invoice"
WHERE "invoiceNumber" ~ '^INV-[0-9]{4}-[0-9]+$'
GROUP BY
  "tenantId",
  CAST(substring("invoiceNumber" FROM '^INV-([0-9]{4})-[0-9]+$') AS INTEGER);
