-- Dedupe for incoming webhooks (Polar): one row per handled delivery,
-- keyed by the standard-webhooks "webhook-id". Additive only.

-- CreateTable
CREATE TABLE "ProcessedWebhook" (
    "source" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("source","webhookId")
);

-- CreateIndex
CREATE INDEX "ProcessedWebhook_processedAt_idx" ON "ProcessedWebhook"("processedAt");
