const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM "Payment"
      ) AS "payments",

      (
        SELECT COUNT(*)::int
        FROM "Payment" AS payment
        LEFT JOIN "Case" AS legal_case
          ON legal_case."id" = payment."caseId"
        WHERE legal_case."id" IS NULL
      ) AS "orphanCasePayments",

      (
        SELECT COUNT(*)::int
        FROM "Payment"
        WHERE "amount" <= 0
      ) AS "nonPositivePayments",

      (
        SELECT COUNT(*)::int
        FROM "Payment"
        WHERE "status" <> 'PAID'
          AND "paidAt" IS NOT NULL
      ) AS "nonPaidWithPaidAt",

      (
        SELECT COUNT(*)::int
        FROM "Payment" AS payment
        INNER JOIN "Invoice" AS invoice
          ON invoice."id" = payment."invoiceId"
        INNER JOIN "Case" AS legal_case
          ON legal_case."id" = payment."caseId"
        WHERE invoice."clientId" <> legal_case."clientId"
      ) AS "invoiceClientMismatches",

      (
        SELECT COUNT(*)::int
        FROM "Payment" AS payment
        INNER JOIN "Invoice" AS invoice
          ON invoice."id" = payment."invoiceId"
        WHERE payment."status" = 'PAID'
          AND payment."amount" > invoice."total" + 0.005
      ) AS "linkedOverpayments",

      (
        SELECT COUNT(*)::int
        FROM "Invoice" AS invoice
        WHERE invoice."status" = 'PAID'
          AND NOT EXISTS (
            SELECT 1
            FROM "Payment" AS payment
            WHERE payment."invoiceId" = invoice."id"
              AND payment."status" = 'PAID'
          )
      ) AS "paidInvoicesWithoutPaidPayment",

      (
        SELECT COUNT(*)::int
        FROM "Invoice" AS invoice
        WHERE invoice."status" <> 'PAID'
          AND EXISTS (
            SELECT 1
            FROM "Payment" AS payment
            WHERE payment."invoiceId" = invoice."id"
              AND payment."status" = 'PAID'
          )
      ) AS "paidPaymentsWithUnpaidInvoice"
  `);

  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
