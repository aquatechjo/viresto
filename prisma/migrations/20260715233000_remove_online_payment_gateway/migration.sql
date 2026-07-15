-- Online payment gateways were never used. Keep manual subscription payments only.
DROP TABLE IF EXISTS "PaymentWebhookEvent";

ALTER TABLE "Subscription"
  DROP COLUMN IF EXISTS "provider",
  DROP COLUMN IF EXISTS "providerCustomerId",
  DROP COLUMN IF EXISTS "providerSubscriptionId",
  DROP COLUMN IF EXISTS "providerAgreementId";

ALTER TABLE "SubscriptionPayment"
  DROP COLUMN IF EXISTS "provider",
  DROP COLUMN IF EXISTS "providerChargeId",
  DROP COLUMN IF EXISTS "providerInvoiceId";

DROP TYPE IF EXISTS "BillingProvider";
