-- When the welcome email was sent to the office founder (nullable, additive).
ALTER TABLE "Tenant" ADD COLUMN "welcomeEmailSentAt" TIMESTAMP(3);
