-- Keep the original partial unique index created in
-- 20260717050000_team_invitations_subscription_consistency.
-- This second index has the same key and predicate, so it only adds write cost.
DROP INDEX IF EXISTS "Subscription_one_current_per_tenant";
