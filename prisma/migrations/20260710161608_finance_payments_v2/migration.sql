-- Add the partial payment invoice status.
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

-- Remove the old one-payment-per-invoice restriction.
DROP INDEX IF EXISTS "Payment_invoiceId_key";

-- Drop foreign keys that need new delete behavior or nullable columns.
ALTER TABLE "Payment"
DROP CONSTRAINT IF EXISTS "Payment_caseId_fkey";

ALTER TABLE "Payment"
DROP CONSTRAINT IF EXISTS "Payment_invoiceId_fkey";

-- Add the direct client relation and payment reference.
-- clientId starts nullable temporarily so existing rows can be backfilled safely.
ALTER TABLE "Payment"
ADD COLUMN "clientId" TEXT,
ADD COLUMN "reference" TEXT,
ALTER COLUMN "caseId" DROP NOT NULL,
ALTER COLUMN "paidAt" DROP NOT NULL,
ALTER COLUMN "paidAt" DROP DEFAULT;

-- A payment date only represents an actually collected payment.
UPDATE "Payment"
SET "paidAt" = NULL
WHERE "status" <> 'PAID';

-- Backfill every existing payment from its current case.
UPDATE "Payment" AS payment
SET "clientId" = legal_case."clientId"
FROM "Case" AS legal_case
WHERE payment."caseId" = legal_case."id"
  AND payment."clientId" IS NULL;

-- Stop the migration if an existing payment could not be linked to a client.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Payment"
    WHERE "clientId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Finance migration stopped: one or more payments could not be linked to a client';
  END IF;
END
$$;

-- Every payment must belong to a client.
ALTER TABLE "Payment"
ALTER COLUMN "clientId" SET NOT NULL;

-- Stop invalid non-positive financial records at database level.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Payment"
    WHERE "amount" <= 0
  ) THEN
    RAISE EXCEPTION
      'Finance migration stopped: one or more payments have a non-positive amount';
  END IF;
END
$$;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_amount_positive_check"
CHECK ("amount" > 0);

-- New query indexes.
CREATE INDEX "Payment_tenantId_status_idx"
ON "Payment"("tenantId", "status");

CREATE INDEX "Payment_clientId_idx"
ON "Payment"("clientId");

CREATE INDEX "Payment_caseId_idx"
ON "Payment"("caseId");

CREATE INDEX "Payment_invoiceId_idx"
ON "Payment"("invoiceId");

-- Add the new protected relationships.
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_clientId_fkey"
FOREIGN KEY ("clientId")
REFERENCES "Client"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_caseId_fkey"
FOREIGN KEY ("caseId")
REFERENCES "Case"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_invoiceId_fkey"
FOREIGN KEY ("invoiceId")
REFERENCES "Invoice"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Keep the payment client synchronized with its case.
-- This also keeps the currently deployed application compatible during rollout,
-- because the old code does not send clientId when creating a payment.
CREATE OR REPLACE FUNCTION "set_payment_client_id_from_case"()
RETURNS TRIGGER AS $$
DECLARE
  resolved_client_id TEXT;
BEGIN
  IF NEW."caseId" IS NOT NULL THEN
    SELECT legal_case."clientId"
    INTO resolved_client_id
    FROM "Case" AS legal_case
    WHERE legal_case."id" = NEW."caseId"
      AND legal_case."tenantId" = NEW."tenantId";

    IF resolved_client_id IS NULL THEN
      RAISE EXCEPTION
        'The selected case does not exist inside the payment tenant';
    END IF;

    IF NEW."clientId" IS NOT NULL
       AND NEW."clientId" <> resolved_client_id THEN
      RAISE EXCEPTION
        'Payment client does not match the selected case client';
    END IF;

    NEW."clientId" := resolved_client_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Payment_sync_client_from_case"
BEFORE INSERT OR UPDATE OF "caseId", "clientId", "tenantId"
ON "Payment"
FOR EACH ROW
EXECUTE FUNCTION "set_payment_client_id_from_case"();
