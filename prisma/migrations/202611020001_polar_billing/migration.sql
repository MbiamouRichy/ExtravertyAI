-- Polar rattache plusieurs projets au même client : l'unicité par client disparaît.
ALTER TABLE "project" ADD COLUMN "billingProvider" TEXT NOT NULL DEFAULT 'stripe';
DROP INDEX "project_stripeCustomerId_key";
