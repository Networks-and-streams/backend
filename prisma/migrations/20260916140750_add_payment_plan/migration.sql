-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE';
