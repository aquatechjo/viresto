-- Keep one current subscription per tenant before enforcing the invariant.
WITH ranked_current_subscriptions AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId"
      ORDER BY
        CASE WHEN "status" = 'ACTIVE' THEN 0 ELSE 1 END,
        "updatedAt" DESC,
        "createdAt" DESC,
        "id" DESC
    ) AS row_number
  FROM "Subscription"
  WHERE "status" IN ('ACTIVE', 'TRIALING')
)
UPDATE "Subscription" AS subscription
SET
  "status" = 'CANCELLED',
  "cancelledAt" = COALESCE(subscription."cancelledAt", CURRENT_TIMESTAMP),
  "cancelAtPeriodEnd" = false,
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_current_subscriptions AS ranked
WHERE subscription."id" = ranked."id"
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX "Subscription_one_current_per_tenant"
ON "Subscription"("tenantId")
WHERE "status" IN ('ACTIVE', 'TRIALING');

CREATE TABLE "AiUsagePeriod" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "usedTokens" INTEGER NOT NULL DEFAULT 0,
  "reservedTokens" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiUsagePeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiUsagePeriod_usedTokens_check" CHECK ("usedTokens" >= 0),
  CONSTRAINT "AiUsagePeriod_reservedTokens_check" CHECK ("reservedTokens" >= 0)
);

CREATE TABLE "AiUsageReservation" (
  "id" TEXT NOT NULL,
  "usagePeriodId" TEXT NOT NULL,
  "reservedTokens" INTEGER NOT NULL,
  "actualTokens" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiUsageReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiUsageReservation_reservedTokens_check" CHECK ("reservedTokens" > 0),
  CONSTRAINT "AiUsageReservation_actualTokens_check" CHECK ("actualTokens" IS NULL OR "actualTokens" > 0),
  CONSTRAINT "AiUsageReservation_status_check" CHECK ("status" IN ('PENDING', 'COMMITTED', 'RELEASED', 'EXPIRED'))
);

CREATE UNIQUE INDEX "AiUsagePeriod_tenantId_periodStart_key"
ON "AiUsagePeriod"("tenantId", "periodStart");

CREATE INDEX "AiUsagePeriod_tenantId_updatedAt_idx"
ON "AiUsagePeriod"("tenantId", "updatedAt");

CREATE INDEX "AiUsageReservation_usagePeriodId_status_expiresAt_idx"
ON "AiUsageReservation"("usagePeriodId", "status", "expiresAt");

CREATE INDEX "AiUsageReservation_status_expiresAt_idx"
ON "AiUsageReservation"("status", "expiresAt");

ALTER TABLE "AiUsagePeriod"
ADD CONSTRAINT "AiUsagePeriod_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiUsageReservation"
ADD CONSTRAINT "AiUsageReservation_usagePeriodId_fkey"
FOREIGN KEY ("usagePeriodId") REFERENCES "AiUsagePeriod"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
