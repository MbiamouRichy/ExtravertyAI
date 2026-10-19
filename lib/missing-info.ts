/**
 * The model appends this marker when the answer depends on information absent
 * from its instructions and reference data. It is always stripped server-side
 * before anything is sent to WhatsApp or shown to a customer.
 */
export const MISSING_INFO_MARKER = "[[INFO_MANQUANTE]]";

export const MISSING_INFO_INSTRUCTION = `\nSi la réponse dépend d’une information absente de tes instructions et des données de référence (prix, stock, délai, horaire…), ne l’invente pas : dis poliment que tu vérifies auprès de l’équipe, puis termine ton message par le marqueur exact ${MISSING_INFO_MARKER}. N’utilise ce marqueur dans aucun autre cas.`;

// Tolerates spacing, case and bracket variations the model may produce.
const MARKER_PATTERN = /\[{1,2}\s*info[\s_-]*manquante\s*\]{1,2}/gi;

const FALLBACK_REPLY =
  "Je vérifie cette information auprès de l’équipe et je reviens vers vous rapidement.";

export function splitMissingInfo(reply: string): { text: string; missing: boolean } {
  const missing = MARKER_PATTERN.test(reply);
  MARKER_PATTERN.lastIndex = 0;
  if (!missing) return { text: reply, missing: false };
  const text = reply.replace(MARKER_PATTERN, "").replace(/[ \t]+\n/g, "\n").trim();
  return { text: text || FALLBACK_REPLY, missing: true };
}
