-- Nullable to preserve the exact payload of already queued / retried emails.
ALTER TABLE "billing_email" ADD COLUMN "html" TEXT;
