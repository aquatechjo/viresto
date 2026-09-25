-- When Polar first reported the subscription past_due (7-day access cap).
-- Nullable and additive: existing rows are untouched.
ALTER TABLE "Subscription" ADD COLUMN "pastDueSince" TIMESTAMP(3);
