-- Finance plan, batch 6 (receipts). Additive only: one new nullable
-- column, its index and its foreign key. No existing row is updated or
-- deleted; payments collected before this migration keep NULL (unknown).

-- Who recorded the collection (the payment became PAID), shown on the
-- receipt. Same key shape and RESTRICT as Payment.cancelledById.
ALTER TABLE "Payment"
ADD COLUMN "collectedById" TEXT;

CREATE INDEX "Payment_collectedById_idx"
ON "Payment"("collectedById");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_collectedById_tenantId_fkey"
FOREIGN KEY ("collectedById", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
