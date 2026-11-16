import { z } from "zod";
import type { AiFeature } from "./ai-usage";

/**
 * Complétions OpenRouter partagées par les fonctions IA, avec un modèle de
 * secours facultatif (`OPENROUTER_FALLBACK_MODEL`).
 *
 * La bascule n’a lieu que si le modèle principal est indisponible : délai
 * dépassé, erreur réseau, statut 408, 429 ou 5xx, ou génération interrompue
 * par le fournisseur. Un refus, une requête invalide ou un compte bloqué
 * (clé, crédits) ne basculent jamais : le secours partage la même clé, les
 * mêmes consignes et le même quota, il ne sert pas à contourner un refus.
 *
 * Le paramètre `models` d’OpenRouter n’est pas utilisé : il bascule aussi sur
 * un refus de modération.
 */
export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export const ModelIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .regex(/^[a-z0-9][a-z0-9._-]*\/[a-zA-Z0-9._:-]+$/);

const UNAVAILABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Trois échecs du principal en une minute : le secours répond seul deux minutes. */
const BREAKER_THRESHOLD = 3;
const BREAKER_WINDOW_MS = 60_000;
const BREAKER_OPEN_MS = 120_000;
type Breaker = { failures: number[]; openUntil: number };
const breakers = new Map<string, Breaker>();

/** Réservé aux tests : l’état du disjoncteur vit dans la mémoire du processus. */
export function resetOpenRouterBreakers() {
  breakers.clear();
}

let invalidFallbackReported = false;

/** Modèle de secours configuré, ou null s’il est absent, invalide ou identique au principal. */
export function fallbackModel(primary: string): string | null {
  const raw = process.env.OPENROUTER_FALLBACK_MODEL?.trim();
  if (!raw) return null;
  const parsed = ModelIdSchema.safeParse(raw);
  if (!parsed.success) {
    if (!invalidFallbackReported) {
      invalidFallbackReported = true;
      console.error("[ai] OPENROUTER_FALLBACK_MODEL invalide : aucun secours.");
    }
    return null;
  }
  return parsed.data === primary ? null : parsed.data;
}

/** Réponse illisible ou trop volumineuse : jamais une cause de bascule. */
export class OpenRouterBodyError extends Error {
  constructor() {
    super("OPENROUTER_INVALID_BODY");
  }
}

export type ChatPayload = {
  model?: unknown;
  error?: unknown;
  choices?: Array<{
    finish_reason?: unknown;
    message?: { content?: unknown; refusal?: unknown };
  }>;
};

/** `payload` n’est lu que pour un statut 200 ; `model` est celui qui a été appelé. */
export type ChatResult = { status: number; payload: ChatPayload | undefined; model: string };

type Outcome = {
  unavailable: boolean;
  reason?: string;
  result?: ChatResult;
  error?: unknown;
};

function isTimeout(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function readLimited(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) throw new OpenRouterBodyError();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new OpenRouterBodyError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

function interrupted(payload: ChatPayload) {
  const error = payload.error as { code?: unknown } | undefined;
  return (
    (typeof error?.code === "number" && UNAVAILABLE_STATUSES.has(error.code)) ||
    payload.choices?.[0]?.finish_reason === "error"
  );
}

async function attempt(
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  maxBytes: number,
): Promise<Outcome> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { unavailable: false, error: new Error("OPENROUTER_CONFIG_MISSING") };
  try {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "ExtravertyAI",
      },
      body: JSON.stringify({ ...body, model }),
    });
    if (!response.ok) {
      // Jamais lu ni journalisé : le corps d’erreur peut citer la conversation.
      await response.body?.cancel().catch(() => undefined);
      const result = { status: response.status, payload: undefined, model };
      return UNAVAILABLE_STATUSES.has(response.status)
        ? { unavailable: true, reason: `HTTP_${response.status}`, result }
        : { unavailable: false, result };
    }
    let payload: ChatPayload;
    try {
      payload = JSON.parse(await readLimited(response.body, maxBytes));
    } catch (error) {
      if (isTimeout(error)) throw error;
      return { unavailable: false, error: new OpenRouterBodyError() };
    }
    const result = { status: 200, payload, model };
    return payload && typeof payload === "object" && interrupted(payload)
      ? { unavailable: true, reason: "PROVIDER_ERROR", result }
      : { unavailable: false, result };
  } catch (error) {
    return { unavailable: true, reason: isTimeout(error) ? "TIMEOUT" : "NETWORK", error };
  }
}

function settle(outcome: Outcome): ChatResult {
  if (outcome.result) return outcome.result;
  throw outcome.error;
}

const answered = (outcome: Outcome) => !outcome.unavailable && outcome.result?.status === 200;

function breakerFor(model: string) {
  let breaker = breakers.get(model);
  if (!breaker) breakers.set(model, (breaker = { failures: [], openUntil: 0 }));
  return breaker;
}

function recordFailure(model: string, backup: string | null) {
  const breaker = breakerFor(model);
  const now = Date.now();
  breaker.failures = breaker.failures.filter((at) => now - at < BREAKER_WINDOW_MS);
  breaker.failures.push(now);
  if (backup && breaker.failures.length >= BREAKER_THRESHOLD && breaker.openUntil <= now) {
    breaker.openUntil = now + BREAKER_OPEN_MS;
    breaker.failures = [];
    console.warn("[ai] Modèle principal indisponible : secours direct pendant 2 minutes.", {
      model,
      fallback: backup,
    });
  }
}

/**
 * Envoie `body` (sans `model`) au modèle principal, puis au secours s’il est
 * indisponible. Quand les deux échouent, c’est l’échec du principal qui est
 * rendu : la tâche est réessayée plus tard comme avant. Un statut autre que 200
 * est rendu sans corps ; une erreur réseau ou un délai dépassé sont relancés.
 */
export async function openRouterChat(request: {
  feature: AiFeature;
  model: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  fallbackTimeoutMs?: number;
  maxBytes?: number;
}): Promise<ChatResult> {
  const maxBytes = request.maxBytes ?? 256_000;
  const backup = fallbackModel(request.model);
  const backupTimeout = request.fallbackTimeoutMs ?? request.timeoutMs;
  const open = !!backup && breakerFor(request.model).openUntil > Date.now();
  if (backup && open) {
    const rescue = await attempt(backup, request.body, backupTimeout, maxBytes);
    if (answered(rescue)) return rescue.result!;
  }
  const main = await attempt(request.model, request.body, request.timeoutMs, maxBytes);
  if (!main.unavailable) {
    breakerFor(request.model).failures = [];
    breakerFor(request.model).openUntil = 0;
    return settle(main);
  }
  recordFailure(request.model, backup);
  if (!backup || open) return settle(main);
  console.warn("[ai] Bascule vers le modèle de secours.", {
    feature: request.feature,
    reason: main.reason,
    fallback: backup,
  });
  const rescue = await attempt(backup, request.body, backupTimeout, maxBytes);
  if (answered(rescue)) return rescue.result!;
  console.warn("[ai] Le modèle de secours n’a pas répondu non plus.", {
    feature: request.feature,
    reason: rescue.reason ?? `HTTP_${rescue.result?.status ?? "INVALID"}`,
  });
  return settle(main);
}
