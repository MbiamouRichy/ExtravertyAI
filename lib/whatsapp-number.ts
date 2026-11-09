/**
 * Deux écritures d’un même numéro WhatsApp.
 *
 * En 2019, le Gabon est passé à 9 chiffres : « 06 xx xx xx » est devenu
 * « 066 xx xx xx ». Au format international, « +241 06… » est donc devenu
 * « +241 66… ». Beaucoup de comptes WhatsApp créés avant gardent l’ancienne
 * écriture : le client saisit la nouvelle, WhatsApp écrit depuis l’ancienne.
 * Les deux désignent le même numéro.
 */
const GABON_2019: Readonly<Record<string, string>> = {
  "01": "11",
  "02": "62",
  "04": "74",
  "05": "65",
  "06": "66",
  "07": "77",
};
const GABON_LEGACY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(GABON_2019).map(([legacy, current]) => [current, legacy]),
);

/** Écriture actuelle des chiffres E.164 : « 24106… » devient « 24166… ». */
export function currentNumberDigits(digits: string) {
  const match = /^241(0\d)(\d{6})$/.exec(digits);
  const current = match && GABON_2019[match[1]];
  return current ? `241${current}${match[2]}` : digits;
}

/** L’autre écriture du même numéro, s’il en a une ; sinon null. */
export function alternateWhatsAppDigits(digits: string) {
  const match = /^241(\d{2})(\d{6})$/.exec(digits);
  if (!match) return null;
  const other = GABON_LEGACY[match[1]] ?? GABON_2019[match[1]];
  return other ? `241${other}${match[2]}` : null;
}

/** Même numéro, quelle que soit l’écriture et la présentation. */
export function sameWhatsAppNumber(a: string, b: string) {
  const left = a.replace(/\D/g, "");
  const right = b.replace(/\D/g, "");
  return left.length > 0 && currentNumberDigits(left) === currentNumberDigits(right);
}

/**
 * Écriture qui a un compte WhatsApp, d’après la réponse d’Evolution à
 * `/chat/whatsappNumbers` (`[{ exists, jid }]`). Le numéro saisi passe en
 * premier ; une réponse illisible le garde.
 */
export function knownWhatsAppDigits(result: unknown, digits: string, alternate: string) {
  const known = new Set(
    (Array.isArray(result) ? result : [])
      .filter((item) => item?.exists === true && typeof item.jid === "string")
      .map((item) => String(item.jid).split("@")[0].split(":")[0]),
  );
  if (known.has(digits)) return digits;
  return known.has(alternate) ? alternate : digits;
}

const ANDROID_APPS = {
  whatsapp: "com.whatsapp",
  business: "com.whatsapp.w4b",
} as const;
export type WhatsAppApp = keyof typeof ANDROID_APPS;

/**
 * Sur Android, un lien wa.me ouvre l’application WhatsApp par défaut, pas
 * forcément celle du numéro à vérifier. Ce lien ouvre l’application choisie,
 * avec le message prêt ; si elle n’est pas installée, le lien wa.me.
 */
export function androidWhatsAppLink(waMeLink: string, app: WhatsAppApp) {
  const url = new URL(waMeLink);
  if (url.protocol !== "https:" || url.hostname !== "wa.me") return waMeLink;
  const phone = url.pathname.replace(/\D/g, "");
  const text = encodeURIComponent(url.searchParams.get("text") ?? "");
  return `intent://send/?phone=${phone}&text=${text}#Intent;scheme=whatsapp;package=${ANDROID_APPS[app]};S.browser_fallback_url=${encodeURIComponent(url.toString())};end`;
}
