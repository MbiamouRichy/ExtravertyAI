import crypto from "node:crypto";

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

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
  if (!id || !timestamp || !signature) return false;
  const sentAt = Number(timestamp);
  const now = (input.nowMs ?? Date.now()) / 1000;
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(now - sentAt) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const received = Buffer.from(value, "base64");
    return (
      received.length === expected.length &&
      crypto.timingSafeEqual(received, expected)
    );
  });
}
