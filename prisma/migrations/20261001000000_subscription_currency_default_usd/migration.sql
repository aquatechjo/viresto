-- Subscriptions are billed in USD by Polar (amounts in cents). Defaults only:
-- existing rows and client invoicing (JOD) are untouched.

-- AlterTable
ALTER TABLE "BillingPlan" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "currency" SET DEFAULT 'USD';
