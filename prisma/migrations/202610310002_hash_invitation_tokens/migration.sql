-- Les jetons d'invitation ne sont plus conservés en clair : seule leur empreinte
-- SHA-256 reste en base. Les liens déjà envoyés restent valides.
UPDATE "invitation" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
