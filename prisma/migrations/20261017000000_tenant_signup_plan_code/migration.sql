-- The plan picked on the website before signing up (nullable, additive).
ALTER TABLE "Tenant" ADD COLUMN "signupPlanCode" TEXT;
