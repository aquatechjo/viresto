-- AlterTable
ALTER TABLE "BillingPlan" ADD COLUMN     "polarMonthlyProductId" TEXT,
ADD COLUMN     "polarYearlyProductId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "polarCustomerId" TEXT,
ADD COLUMN     "polarSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_polarSubscriptionId_key" ON "Subscription"("polarSubscriptionId");
