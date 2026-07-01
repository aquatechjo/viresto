-- AlterTable
ALTER TABLE "SubscriptionPayment" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "method" TEXT,
ADD COLUMN     "receiptPublicId" TEXT,
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- CreateIndex
CREATE INDEX "SubscriptionPayment_reviewedAt_idx" ON "SubscriptionPayment"("reviewedAt");
