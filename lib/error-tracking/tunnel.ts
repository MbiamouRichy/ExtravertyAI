// Relais des erreurs du navigateur vers GlitchTip (route /api/monitoring).
//
// Le navigateur envoie ses enveloppes à l’app plutôt qu’au domaine de
// GlitchTip : les bloqueurs de publicité ne les arrêtent pas. Pour que la route
// ne devienne pas un relais ouvert, seule une enveloppe adressée au projet
// configuré est transmise, et seulement vers l’hôte de ce projet.

/** Taille maximale d’une enveloppe acceptée par le relais. */
export const MAX_ENVELOPE_BYTES = 256 * 1024;

export type ParsedDsn = { dsn: string; host: string; envelopeUrl: string };

/** Lit un DSN `https://clé@hôte/idProjet`. Renvoie null s’il est absent ou invalide. */
export function parseDsn(value: string | undefined): ParsedDsn | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const projectId = url.pathname.replace(/^\/+|\/+$/g, "");
  if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
  if (!url.username || !/^\d+$/.test(projectId)) return null;
  return {
    dsn: value.trim(),
    host: url.host,
    envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
  };
}

/**
 * Adresse de transmission d’une enveloppe, ou null si elle ne vise pas le
 * projet configuré. L’en-tête d’enveloppe est la première ligne, en JSON.
 */
export function envelopeTarget(body: Uint8Array, configured: ParsedDsn): string | null {
  const newline = body.indexOf(0x0a);
  const firstLine = new TextDecoder().decode(newline === -1 ? body : body.subarray(0, newline));
  let header: unknown;
  try {
    header = JSON.parse(firstLine);
  } catch {
    return null;
  }
  const dsn = (header as { dsn?: unknown } | null)?.dsn;
  if (typeof dsn !== "string") return null;
  const sent = parseDsn(dsn);
  if (!sent || sent.envelopeUrl !== configured.envelopeUrl || sent.dsn !== configured.dsn)
    return null;
  return configured.envelopeUrl;
}
