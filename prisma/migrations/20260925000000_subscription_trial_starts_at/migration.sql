-- In-app signup trial start. Nullable and additive: existing rows are untouched.
ALTER TABLE "Subscription" ADD COLUMN "trialStartsAt" TIMESTAMP(3);
