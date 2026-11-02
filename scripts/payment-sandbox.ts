import "dotenv/config";
import crypto from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import {
  buildCheckoutRequest,
  buildDodoSubscriptionUpdate,
  checkoutUrlFrom,
  isSandboxProvider,
  summarizeEvent,
  verifyWebhookSignature,
  webhookSecretName,
  type DodoSubscriptionChange,
  type SandboxProvider,
} from "../lib/payment-sandbox";
import { resolvePlanId } from "../lib/pricing";

const PORT = Number(process.env.PAYMENT_SANDBOX_PORT) || 4242;
const MAX_BODY_BYTES = 1024 * 1024;

const USAGE = `Utilisation :
  npm run payments:sandbox -- checkout <polar|dodo> [starter|pro|business]
  npm run payments:sandbox -- listen
  npm run payments:sandbox -- dodo-bill-soon <sub_id> [minutes]
  npm run payments:sandbox -- dodo-cancel <sub_id> [now|period-end]`;

async function checkout(provider: SandboxProvider, planArg: string | undefined) {
  const email = process.env.PAYMENT_SANDBOX_EMAIL?.trim();
  if (!email) throw new Error("Variable manquante : PAYMENT_SANDBOX_EMAIL");
  // Identifiant fictif : aucun projet réel n'est créé ni modifié.
  const projectId = `sandbox_${crypto.randomUUID()}`;
  const request = buildCheckoutRequest(
    provider,
    {
      plan: resolvePlanId(planArg ?? "starter"),
      projectId,
      email,
      returnUrl: `http://localhost:${PORT}/done`,
    },
    process.env,
  );
  const response = await fetch(request.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    throw new Error(`${provider} a refusé le paiement (${response.status}) : ${detail}`);
  }
  console.log(`Projet fictif : ${projectId}`);
  console.log(`Paiement de test : ${checkoutUrlFrom(provider, await response.json())}`);
}

async function updateDodoSubscription(
  subscriptionId: string,
  change: DodoSubscriptionChange,
) {
  const request = buildDodoSubscriptionUpdate(
    subscriptionId,
    change,
    process.env,
  );
  const response = await fetch(request.url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${request.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    throw new Error(`dodo a refusé la modification (${response.status}) : ${detail}`);
  }
  console.log(`Abonnement mis à jour : ${JSON.stringify(request.body)}`);
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function header(req: IncomingMessage, name: string) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function listen() {
  const seen = new Set<string>();
  const server = createServer(async (req, res) => {
    const reply = (status: number, message: string) => {
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(message);
    };
    const path = req.url?.split("?")[0] ?? "";
    if (req.method === "GET" && path === "/done")
      return reply(200, "Paiement de test terminé. Regardez le terminal.");
    const provider = path.replace("/webhooks/", "");
    if (req.method !== "POST" || !isSandboxProvider(provider))
      return reply(404, "Not found");
    const secret = process.env[webhookSecretName(provider)]?.trim();
    if (!secret) {
      console.error(`Variable manquante : ${webhookSecretName(provider)}`);
      return reply(503, "Webhook unavailable");
    }
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      return reply(413, "Payload too large");
    }
    const id = header(req, "webhook-id");
    const valid = verifyWebhookSignature({
      secret,
      body,
      id,
      timestamp: header(req, "webhook-timestamp"),
      signature: header(req, "webhook-signature"),
    });
    if (!valid) {
      console.error(`[${provider}] Signature refusée.`);
      return reply(403, "Invalid signature");
    }
    if (seen.has(`${provider}:${id}`)) return reply(202, "Duplicate");
    seen.add(`${provider}:${id}`);
    try {
      console.log(JSON.stringify(summarizeEvent(provider, JSON.parse(body))));
    } catch {
      console.error(`[${provider}] Événement illisible.`);
    }
    reply(202, "OK");
  });
  // Local uniquement : les CLI Polar et Dodo relaient les événements ici.
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Écoute sur http://localhost:${PORT}/webhooks/polar`);
    console.log(`Écoute sur http://localhost:${PORT}/webhooks/dodo`);
  });
}

async function main() {
  const [command, provider, plan] = process.argv.slice(2);
  if (command === "listen") return listen();
  if (command === "checkout" && isSandboxProvider(provider))
    return checkout(provider, plan);
  // Arguments des commandes Dodo : <sub_id> puis l'option.
  if (command === "dodo-bill-soon" && provider)
    return updateDodoSubscription(provider, {
      action: "bill-soon",
      minutes: Number(plan ?? 3),
    });
  if (command === "dodo-cancel" && provider && (!plan || plan === "now"))
    return updateDodoSubscription(provider, { action: "cancel-now" });
  if (command === "dodo-cancel" && provider && plan === "period-end")
    return updateDodoSubscription(provider, { action: "cancel-at-period-end" });
  console.error(USAGE);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Échec inattendu.");
  process.exitCode = 1;
});
