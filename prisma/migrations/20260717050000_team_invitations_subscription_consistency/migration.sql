-- Secure, single-use invitations for team members.
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamInvitation_email_key" ON "TeamInvitation"("email");
CREATE UNIQUE INDEX "TeamInvitation_tokenHash_key" ON "TeamInvitation"("tokenHash");
CREATE INDEX "TeamInvitation_tenantId_acceptedAt_revokedAt_expiresAt_idx"
  ON "TeamInvitation"("tenantId", "acceptedAt", "revokedAt", "expiresAt");
CREATE INDEX "TeamInvitation_invitedById_idx" ON "TeamInvitation"("invitedById");

ALTER TABLE "TeamInvitation"
  ADD CONSTRAINT "TeamInvitation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the newest active/trial subscription if legacy data contains duplicates.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "Subscription"
  WHERE "status" IN ('ACTIVE', 'TRIALING')
)
UPDATE "Subscription" AS subscription
SET
  "status" = 'CANCELLED',
  "cancelAtPeriodEnd" = false,
  "cancelledAt" = COALESCE(subscription."cancelledAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked
WHERE subscription."id" = ranked."id"
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX "Subscription_one_current_per_tenant_key"
  ON "Subscription"("tenantId")
  WHERE "status" IN ('ACTIVE', 'TRIALING');
