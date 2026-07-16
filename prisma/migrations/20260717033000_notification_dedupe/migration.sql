ALTER TABLE "Notification"
ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "Notification_tenantId_dedupeKey_key"
ON "Notification"("tenantId", "dedupeKey");

CREATE INDEX "Notification_tenantId_userId_readAt_createdAt_idx"
ON "Notification"("tenantId", "userId", "readAt", "createdAt");
