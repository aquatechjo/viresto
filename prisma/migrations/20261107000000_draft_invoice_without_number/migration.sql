-- Finance plan, batch 5. A draft takes no invoice number: the number is
-- taken from InvoiceSequence when the draft is issued, so issued numbers
-- have no gaps. No existing row is updated or deleted.

-- 1. The number may be empty (drafts only, see the check below). The
-- unique index on ("tenantId", "invoiceNumber") stays: several NULLs do
-- not collide in Postgres.
ALTER TABLE "Invoice"
ALTER COLUMN "invoiceNumber" DROP NOT NULL;

-- 2. Every invoice that is not a draft has a number.
ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_number_required_unless_draft_check"
CHECK ("status" = 'DRAFT' OR "invoiceNumber" IS NOT NULL);
