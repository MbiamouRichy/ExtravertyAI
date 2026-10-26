-- Rejet automatique des appels WhatsApp entrants
ALTER TABLE "project" ADD COLUMN "whatsappRejectCalls" BOOLEAN NOT NULL DEFAULT false;
