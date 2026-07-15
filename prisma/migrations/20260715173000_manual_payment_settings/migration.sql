CREATE TABLE "ManualPaymentSettings" (
    "id" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "accountHolderName" TEXT,
    "cliqEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cliqAlias" TEXT,
    "bankTransferEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT,
    "iban" TEXT,
    "instructionsAr" TEXT,
    "instructionsEn" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualPaymentSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ManualPaymentSettings" (
    "id",
    "isEnabled",
    "cliqEnabled",
    "bankTransferEnabled",
    "createdAt",
    "updatedAt"
)
VALUES (
    'default',
    false,
    false,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
