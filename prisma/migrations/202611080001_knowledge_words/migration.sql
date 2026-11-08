-- Volume de la base de connaissances en mots (titre + contenu), calculé par la
-- base : l'offre limite ce volume, plus parlant qu'un nombre d'entrées.
ALTER TABLE "knowledge_entry" ADD COLUMN "words" INTEGER NOT NULL GENERATED ALWAYS AS (
    COALESCE(
        array_length(
            regexp_split_to_array(
                regexp_replace("title" || ' ' || "content", '^\s+|\s+$', '', 'g'),
                '\s+'
            ),
            1
        ),
        0
    )
) STORED;
