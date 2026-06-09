-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);
