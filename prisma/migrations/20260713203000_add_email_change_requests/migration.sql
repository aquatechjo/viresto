CREATE TABLE "EmailChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentEmail" TEXT NOT NULL,
    "newEmail" TEXT,
    "oldCodeHash" TEXT NOT NULL,
    "oldCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "oldVerifiedAt" TIMESTAMP(3),
    "newCodeHash" TEXT,
    "newCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailChangeRequest_userId_completedAt_createdAt_idx"
ON "EmailChangeRequest"("userId", "completedAt", "createdAt");

CREATE INDEX "EmailChangeRequest_expiresAt_idx"
ON "EmailChangeRequest"("expiresAt");

ALTER TABLE "EmailChangeRequest"
ADD CONSTRAINT "EmailChangeRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
