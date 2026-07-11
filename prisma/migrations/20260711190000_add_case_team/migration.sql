ALTER TABLE "Case"
  ADD COLUMN "leadLawyerId" TEXT;

-- Give every existing case a responsible active administrator/lawyer from the
-- same office. The column remains nullable to preserve historical records if
-- an office has no eligible active account.
WITH selected_lead AS (
  SELECT DISTINCT ON (app_user."tenantId")
    app_user."tenantId",
    app_user."id"
  FROM "User" AS app_user
  WHERE
    app_user."isActive" = true
    AND app_user."role" IN ('ADMIN', 'LAWYER')
  ORDER BY
    app_user."tenantId",
    CASE
      WHEN app_user."isSystemAdmin" = true THEN 0
      WHEN app_user."role" = 'ADMIN' THEN 1
      ELSE 2
    END,
    app_user."createdAt" ASC
)
UPDATE "Case" AS legal_case
SET "leadLawyerId" = selected_lead."id"
FROM selected_lead
WHERE selected_lead."tenantId" = legal_case."tenantId";

CREATE TABLE "CaseMember" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaseMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseMember_caseId_userId_key"
  ON "CaseMember"("caseId", "userId");

CREATE INDEX "CaseMember_tenantId_idx"
  ON "CaseMember"("tenantId");

CREATE INDEX "CaseMember_tenantId_userId_idx"
  ON "CaseMember"("tenantId", "userId");

CREATE INDEX "CaseMember_caseId_idx"
  ON "CaseMember"("caseId");

CREATE INDEX "Case_tenantId_leadLawyerId_idx"
  ON "Case"("tenantId", "leadLawyerId");

ALTER TABLE "Case"
  ADD CONSTRAINT "Case_leadLawyerId_fkey"
  FOREIGN KEY ("leadLawyerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseMember"
  ADD CONSTRAINT "CaseMember_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseMember"
  ADD CONSTRAINT "CaseMember_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseMember"
  ADD CONSTRAINT "CaseMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
