-- Record the exact disclosure accepted by the tenant administrator.
ALTER TABLE "Tenant"
ADD COLUMN "aiConsentPolicyVersion" TEXT;

-- The previous disclosure did not explicitly cover document contents.
-- Require every office to review and accept the updated policy before AI use.
UPDATE "Tenant"
SET
  "aiEnabled" = false,
  "aiConsentAt" = NULL,
  "aiConsentBy" = NULL
WHERE "aiEnabled" = true;

ALTER TABLE "Tenant"
ADD CONSTRAINT "Tenant_ai_enabled_requires_consent_check"
CHECK (
  NOT "aiEnabled"
  OR (
    "aiConsentAt" IS NOT NULL
    AND "aiConsentBy" IS NOT NULL
    AND "aiConsentPolicyVersion" IS NOT NULL
  )
);
