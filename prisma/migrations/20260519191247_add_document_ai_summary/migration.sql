-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "aiAmounts" JSONB,
ADD COLUMN     "aiAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "aiDates" JSONB,
ADD COLUMN     "aiKeyPoints" JSONB,
ADD COLUMN     "aiParties" JSONB,
ADD COLUMN     "aiSummary" TEXT;
