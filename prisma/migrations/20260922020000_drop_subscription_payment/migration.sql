-- DropForeignKey
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT "SubscriptionPayment_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT "SubscriptionPayment_subscriptionId_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT "SubscriptionPayment_requestedPlanId_fkey";

-- DropTable
DROP TABLE "SubscriptionPayment";
