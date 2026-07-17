-- Enforce that tenant-owned records can only reference records from the same
-- tenant. The entire migration is transactional so a failed preflight or
-- constraint validation leaves the previous schema untouched.

BEGIN;

-- Prevent writes from racing the preflight while the new constraints are
-- installed. This lock is held only for the duration of this migration.
LOCK TABLE
  "TeamInvitation",
  "SubscriptionPayment",
  "Case",
  "Payment",
  "Appointment",
  "Document",
  "Task",
  "Notification",
  "Session",
  "Invoice"
IN SHARE ROW EXCLUSIVE MODE;

-- Stop with a precise error if historical data already contains an orphan or
-- cross-tenant reference. No data is rewritten or deleted automatically.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TeamInvitation" source
    WHERE source."invitedById" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "User" target
        WHERE target."id" = source."invitedById"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: TeamInvitation.invitedById contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SubscriptionPayment" source
    WHERE source."subscriptionId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Subscription" target
        WHERE target."id" = source."subscriptionId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: SubscriptionPayment.subscriptionId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Case" source
    WHERE NOT EXISTS (
      SELECT 1 FROM "Client" target
      WHERE target."id" = source."clientId"
        AND target."tenantId" = source."tenantId"
    )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Case.clientId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Case" source
    WHERE source."leadLawyerId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "User" target
        WHERE target."id" = source."leadLawyerId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Case.leadLawyerId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Payment" source
    WHERE NOT EXISTS (
      SELECT 1 FROM "Client" target
      WHERE target."id" = source."clientId"
        AND target."tenantId" = source."tenantId"
    )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Payment.clientId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Payment" source
    WHERE source."caseId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Case" target
        WHERE target."id" = source."caseId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Payment.caseId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Payment" source
    WHERE source."invoiceId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Invoice" target
        WHERE target."id" = source."invoiceId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Payment.invoiceId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Payment" source
    WHERE source."cancelledById" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "User" target
        WHERE target."id" = source."cancelledById"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Payment.cancelledById contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Appointment" source
    WHERE source."caseId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Case" target
        WHERE target."id" = source."caseId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Appointment.caseId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Appointment" source
    WHERE source."clientId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Client" target
        WHERE target."id" = source."clientId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Appointment.clientId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Appointment" source
    WHERE source."assignedToId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "User" target
        WHERE target."id" = source."assignedToId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Appointment.assignedToId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Appointment" source
    WHERE source."createdById" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "User" target
        WHERE target."id" = source."createdById"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Appointment.createdById contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Document" source
    WHERE source."caseId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Case" target
        WHERE target."id" = source."caseId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Document.caseId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Document" source
    WHERE source."clientId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Client" target
        WHERE target."id" = source."clientId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Document.clientId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Task" source
    WHERE source."assignedToId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "User" target
        WHERE target."id" = source."assignedToId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Task.assignedToId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Task" source
    WHERE source."createdById" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "User" target
        WHERE target."id" = source."createdById"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Task.createdById contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Task" source
    WHERE source."caseId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Case" target
        WHERE target."id" = source."caseId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Task.caseId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Task" source
    WHERE source."clientId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Client" target
        WHERE target."id" = source."clientId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Task.clientId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Notification" source
    WHERE source."userId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "User" target
        WHERE target."id" = source."userId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Notification.userId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Session" source
    WHERE NOT EXISTS (
      SELECT 1 FROM "User" target
      WHERE target."id" = source."userId"
        AND target."tenantId" = source."tenantId"
    )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Session.userId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Invoice" source
    WHERE source."caseId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Case" target
        WHERE target."id" = source."caseId"
          AND target."tenantId" = source."tenantId"
      )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Invoice.caseId contains a cross-tenant or orphan reference';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Invoice" source
    WHERE NOT EXISTS (
      SELECT 1 FROM "Client" target
      WHERE target."id" = source."clientId"
        AND target."tenantId" = source."tenantId"
    )
  ) THEN
    RAISE EXCEPTION 'TENANT_RELATION_INTEGRITY: Invoice.clientId contains a cross-tenant or orphan reference';
  END IF;
END $$;

-- Replace single-column foreign keys with tenant-aware composite keys.
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT IF EXISTS "SubscriptionPayment_subscriptionId_fkey";
ALTER TABLE "Case" DROP CONSTRAINT IF EXISTS "Case_clientId_fkey";
ALTER TABLE "Case" DROP CONSTRAINT IF EXISTS "Case_leadLawyerId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_clientId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_caseId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_invoiceId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_cancelledById_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_caseId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_clientId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_assignedToId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_createdById_fkey";
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_caseId_fkey";
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_clientId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assignedToId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_createdById_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_caseId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_clientId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_caseId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_clientId_fkey";

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_id_tenantId_key"
ON "Subscription"("id", "tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "Client_id_tenantId_key"
ON "Client"("id", "tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_id_tenantId_key"
ON "Invoice"("id", "tenantId");

ALTER TABLE "TeamInvitation"
ADD CONSTRAINT "TeamInvitation_invitedById_tenantId_fkey"
FOREIGN KEY ("invitedById", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPayment"
ADD CONSTRAINT "SubscriptionPayment_subscriptionId_tenantId_fkey"
FOREIGN KEY ("subscriptionId", "tenantId")
REFERENCES "Subscription"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Case"
ADD CONSTRAINT "Case_clientId_tenantId_fkey"
FOREIGN KEY ("clientId", "tenantId")
REFERENCES "Client"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Case"
ADD CONSTRAINT "Case_leadLawyerId_tenantId_fkey"
FOREIGN KEY ("leadLawyerId", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_clientId_tenantId_fkey"
FOREIGN KEY ("clientId", "tenantId")
REFERENCES "Client"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_caseId_tenantId_fkey"
FOREIGN KEY ("caseId", "tenantId")
REFERENCES "Case"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_invoiceId_tenantId_fkey"
FOREIGN KEY ("invoiceId", "tenantId")
REFERENCES "Invoice"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_cancelledById_tenantId_fkey"
FOREIGN KEY ("cancelledById", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_caseId_tenantId_fkey"
FOREIGN KEY ("caseId", "tenantId")
REFERENCES "Case"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_clientId_tenantId_fkey"
FOREIGN KEY ("clientId", "tenantId")
REFERENCES "Client"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_assignedToId_tenantId_fkey"
FOREIGN KEY ("assignedToId", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_createdById_tenantId_fkey"
FOREIGN KEY ("createdById", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document"
ADD CONSTRAINT "Document_caseId_tenantId_fkey"
FOREIGN KEY ("caseId", "tenantId")
REFERENCES "Case"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document"
ADD CONSTRAINT "Document_clientId_tenantId_fkey"
FOREIGN KEY ("clientId", "tenantId")
REFERENCES "Client"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_assignedToId_tenantId_fkey"
FOREIGN KEY ("assignedToId", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_createdById_tenantId_fkey"
FOREIGN KEY ("createdById", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_caseId_tenantId_fkey"
FOREIGN KEY ("caseId", "tenantId")
REFERENCES "Case"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_clientId_tenantId_fkey"
FOREIGN KEY ("clientId", "tenantId")
REFERENCES "Client"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_tenantId_fkey"
FOREIGN KEY ("userId", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Session"
ADD CONSTRAINT "Session_userId_tenantId_fkey"
FOREIGN KEY ("userId", "tenantId")
REFERENCES "User"("id", "tenantId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_caseId_tenantId_fkey"
FOREIGN KEY ("caseId", "tenantId")
REFERENCES "Case"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_clientId_tenantId_fkey"
FOREIGN KEY ("clientId", "tenantId")
REFERENCES "Client"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
