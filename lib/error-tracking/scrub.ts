// Nettoyage des événements d’erreur avant leur envoi à GlitchTip.
//
// Une erreur peut embarquer des données de clients (numéro WhatsApp, e-mail)
// ou des secrets (paramètre `secret` du webhook Evolution, jeton Bearer) dans
// son message, sa pile ou un fil d’Ariane. Tout texte de l’événement passe ici,
// quel que soit le champ : seul le contexte technique part chez GlitchTip.

const REDACTED = "[masqué]";

const SECRET_PARAMETER =
  /([?&;](?:secret|token|access_token|refresh_token|key|apikey|api_key|password|signature|code|state|x-vercel-protection-bypass)=)[^&#\s"'<>]*/gi;
const BEARER = /\b(bearer|basic)\s+[a-z0-9._~+/=-]{8,}/gi;
// Identifiants de connexion dans une URL : postgresql://user:motdepasse@hôte
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Numéros de téléphone et identifiants WhatsApp (`24106123456@s.whatsapp.net`).
// Les dates (2026-11-10) et les positions de pile (:12:34) ne sont pas visées.
const PHONE = /(^|[^\w.])\+?\d{8,15}(?!\w)/g;

/** Retire secrets, e-mails et numéros d’un texte. */
export function scrubText(text: string): string {
  return text
    .replace(URL_CREDENTIALS, `$1${REDACTED}@`)
    .replace(SECRET_PARAMETER, `$1${REDACTED}`)
    .replace(BEARER, `$1 ${REDACTED}`)
    .replace(EMAIL, REDACTED)
    .replace(PHONE, `$1${REDACTED}`);
}

const MAX_DEPTH = 12;

/** Applique `scrubText` à toutes les chaînes d’une valeur, en profondeur. */
export function scrubValue<T>(value: T, depth = 0): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return REDACTED as T;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1)) as T;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[key] = scrubValue(item, depth + 1);
  return result as T;
}

// En-têtes de requête utiles au diagnostic ; tous les autres sont retirés
// (cookies de session, autorisations, signatures de webhook).
const KEPT_HEADERS = new Set(["user-agent", "content-type", "accept-language", "referer"]);

type ScrubbableEvent = {
  user?: unknown;
  request?: {
    cookies?: unknown;
    headers?: Record<string, string>;
    data?: unknown;
    query_string?: unknown;
  };
};

/**
 * Prépare un événement pour l’envoi : ni utilisateur, ni cookies, ni corps de
 * requête, en-têtes réduits, puis nettoyage de tous les textes restants.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const copy = { ...event };
  delete copy.user;
  if (copy.request) {
    const request = { ...copy.request };
    delete request.cookies;
    delete request.data;
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(([name]) => KEPT_HEADERS.has(name.toLowerCase())),
      );
    }
    copy.request = request;
  }
  return scrubValue(copy);
}
