import { serializeJsonLd } from "@/lib/structured-data";

/**
 * Données structurées schema.org d’une page. Le contenu vient du code, jamais
 * d’un utilisateur, et `serializeJsonLd` échappe `<` : rien ne peut fermer la
 * balise.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
