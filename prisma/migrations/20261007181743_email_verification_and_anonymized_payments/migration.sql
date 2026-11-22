-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Accounts that signed in with Google already have an address verified by Google.
UPDATE "User" SET "emailVerifiedAt" = NOW()
WHERE "emailVerifiedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "OAuthAccount" o WHERE o."userId" = "User"."id");
