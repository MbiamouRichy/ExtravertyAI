/**
 * End of conversation: the markers the model appends to close an exchange or to
 * stay silent, and the deterministic guards that never call the model. Markers
 * are always stripped server-side before anything reaches WhatsApp.
 */
export const END_MARKER = "[[FIN]]";
export const SILENCE_MARKER = "[[SILENCE]]";

/** Always sent: keeps the agent from looping on the same questions. */
export const CONVERSATION_FLOW_INSTRUCTION = `
Déroulement de la conversation :
- Ne repose jamais une question déjà posée dans cette conversation, même reformulée. Si le client n’y a pas répondu, avance sans elle ou conclus.
- Si la demande ne correspond pas à l’activité décrite dans tes instructions, dis-le clairement en une phrase, propose au besoin de transmettre à l’équipe, et ne pose pas d’autre question.
- Ne décris jamais l’offre ou l’activité de l’entreprise en termes vagues ou inventés : si tu ne la connais pas précisément, dis que tu vérifies auprès de l’équipe.`;

/** Sent when the project lets the assistant go quiet at the end of a conversation. */
export const QUIET_INSTRUCTION = `
Fin de conversation :
- Quand le client clôt l’échange (remerciement, accord, « je vous reviens », au revoir), réponds une seule fois, brièvement et sans nouvelle question, puis termine ton message par le marqueur exact ${END_MARKER}.
- Si ton dernier message concluait déjà l’échange et que le client répond seulement par un accusé de réception (ok, merci, d’accord, emoji…), réponds uniquement ${SILENCE_MARKER}, sans aucun autre texte.
- N’utilise ces marqueurs dans aucun autre cas.`;

// Tolerates spacing, case and bracket variations the model may produce.
const END_PATTERN = /\[{1,2}\s*fin\s*\]{1,2}/gi;
const SILENCE_PATTERN = /\[{1,2}\s*silence\s*\]{1,2}/gi;

export function splitConversationEnd(reply: string): {
  text: string;
  end: boolean;
  silent: boolean;
} {
  const end = END_PATTERN.test(reply);
  END_PATTERN.lastIndex = 0;
  const silence = SILENCE_PATTERN.test(reply);
  SILENCE_PATTERN.lastIndex = 0;
  if (!end && !silence) return { text: reply, end: false, silent: false };
  const text = reply
    .replace(END_PATTERN, "")
    .replace(SILENCE_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  // A stray silence marker next to a real answer never swallows it: the text
  // is sent and the exchange is considered closed.
  return { text, end: true, silent: !text };
}

/** Lowercase, without accents, emojis or punctuation; apostrophes kept. */
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️]/gu, " ")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Whole phrases only: anything else (a question, « oui », a request) wakes the assistant.
const ACK_PHRASES = [
  "ok", "okay", "oki", "okk", "okey", "ah ok", "d'accord", "d accord", "daccord", "dac", "dacc",
  "ah d'accord", "entendu", "compris", "bien compris", "c'est compris", "note", "bien note",
  "c'est note", "recu", "bien recu", "c'est bon", "ca marche", "ca roule", "parfait", "super",
  "top", "genial", "cool", "nickel", "impeccable", "tres bien", "je vois", "merci", "mrc", "mci",
  "merci beaucoup", "merci bien", "merci infiniment", "mille merci", "mille mercis",
  "je vous remercie", "thanks", "thank you", "thx", "pas de souci", "pas de soucis",
  "pas de probleme", "avec plaisir", "je vous reviens", "je reviens vers vous",
  "je reviendrai vers vous", "je vous recontacte", "je vous rappelle", "je vous tiens au courant",
  "on se reparle", "a plus", "a plus tard", "a bientot", "a demain", "bonne journee",
  "bonne soiree", "bonne nuit", "bonne fin de journee", "bon week end", "bon weekend",
  "au revoir", "bye", "bisous", "a vous aussi", "vous aussi", "pareillement", "et vous aussi",
];

// Accepted only next to one of the phrases above: « Madame » alone wakes the assistant.
const ACK_FILLERS = [
  "pour tout", "pour l'info", "pour les infos", "pour l'information", "pour votre aide",
  "pour votre reponse", "madame", "monsieur", "encore", "beaucoup", "bcp", "et", "aussi",
];

const ACK_TOKENS = [
  ...ACK_PHRASES.map((phrase) => ({ phrase, filler: false })),
  ...ACK_FILLERS.map((phrase) => ({ phrase, filler: true })),
].sort((a, b) => b.phrase.length - a.phrase.length);

const ACK_MAX_LENGTH = 80;

/**
 * True for a message that only acknowledges (« ok », « merci », « D'accord. Je
 * vous reviens », 👍). Deliberately strict: a false negative costs one model
 * call, a false positive would leave a real question unanswered.
 */
export function isAcknowledgment(text: string): boolean {
  const raw = text.trim();
  if (!raw || raw.length > ACK_MAX_LENGTH || raw.includes("?")) return false;
  let rest = normalize(raw);
  // Emojis or punctuation only.
  if (!rest) return true;
  let acknowledged = false;
  while (rest) {
    const token = ACK_TOKENS.find(({ phrase }) => rest === phrase || rest.startsWith(phrase + " "));
    if (!token) return false;
    acknowledged ||= !token.filler;
    rest = rest.slice(token.phrase.length).trim();
  }
  return acknowledged;
}

const STOPWORDS = new Set(
  (
    "les des une est sont que qui quoi quel quelle quels quelles comment pourquoi combien " +
    "pour par avec sans dans sur sous vous votre vos nous notre nos mon mes ton tes son ses " +
    "leur leurs elle ils elles cela cette ces cet aux pas plus moins tres bien aussi mais " +
    "donc car alors ainsi peut pouvez puis souhaitez voulez etes avez avoir etre faire fait " +
    "suis ete tout tous toute toutes chez entre comme meme deja encore ici voici " +
    "pourriez dire savoir quelque chose est-ce"
  ).split(" "),
);

function contentWords(text: string) {
  return new Set(
    normalize(text)
      .replace(/'/g, " ")
      .split(" ")
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

function questionsOf(text: string) {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.endsWith("?"));
}

const MIN_MESSAGE_WORDS = 4;
const MIN_QUESTION_WORDS = 2;

export type Repetition = { kind: "message" | "question"; sample: string };

// « Pour vous aider à intégrer WhatsApp, quel est votre objectif ? » also asks
// « quel est votre objectif ? »: the clause after the last comma is checked too.
function questionParts(question: string) {
  const clause = question.split(/[,;:]/).at(-1)?.trim() ?? "";
  return clause && clause !== question ? [question, clause] : [question];
}

function containedIn(own: Set<string>, other: Set<string>) {
  let shared = 0;
  for (const word of own) if (other.has(word)) shared++;
  return shared / own.size >= 0.8;
}

/**
 * Detects a reply that repeats one of the assistant's previous messages, or
 * asks again a question it already asked. Short closings (« Avec plaisir ! »)
 * are left to the quiet mode, which never lets them loop. When the client
 * asked something again, giving the same answer again is legitimate.
 */
export function findRepetition(
  reply: string,
  previous: string[],
  { clientAsked = false }: { clientAsked?: boolean } = {},
): Repetition | null {
  const words = contentWords(reply);
  if (!clientAsked && words.size >= MIN_MESSAGE_WORDS) {
    for (const message of previous.slice(0, 3)) {
      const other = contentWords(message);
      let shared = 0;
      for (const word of words) if (other.has(word)) shared++;
      const union = words.size + other.size - shared;
      if (union && shared / union >= 0.8) return { kind: "message", sample: message.slice(0, 200) };
    }
  }
  const asked = previous.flatMap(questionsOf).map((question) => ({ question, words: contentWords(question) }));
  for (const question of questionsOf(reply)) {
    for (const part of questionParts(question)) {
      const own = contentWords(part);
      if (own.size < MIN_QUESTION_WORDS) continue;
      const earlier = asked.find(({ words: other }) => containedIn(own, other));
      if (earlier) return { kind: "question", sample: earlier.question.slice(0, 200) };
    }
  }
  return null;
}

/** Extra instruction for the single regeneration allowed after a repetition. */
export function repetitionHint(repetition: Repetition) {
  return repetition.kind === "message"
    ? "\nTa réponse précédente répétait mot pour mot un message déjà envoyé. Ne la répète pas : apporte une information nouvelle ou conclus l’échange."
    : `\nTu as déjà posé cette question : ${JSON.stringify(repetition.sample)}. Ne la repose pas, même reformulée : réponds autrement ou conclus l’échange.`;
}
