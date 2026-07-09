-- DropIndex
DROP INDEX "Activity_createdAt_idx";

-- DropIndex
DROP INDEX "Activity_tenantId_idx";

-- CreateIndex
CREATE INDEX "Activity_tenantId_createdAt_id_idx" ON "Activity"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Activity_tenantId_type_createdAt_idx" ON "Activity"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_tenantId_entityType_createdAt_idx" ON "Activity"("tenantId", "entityType", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_tenantId_actorId_createdAt_idx" ON "Activity"("tenantId", "actorId", "createdAt");
