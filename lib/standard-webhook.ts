import crypto from "node:crypto";

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
/** Taille maximale d'un webhook accepté : un événement Polar pèse quelques Ko. */
export const WEBHOOK_MAX_BODY_BYTES = 1024 * 1024;

/**
 * Clés HMAC possibles pour un secret `whsec_…`, dans l'ordre :
 * - norme Standard Webhooks (secrets Polar créés depuis le 8 septembre 2026) :
 *   le texte après `whsec_`, décodé en base64 ;
 * - secrets Polar plus anciens : les octets UTF-8 du secret entier, comme le
 *   fait le SDK Polar pour rester compatible.
 * Les deux viennent du même secret : accepter l'une ou l'autre n'ouvre rien
 * à qui ne le connaît pas.
 */
function signingKeys(secret: string) {
  const keys: Buffer[] = [];
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) && encoded.length % 4 === 0) {
    const decoded = Buffer.from(encoded, "base64");
    if (decoded.length) keys.push(decoded);
  }
  const raw = Buffer.from(secret, "utf8");
  if (raw.length && !keys.some((key) => key.equals(raw))) keys.push(raw);
  return keys;
}

/** Vérifie une signature Standard Webhooks, utilisée par Polar et Dodo. */
export function verifyWebhookSignature(input: {
  secret: string;
  body: string;
  id: string | null | undefined;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  nowMs?: number;
}) {
  const { secret, body, id, timestamp, signature } = input;
  if (!secret || !id || !timestamp || !signature) return false;
  // Horodatage en secondes entières, comme l'émet la norme.
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const sentAt = Number(timestamp);
  const now = (input.nowMs ?? Date.now()) / 1000;
  if (Math.abs(now - sentAt) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const signed = `${id}.${timestamp}.${body}`;
  const expected = signingKeys(secret).map((key) =>
    crypto.createHmac("sha256", key).update(signed).digest(),
  );
  if (!expected.length) return false;
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const received = Buffer.from(value, "base64");
    // Chaque clé est comparée, en temps constant : aucun indice par la durée.
    let match = false;
    for (const digest of expected)
      if (received.length === digest.length && crypto.timingSafeEqual(received, digest))
        match = true;
    return match;
  });
}

/**
 * Lit le corps d'un webhook sans dépasser `maxBytes` : un envoi trop gros est
 * coupé dès la limite, sans être chargé en mémoire. null s'il est trop gros.
 */
export async function readWebhookBody(req: Request, maxBytes = WEBHOOK_MAX_BODY_BYTES) {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
