import type { PrismaClient } from "../src/generated/prisma/client";

/** Usages qui appellent le modèle, tels qu’enregistrés dans `ai_usage.feature`. */
export const AI_FEATURES = [
  "reply",
  "sandbox",
  "summary",
  "writing",
  "system_message",
  "image",
  "audio",
  "instinct",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export type AiUsageReading = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  /** Millionièmes de dollar ; null si le fournisseur ne l’a pas communiqué. */
  costMicros: number | null;
};

const INT_MAX = 2_000_000_000;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(Math.round(value), INT_MAX)
    : 0;
}

/**
 * Lit l’objet `usage` qu’OpenRouter renvoie avec chaque réponse : chat
 * (`prompt_tokens`, `completion_tokens`) ou transcription (`input_tokens`,
 * `output_tokens`). `cost` est en crédits OpenRouter, c’est-à-dire en dollars.
 */
export function readAiUsage(payload: unknown, fallbackModel: string): AiUsageReading {
  const body = record(payload);
  const usage = record(body.usage);
  const cost = usage.cost;
  const model =
    typeof body.model === "string" && body.model.trim() ? body.model.trim() : fallbackModel;
  return {
    model: (model || "inconnu").slice(0, 200),
    promptTokens: count(usage.prompt_tokens ?? usage.input_tokens),
    completionTokens: count(usage.completion_tokens ?? usage.output_tokens),
    cachedTokens: count(record(usage.prompt_tokens_details).cached_tokens),
    costMicros:
      typeof cost === "number" && Number.isFinite(cost) && cost >= 0
        ? Math.min(Math.round(cost * 1_000_000), INT_MAX)
        : null,
  };
}

/** Reçoit la réponse brute du fournisseur et le modèle demandé. */
export type AiMeter = (payload: unknown, model: string) => Promise<void>;

/**
 * Compteur d’un usage pour un projet. L’enregistrement est un complément :
 * il n’interrompt jamais la réponse, même si la base refuse la ligne.
 */
export function aiMeter(
  db: Pick<PrismaClient, "aiUsage">,
  projectId: string,
  feature: AiFeature,
): AiMeter {
  return async (payload, model) => {
    try {
      await db.aiUsage.create({
        data: { projectId, feature, ...readAiUsage(payload, model) },
        select: { id: true },
      });
    } catch {
      // Sans incidence pour l’utilisateur : seule la mesure est perdue.
    }
  };
}
