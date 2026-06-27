/*
  Warnings:

  - You are about to drop the column `entityId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `read` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Notification` table. All the data in the column will be lost.
  - The `type` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `messageAr` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `messageEn` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titleAr` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `titleEn` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'BILLING', 'APPOINTMENT', 'CASE', 'DOCUMENT', 'INVOICE', 'PAYMENT', 'TASK', 'SYSTEM');

-- DropIndex
DROP INDEX "Notification_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_tenantId_idx";

-- DropIndex
DROP INDEX "Notification_tenantId_read_idx";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "entityId",
DROP COLUMN "entityType",
DROP COLUMN "message",
DROP COLUMN "read",
DROP COLUMN "title",
ADD COLUMN     "href" TEXT,
ADD COLUMN     "messageAr" TEXT NOT NULL,
ADD COLUMN     "messageEn" TEXT NOT NULL,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "titleAr" TEXT NOT NULL,
ADD COLUMN     "titleEn" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'INFO';

-- CreateIndex
CREATE INDEX "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_readAt_idx" ON "Notification"("tenantId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
