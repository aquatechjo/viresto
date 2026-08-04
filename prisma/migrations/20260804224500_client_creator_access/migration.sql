-- Track the user who created each client so that unassigned intake records
-- are not visible to every lawyer in the tenant. Existing records remain
-- NULL because their historical creator cannot be inferred safely.
ALTER TABLE "Client"
ADD COLUMN "createdById" TEXT;

CREATE INDEX "Client_tenantId_createdById_idx"
ON "Client"("tenantId", "createdById");

ALTER TABLE "Client"
ADD CONSTRAINT "Client_createdById_tenantId_fkey"
FOREIGN KEY ("createdById", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT
ON UPDATE CASCADE;
