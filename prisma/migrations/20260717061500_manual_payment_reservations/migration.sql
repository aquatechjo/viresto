-- Keep a single manual-payment workflow open for each tenant.
WITH ranked_open_payments AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId"
      ORDER BY
        CASE WHEN "status" = 'PROCESSING' THEN 0 ELSE 1 END,
        "createdAt" DESC,
        "id" DESC
    ) AS row_number
  FROM "SubscriptionPayment"
  WHERE "status" IN ('PENDING', 'PROCESSING')
)
UPDATE "SubscriptionPayment" AS payment
SET
  "status" = 'CANCELLED',
  "adminNote" = COALESCE(
    payment."adminNote",
    'تم إلغاء طلب مكرر أثناء ترقية سلامة الدفع اليدوي'
  ),
  "reviewedAt" = COALESCE(payment."reviewedAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_open_payments
WHERE payment."id" = ranked_open_payments."id"
  AND ranked_open_payments.row_number > 1;

CREATE UNIQUE INDEX "SubscriptionPayment_one_open_per_tenant_key"
  ON "SubscriptionPayment"("tenantId")
  WHERE "status" IN ('UPLOADING', 'PENDING', 'PROCESSING');
