/**
 * Caractères d’historique lus par le modèle à chaque réponse (≈ 1 500 tokens),
 * en plus du nombre de messages de l’offre : quelques messages très longs ne
 * peuvent plus faire exploser le coût d’une réponse.
 */
export const HISTORY_CHAR_BUDGET = 6_000;

/**
 * Longueur gardée de chaque message ancien (une longue transcription, un texte
 * collé) : assez pour une réponse de 300 mots de l’assistant. Le dernier
 * message, celui auquel on répond, reste entier.
 */
export const HISTORY_MESSAGE_MAX = 2_000;

/**
 * Garde les messages les plus récents tant que leur total tient dans le
 * budget. Le dernier (la question du client) est toujours gardé, et l’on coupe
 * au premier message qui dépasse : l’historique reste continu, sans trou.
 */
export function fitHistory<T extends { content: string }>(
  messages: readonly T[],
  budget = HISTORY_CHAR_BUDGET,
): T[] {
  const clipped = messages.map((message, index) =>
    index < messages.length - 1 && message.content.length > HISTORY_MESSAGE_MAX
      ? { ...message, content: message.content.slice(0, HISTORY_MESSAGE_MAX) + " […]" }
      : message,
  );
  let total = 0;
  let start = clipped.length;
  while (start > 0) {
    const size = clipped[start - 1].content.length;
    if (start < clipped.length && total + size > budget) break;
    total += size;
    start -= 1;
  }
  return clipped.slice(start);
}
