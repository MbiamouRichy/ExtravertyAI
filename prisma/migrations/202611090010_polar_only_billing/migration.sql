-- Polar est le seul fournisseur de paiement : les projets restants le rejoignent.
UPDATE "project" SET "billingProvider" = 'polar' WHERE "billingProvider" <> 'polar';
ALTER TABLE "project" ALTER COLUMN "billingProvider" SET DEFAULT 'polar';
