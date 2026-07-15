-- Manual payment receipts are requests awaiting human review.
-- They must not create or replace the tenant's active subscription before approval.

ALTER TABLE "SubscriptionPayment"
ADD COLUMN "requestedPlanId" TEXT,
ADD COLUMN "requestedInterval" "BillingInterval";

-- Preserve the requested plan and interval for any manual requests created
-- before this migration.
UPDATE "SubscriptionPayment" AS payment
SET
  "requestedPlanId" = subscription."planId",
  "requestedInterval" = subscription."interval"
FROM "Subscription" AS subscription
WHERE payment."subscriptionId" = subscription."id"
  AND payment."provider" = 'MANUAL'
  AND payment."receiptUrl" IS NOT NULL;

ALTER TABLE "SubscriptionPayment"
DROP CONSTRAINT "SubscriptionPayment_subscriptionId_fkey";

ALTER TABLE "SubscriptionPayment"
ALTER COLUMN "subscriptionId" DROP NOT NULL;

CREATE INDEX "SubscriptionPayment_requestedPlanId_idx"
ON "SubscriptionPayment"("requestedPlanId");

ALTER TABLE "SubscriptionPayment"
ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPayment"
ADD CONSTRAINT "SubscriptionPayment_requestedPlanId_fkey"
FOREIGN KEY ("requestedPlanId") REFERENCES "BillingPlan"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
