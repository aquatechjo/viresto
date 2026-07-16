-- Prevent a case member row from linking a case and a user that belong to
-- different tenants. Existing inconsistent data intentionally blocks this
-- migration instead of being silently deleted or reassigned.

CREATE UNIQUE INDEX "User_id_tenantId_key"
ON "User"("id", "tenantId");

CREATE UNIQUE INDEX "Case_id_tenantId_key"
ON "Case"("id", "tenantId");

ALTER TABLE "CaseMember"
DROP CONSTRAINT "CaseMember_caseId_fkey";

ALTER TABLE "CaseMember"
DROP CONSTRAINT "CaseMember_userId_fkey";

ALTER TABLE "CaseMember"
ADD CONSTRAINT "CaseMember_caseId_tenantId_fkey"
FOREIGN KEY ("caseId", "tenantId")
REFERENCES "Case"("id", "tenantId")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "CaseMember"
ADD CONSTRAINT "CaseMember_userId_tenantId_fkey"
FOREIGN KEY ("userId", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE CASCADE
ON UPDATE CASCADE;
