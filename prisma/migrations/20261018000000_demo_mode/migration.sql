-- Demo mode (additive): sandbox offices for trial users, and the link from
-- a demo session back to the user's real session.
ALTER TABLE "Session" ADD COLUMN "parentSessionId" TEXT;

ALTER TABLE "Tenant" ADD COLUMN "demoOwnerTenantId" TEXT,
ADD COLUMN "demoOwnerUserId" TEXT,
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Tenant_demoOwnerUserId_key" ON "Tenant"("demoOwnerUserId");
CREATE INDEX "Tenant_isDemo_idx" ON "Tenant"("isDemo");
CREATE INDEX "Tenant_demoOwnerTenantId_idx" ON "Tenant"("demoOwnerTenantId");

ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_demoOwnerTenantId_fkey" FOREIGN KEY ("demoOwnerTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_demoOwnerUserId_fkey" FOREIGN KEY ("demoOwnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
