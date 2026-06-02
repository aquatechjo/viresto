-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "aiConsentAt" TIMESTAMP(3),
ADD COLUMN     "aiConsentBy" TEXT,
ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false;
