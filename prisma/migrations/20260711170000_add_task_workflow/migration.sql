-- Add a real workflow to tasks while keeping the legacy `completed` column
-- temporarily for compatibility with the existing case details page.

ALTER TYPE "TaskPriority" ADD VALUE IF NOT EXISTS 'URGENT' BEFORE 'LOW';

CREATE TYPE "TaskStatus" AS ENUM (
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "Task"
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
  ADD COLUMN "completedAt" TIMESTAMP(3);

-- Preserve the state of tasks that were completed before this migration.
UPDATE "Task"
SET
  "status" = 'COMPLETED',
  "completedAt" = COALESCE("updatedAt", "createdAt")
WHERE "completed" = true;

-- Assign legacy tasks to the active system administrator (or the first active
-- administrator/member) of the same office. New tasks are assigned explicitly
-- by the API.
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
UPDATE "Task" AS task
SET
  "assignedToId" = member."id",
  "createdById" = member."id"
FROM selected_member AS member
WHERE member."tenantId" = task."tenantId";

CREATE INDEX "Task_tenantId_status_idx"
  ON "Task"("tenantId", "status");

CREATE INDEX "Task_tenantId_assignedToId_status_idx"
  ON "Task"("tenantId", "assignedToId", "status");

CREATE INDEX "Task_tenantId_dueDate_idx"
  ON "Task"("tenantId", "dueDate");

CREATE INDEX "Task_createdById_idx"
  ON "Task"("createdById");

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
