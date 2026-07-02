-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "defendantName" TEXT,
ADD COLUMN     "judgeName" TEXT,
ADD COLUMN     "plaintiffName" TEXT;

-- CreateIndex
CREATE INDEX "Case_tenantId_caseNumber_idx" ON "Case"("tenantId", "caseNumber");
