-- Suppression d'une notification par glissement (version masquée par utilisateur)
ALTER TABLE "notification_receipt" ADD COLUMN "dismissedVersion" TEXT;
