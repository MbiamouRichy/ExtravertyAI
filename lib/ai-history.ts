/**
 * Caractères d’historique lus par le modèle à chaque réponse (≈ 3 000 tokens),
 * en plus du nombre de messages de l’offre : quelques messages très longs ne
 * peuvent plus faire exploser le coût d’une réponse.
 */
export const HISTORY_CHAR_BUDGET = 12_000;

/**
 * Garde les messages les plus récents tant que leur total tient dans le
 * budget. Le dernier (la question du client) est toujours gardé, et l’on coupe
 * au premier message qui dépasse : l’historique reste continu, sans trou.
 */
export function fitHistory<T extends { content: string }>(
  messages: readonly T[],
  budget = HISTORY_CHAR_BUDGET,
): T[] {
  let total = 0;
  let start = messages.length;
  while (start > 0) {
    const size = messages[start - 1].content.length;
    if (start < messages.length && total + size > budget) break;
    total += size;
    start -= 1;
  }
  return messages.slice(start);
}
