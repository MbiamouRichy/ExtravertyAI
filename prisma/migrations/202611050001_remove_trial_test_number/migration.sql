-- L'essai n'est plus limité à un numéro de test : son quota de messages suffit.
ALTER TABLE "project" DROP COLUMN "trialTestNumber";
ALTER TABLE "project" DROP COLUMN "trialTestJid";
ALTER TABLE "project" DROP COLUMN "trialTestNumberChanges";
