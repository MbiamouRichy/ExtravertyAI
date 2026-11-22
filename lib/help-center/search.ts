/**
 * Recherche du centre d’aide, sans dépendance : ce module part dans le bundle
 * du navigateur. L’index lui-même est construit côté serveur (articles.ts).
 */
export type HelpSearchEntry = {
  href: string;
  title: string;
  context: string;
  /** Texte normalisé (minuscules, sans accents) sur lequel porte la recherche. */
  haystack: string;
  /** Titres et mots-clés : pèsent plus lourd dans le classement. */
  emphasis: string;
};

export function normalizeHelpSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Chaque mot de la requête doit apparaître ; les titres passent devant. */
export function searchHelpIndex(index: HelpSearchEntry[], query: string, limit = 8) {
  const terms = normalizeHelpSearch(query).split(" ").filter((term) => term.length > 0);
  if (terms.length === 0) return [];
  return index
    .map((entry, position) => {
      if (!terms.every((term) => entry.haystack.includes(term))) return null;
      const score = terms.reduce((total, term) => total + (entry.emphasis.includes(term) ? 3 : 1), 0);
      return { entry, score, position };
    })
    .filter((result) => result !== null)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .slice(0, limit)
    .map((result) => result.entry);
}
