ALTER TABLE "Appointment"
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "createdById" TEXT;

-- Assign historical appointments to the active system administrator/admin (or
-- first active member) of the same office. Their real creator is unknown, so
-- createdById intentionally remains NULL. New appointments store the actual
-- creator and selected assignee through the API.
WITH selected_member AS (
  SELECT DISTINCT ON (app_user."tenantId")
    app_user."tenantId",
    app_user."id"
  FROM "User" AS app_user
  WHERE app_user."isActive" = true
  ORDER BY
    app_user."tenantId",
    CASE
      WHEN app_user."isSystemAdmin" = true THEN 0
      WHEN app_user."role" = 'ADMIN' THEN 1
      WHEN app_user."role" = 'LAWYER' THEN 2
      ELSE 3
    END,
    app_user."createdAt" ASC
)
UPDATE "Appointment" AS appointment
SET "assignedToId" = selected_member."id"
FROM selected_member
WHERE selected_member."tenantId" = appointment."tenantId";

CREATE INDEX "Appointment_tenantId_assignedToId_startTime_idx"
  ON "Appointment"("tenantId", "assignedToId", "startTime");

CREATE INDEX "Appointment_createdById_idx"
  ON "Appointment"("createdById");

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
