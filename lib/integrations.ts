import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { INTEGRATION_EVENT_IDS, emitIntegrationEvent } from "./integration-events";
import { planAllows, requirePlanFeature } from "./plan-features";
import { requireProjectAdmin } from "./project-settings";
import { SafeFetchError, parsePublicUrl, safeRequest, type SafeRequestInit } from "./safe-fetch";
import { openSecret, sealSecret } from "./secret-box";

// Safe to show as is to the user.
export class IntegrationError extends Error {}

export const MAX_ENDPOINTS = 5;
export const MAX_DELIVERY_ATTEMPTS = 8;
export const DISABLE_AFTER_FAILURES = 20;
// 1 min, 5 min, 15 min, 1 h, 3 h, 6 h, 12 h: about 22 h of retries in total.
const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 10_800_000, 21_600_000, 43_200_000];

export const WebhookInputSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom à ce webhook.").max(80, "80 caractères au maximum."),
  url: z.string().trim().min(1, "Saisissez l’adresse du webhook.").max(2000),
  events: z.array(z.enum(INTEGRATION_EVENT_IDS)).min(1, "Choisissez au moins un événement."),
});

type Admin = { projectId: string; userId: string };

async function lockIntegrationsAdmin(tx: Prisma.TransactionClient, { projectId, userId }: Admin) {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
  const { project } = await requireProjectAdmin(tx, projectId, userId);
  if (project.deletionPending) throw new IntegrationError("Ce projet est en cours de suppression.");
  requirePlanFeature(project.plan, "integrations");
  return project;
}

/** Google Sheets est inclus partout ; un webhook demande l’offre Pro ou Business. */
async function requireEndpointPlan(
  tx: Prisma.TransactionClient,
  plan: unknown,
  { projectId, endpointId }: { projectId: string; endpointId: string },
) {
  if (planAllows(plan, "webhooks")) return;
  const endpoint = await tx.integrationEndpoint.findFirst({
    where: { id: endpointId, projectId },
    select: { kind: true },
  });
  if (endpoint?.kind === "WEBHOOK") requirePlanFeature(plan, "webhooks");
}

function newSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function webhookUrlError(error: unknown) {
  return error instanceof SafeFetchError && error.code === "BLOCKED_ADDRESS"
    ? "Cette adresse n’est pas accessible publiquement."
    : "Saisissez une adresse publique en https://, par exemple celle fournie par Make ou Zapier.";
}

/* -------------------------------------------------------------------------- */
/* Signature                                                                   */
/* -------------------------------------------------------------------------- */

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">`, like Stripe. */
export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

/** Reference verification, also documented for integrators. */
export function verifySignature(
  secret: string,
  body: string,
  header: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
) {
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=", 2)));
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp) || Math.abs(now - timestamp) > toleranceSeconds || !parts.v1) return false;
  const expected = Buffer.from(signPayload(secret, body, timestamp).split("v1=")[1], "hex");
  const received = Buffer.from(String(parts.v1), "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

export async function createWebhook(
  db: PrismaClient,
  input: Admin & z.input<typeof WebhookInputSchema>,
) {
  const data = WebhookInputSchema.parse(input);
  let url: URL;
  try {
    url = parsePublicUrl(data.url);
  } catch (error) {
    throw new IntegrationError(webhookUrlError(error));
  }
  return db.$transaction(async (tx) => {
    const project = await lockIntegrationsAdmin(tx, input);
    requirePlanFeature(project.plan, "webhooks");
    const count = await tx.integrationEndpoint.count({ where: { projectId: input.projectId } });
    if (count >= MAX_ENDPOINTS) {
      throw new IntegrationError(`${MAX_ENDPOINTS} intégrations au maximum par projet.`);
    }
    const id = randomUUID();
    const secret = newSecret();
    await tx.integrationEndpoint.create({
      data: {
        id,
        projectId: input.projectId,
        kind: "WEBHOOK",
        name: data.name,
        url: url.toString(),
        secretCiphertext: sealSecret(secret, id),
        events: data.events,
        createdById: input.userId,
      },
    });
    // Shown once: only its encrypted form is kept.
    return { id, secret };
  });
}

export async function updateEndpoint(
  db: PrismaClient,
  input: Admin & { endpointId: string; events?: string[]; enabled?: boolean },
) {
  const events = input.events ? z.array(z.enum(INTEGRATION_EVENT_IDS)).min(1).parse(input.events) : undefined;
  await db.$transaction(async (tx) => {
    const project = await lockIntegrationsAdmin(tx, input);
    // Un webhook reste désactivable après un passage en Starter.
    if (input.enabled !== false || events) await requireEndpointPlan(tx, project.plan, input);
    const result = await tx.integrationEndpoint.updateMany({
      where: { id: input.endpointId, projectId: input.projectId },
      data: {
        ...(events ? { events } : {}),
        ...(input.enabled !== undefined
          ? { enabled: input.enabled, ...(input.enabled ? { consecutiveFailures: 0, disabledReason: null } : {}) }
          : {}),
      },
    });
    if (!result.count) throw new IntegrationError("Intégration introuvable.");
  });
}

export async function rotateWebhookSecret(db: PrismaClient, input: Admin & { endpointId: string }) {
  return db.$transaction(async (tx) => {
    const project = await lockIntegrationsAdmin(tx, input);
    requirePlanFeature(project.plan, "webhooks");
    const endpoint = await tx.integrationEndpoint.findFirst({
      where: { id: input.endpointId, projectId: input.projectId, kind: "WEBHOOK" },
      select: { id: true },
    });
    if (!endpoint) throw new IntegrationError("Webhook introuvable.");
    const secret = newSecret();
    await tx.integrationEndpoint.update({
      where: { id: endpoint.id },
      data: { secretCiphertext: sealSecret(secret, endpoint.id) },
    });
    return { secret };
  });
}

export async function deleteEndpoint(
  db: PrismaClient,
  input: Admin & { endpointId: string },
  revokeGoogle?: (refreshToken: string) => Promise<void>,
) {
  const removed = await db.$transaction(async (tx) => {
    // Removing access stays possible even after a downgrade.
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    await requireProjectAdmin(tx, input.projectId, input.userId);
    const endpoint = await tx.integrationEndpoint.findFirst({
      where: { id: input.endpointId, projectId: input.projectId },
      select: { id: true, refreshTokenCiphertext: true },
    });
    if (!endpoint) throw new IntegrationError("Intégration introuvable.");
    await tx.integrationEndpoint.delete({ where: { id: endpoint.id } });
    return endpoint;
  });
  if (removed.refreshTokenCiphertext && revokeGoogle) {
    await revokeGoogle(openSecret(removed.refreshTokenCiphertext, removed.id)).catch(() => undefined);
  }
}

export async function sendTestEvent(db: PrismaClient, input: Admin & { endpointId: string }) {
  await db.$transaction(async (tx) => {
    const project = await lockIntegrationsAdmin(tx, input);
    await requireEndpointPlan(tx, project.plan, input);
    const queued = await emitIntegrationEvent(
      tx,
      input.projectId,
      "test.ping",
      { message: "Test envoyé depuis ExtravertyAI." },
      input.endpointId,
    );
    if (!queued) throw new IntegrationError("Intégration introuvable.");
  });
}

export async function redeliver(db: PrismaClient, input: Admin & { deliveryId: string }) {
  await db.$transaction(async (tx) => {
    const project = await lockIntegrationsAdmin(tx, input);
    const delivery = await tx.integrationDelivery.findFirst({
      where: { id: input.deliveryId, projectId: input.projectId },
      select: { endpointId: true },
    });
    if (delivery) await requireEndpointPlan(tx, project.plan, { ...input, endpointId: delivery.endpointId });
    const result = await tx.integrationDelivery.updateMany({
      where: { id: input.deliveryId, projectId: input.projectId, state: "FAILED" },
      data: { state: "QUEUED", attempts: 0, availableAt: new Date(), lastError: null },
    });
    if (!result.count) throw new IntegrationError("Seuls les envois en échec peuvent être relancés.");
  });
}

export async function integrationsOverview(db: PrismaClient, projectId: string) {
  const [endpoints, deliveries] = await Promise.all([
    db.integrationEndpoint.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        kind: true,
        name: true,
        url: true,
        events: true,
        enabled: true,
        consecutiveFailures: true,
        disabledReason: true,
        spreadsheetUrl: true,
        googleEmail: true,
        lastDeliveryAt: true,
        createdAt: true,
      },
    }),
    db.integrationDelivery.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        endpointId: true,
        event: true,
        state: true,
        attempts: true,
        lastStatus: true,
        lastError: true,
        deliveredAt: true,
        createdAt: true,
      },
    }),
  ]);
  return { endpoints, deliveries };
}

/* -------------------------------------------------------------------------- */
/* Delivery worker                                                             */
/* -------------------------------------------------------------------------- */

export type DeliveryJob = {
  id: string;
  projectId: string;
  endpointId: string;
  event: string;
  payload: unknown;
  attempts: number;
  token: string;
};

export type DeliveryTransport = {
  webhook: (url: string, init: SafeRequestInit) => Promise<{ status: number }>;
  sheets: (endpoint: {
    id: string;
    spreadsheetId: string;
    sheetName: string;
    refreshTokenCiphertext: string;
  }, job: DeliveryJob) => Promise<{ status: number }>;
};

export const defaultTransport: Pick<DeliveryTransport, "webhook"> = {
  webhook: async (url, init) => {
    const response = await safeRequest(url, init);
    return { status: response.status };
  },
};

export async function claimDelivery(prisma: PrismaClient): Promise<DeliveryJob | null> {
  const token = randomUUID();
  const [row] = await prisma.$queryRaw<Array<Omit<DeliveryJob, "token">>>`
    UPDATE integration_delivery SET state = 'DELIVERING', "leaseToken" = ${token}::uuid,
      "leaseUntil" = clock_timestamp() + interval '2 minutes', attempts = attempts + 1
    WHERE id = (
      SELECT d.id FROM integration_delivery d
      JOIN integration_endpoint e ON e.id = d."endpointId" AND e.enabled
      WHERE (d.state = 'QUEUED' AND d."availableAt" <= clock_timestamp())
        OR (d.state = 'DELIVERING' AND d."leaseUntil" < clock_timestamp())
      ORDER BY d."availableAt", d.id LIMIT 1 FOR UPDATE OF d SKIP LOCKED)
    RETURNING id, "projectId", "endpointId", event, payload, attempts`;
  return row ? { ...row, token } : null;
}

function describeError(error: unknown) {
  if (error instanceof SafeFetchError) {
    return {
      INVALID_URL: "Adresse invalide.",
      BLOCKED_ADDRESS: "Adresse non publique.",
      TOO_LARGE: "Réponse trop volumineuse.",
      TIMEOUT: "Délai dépassé (10 s).",
      TOO_MANY_REDIRECTS: "Trop de redirections.",
      NETWORK: "Destinataire injoignable.",
    }[error.code] ?? "Erreur réseau.";
  }
  if (error instanceof IntegrationError) return error.message;
  return "Erreur inattendue.";
}

export async function runDelivery(
  prisma: PrismaClient,
  job: DeliveryJob,
  transport: DeliveryTransport,
) {
  const endpoint = await prisma.integrationEndpoint.findUnique({ where: { id: job.endpointId } });
  if (!endpoint) return;
  let status: number | null = null;
  let error: string | null = null;
  let permanent = false;
  try {
    if (endpoint.kind === "WEBHOOK") {
      if (!endpoint.url || !endpoint.secretCiphertext) throw new IntegrationError("Webhook incomplet.");
      const body = JSON.stringify({ id: job.id, ...(job.payload as object) });
      const result = await transport.webhook(endpoint.url, {
        method: "POST",
        body,
        timeoutMs: 10_000,
        maxBytes: 64 * 1024,
        headers: {
          "content-type": "application/json",
          "x-extraverty-event": job.event,
          "x-extraverty-delivery": job.id,
          "x-extraverty-signature": signPayload(openSecret(endpoint.secretCiphertext, endpoint.id), body),
        },
      });
      status = result.status;
    } else {
      if (!endpoint.spreadsheetId || !endpoint.sheetName || !endpoint.refreshTokenCiphertext) {
        throw new IntegrationError("Connexion Google incomplète.");
      }
      const result = await transport.sheets(
        {
          id: endpoint.id,
          spreadsheetId: endpoint.spreadsheetId,
          sheetName: endpoint.sheetName,
          refreshTokenCiphertext: endpoint.refreshTokenCiphertext,
        },
        job,
      );
      status = result.status;
      // Revoked access or deleted spreadsheet: retrying cannot help.
      permanent = status === 401 || status === 403 || status === 404;
    }
    if (status < 200 || status >= 300) error = `Réponse HTTP ${status}.`;
  } catch (caught) {
    error = describeError(caught);
    permanent = caught instanceof SafeFetchError && ["INVALID_URL", "BLOCKED_ADDRESS"].includes(caught.code);
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.integrationDelivery.findUnique({ where: { id: job.id } });
    if (!current || current.leaseToken !== job.token) return;
    if (!error) {
      await tx.integrationDelivery.update({
        where: { id: job.id },
        data: { state: "DELIVERED", lastStatus: status, lastError: null, deliveredAt: new Date(), leaseToken: null, leaseUntil: null },
      });
      await tx.integrationEndpoint.update({
        where: { id: endpoint.id },
        data: { consecutiveFailures: 0, lastDeliveryAt: new Date() },
      });
      return;
    }
    const exhausted = permanent || job.attempts >= MAX_DELIVERY_ATTEMPTS;
    await tx.integrationDelivery.update({
      where: { id: job.id },
      data: {
        state: exhausted ? "FAILED" : "QUEUED",
        lastStatus: status,
        lastError: error.slice(0, 300),
        availableAt: new Date(Date.now() + BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)]),
        leaseToken: null,
        leaseUntil: null,
      },
    });
    const failures = endpoint.consecutiveFailures + 1;
    const disable = failures >= DISABLE_AFTER_FAILURES || (permanent && endpoint.kind === "GOOGLE_SHEETS");
    await tx.integrationEndpoint.update({
      where: { id: endpoint.id },
      data: {
        consecutiveFailures: failures,
        ...(disable
          ? {
              enabled: false,
              disabledReason:
                endpoint.kind === "GOOGLE_SHEETS" && permanent
                  ? "Accès Google révoqué ou feuille supprimée. Reconnectez Google Sheets."
                  : `${failures} échecs consécutifs : vérifiez l’adresse puis réactivez.`,
            }
          : {}),
      },
    });
  });
}
