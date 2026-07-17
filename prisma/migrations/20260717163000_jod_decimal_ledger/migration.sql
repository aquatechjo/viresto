-- This migration replaces an older payment amount constraint and is safe to
-- retry if a previous deployment stopped after applying part of the file.
ALTER TABLE "Case"
DROP CONSTRAINT IF EXISTS "Case_feeAgreed_nonnegative_check";

ALTER TABLE "Payment"
DROP CONSTRAINT IF EXISTS "Payment_amount_positive_check";

ALTER TABLE "Invoice"
DROP CONSTRAINT IF EXISTS "Invoice_subtotal_nonnegative_check",
DROP CONSTRAINT IF EXISTS "Invoice_tax_nonnegative_check",
DROP CONSTRAINT IF EXISTS "Invoice_discount_nonnegative_check",
DROP CONSTRAINT IF EXISTS "Invoice_total_nonnegative_check";

ALTER TABLE "InvoiceItem"
DROP CONSTRAINT IF EXISTS "InvoiceItem_quantity_positive_check",
DROP CONSTRAINT IF EXISTS "InvoiceItem_unitPrice_nonnegative_check",
DROP CONSTRAINT IF EXISTS "InvoiceItem_total_nonnegative_check";

ALTER TABLE "Case"
ALTER COLUMN "feeAgreed" TYPE DECIMAL(18, 3)
USING ROUND("feeAgreed"::numeric, 3);

ALTER TABLE "Payment"
ALTER COLUMN "amount" TYPE DECIMAL(18, 3)
USING ROUND("amount"::numeric, 3);

ALTER TABLE "Invoice"
ALTER COLUMN "subtotal" TYPE DECIMAL(18, 3)
USING ROUND("subtotal"::numeric, 3),
ALTER COLUMN "tax" TYPE DECIMAL(18, 3)
USING ROUND("tax"::numeric, 3),
ALTER COLUMN "discount" TYPE DECIMAL(18, 3)
USING ROUND("discount"::numeric, 3),
ALTER COLUMN "total" TYPE DECIMAL(18, 3)
USING ROUND("total"::numeric, 3);

ALTER TABLE "InvoiceItem"
ALTER COLUMN "quantity" TYPE DECIMAL(18, 3)
USING ROUND("quantity"::numeric, 3),
ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 3)
USING ROUND("unitPrice"::numeric, 3),
ALTER COLUMN "total" TYPE DECIMAL(18, 3)
USING ROUND("total"::numeric, 3);

ALTER TABLE "Case"
ADD CONSTRAINT "Case_feeAgreed_nonnegative_check"
CHECK ("feeAgreed" BETWEEN 0 AND 1000000000);

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_amount_positive_check"
CHECK ("amount" > 0 AND "amount" <= 1000000000);

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_subtotal_nonnegative_check"
CHECK ("subtotal" BETWEEN 0 AND 1000000000),
ADD CONSTRAINT "Invoice_tax_nonnegative_check"
CHECK ("tax" BETWEEN 0 AND 1000000000),
ADD CONSTRAINT "Invoice_discount_nonnegative_check"
CHECK ("discount" BETWEEN 0 AND 1000000000),
ADD CONSTRAINT "Invoice_total_nonnegative_check"
CHECK ("total" BETWEEN 0 AND 1000000000);

ALTER TABLE "InvoiceItem"
ADD CONSTRAINT "InvoiceItem_quantity_positive_check"
CHECK ("quantity" > 0 AND "quantity" <= 1000000),
ADD CONSTRAINT "InvoiceItem_unitPrice_nonnegative_check"
CHECK ("unitPrice" BETWEEN 0 AND 1000000000),
ADD CONSTRAINT "InvoiceItem_total_nonnegative_check"
CHECK ("total" BETWEEN 0 AND 1000000000);
