-- Composite indexes for the dashboard, financial reports, case-scoped lists,
-- document feeds, and active-session checks. IF NOT EXISTS keeps recovery
-- safe if a deployment is interrupted after creating only part of the set.

CREATE INDEX IF NOT EXISTS "Client_tenantId_archivedAt_createdAt_idx"
ON "Client"("tenantId", "archivedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Case_tenantId_clientId_status_idx"
ON "Case"("tenantId", "clientId", "status");

CREATE INDEX IF NOT EXISTS "Payment_tenantId_status_paidAt_idx"
ON "Payment"("tenantId", "status", "paidAt");

CREATE INDEX IF NOT EXISTS "Payment_tenantId_status_createdAt_idx"
ON "Payment"("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Payment_tenantId_invoiceId_status_idx"
ON "Payment"("tenantId", "invoiceId", "status");

CREATE INDEX IF NOT EXISTS "Appointment_tenantId_status_startTime_idx"
ON "Appointment"("tenantId", "status", "startTime");

CREATE INDEX IF NOT EXISTS "Appointment_tenantId_caseId_startTime_idx"
ON "Appointment"("tenantId", "caseId", "startTime");

CREATE INDEX IF NOT EXISTS "Document_tenantId_createdAt_idx"
ON "Document"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "Document_tenantId_caseId_createdAt_idx"
ON "Document"("tenantId", "caseId", "createdAt");

CREATE INDEX IF NOT EXISTS "Task_tenantId_completed_dueDate_idx"
ON "Task"("tenantId", "completed", "dueDate");

CREATE INDEX IF NOT EXISTS "Task_tenantId_caseId_dueDate_idx"
ON "Task"("tenantId", "caseId", "dueDate");

CREATE INDEX IF NOT EXISTS "Session_userId_isActive_lastActivityAt_idx"
ON "Session"("userId", "isActive", "lastActivityAt");

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_status_dueDate_idx"
ON "Invoice"("tenantId", "status", "dueDate");

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_issueDate_idx"
ON "Invoice"("tenantId", "issueDate");

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_clientId_issueDate_idx"
ON "Invoice"("tenantId", "clientId", "issueDate");
