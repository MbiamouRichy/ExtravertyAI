import { randomUUID } from "node:crypto";
import { PostHog } from "posthog-node";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if ((!token || !host) && process.env.NODE_ENV !== "production") {
  const variable = !token
    ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
    : "NEXT_PUBLIC_POSTHOG_HOST";
  console.warn(
    `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
  );
}

const posthog =
  token && host
    ? new PostHog(token, {
        host,
        flushAt: 1,
        flushInterval: 0,
        requestTimeout: 2000,
        fetchRetryCount: 0,
        // Les prompts citent les conversations des clients de nos clients :
        // aucun contenu ne quitte nos serveurs, seulement des mesures.
        privacyMode: true,
      })
    : null;

export type AiObservation = {
  sessionId: string | null;
  traceId: string;
  distinctId?: string;
  spanName: string;
  flush?: boolean;
};

export function createAiObservation(
  sessionId: string | null,
  options: Pick<AiObservation, "distinctId" | "spanName" | "flush">,
): AiObservation {
  return { sessionId, traceId: randomUUID(), ...options };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/** Best-effort manual AI capture. It never changes a model request or its outcome. */
export async function captureAiGeneration(
  observation: AiObservation | undefined,
  generation: {
    model: string;
    output?: unknown;
    status?: number;
    latencyMs: number;
    error?: string;
  },
) {
  if (!posthog || !observation) return;
  try {
    const output = record(generation.output);
    const usage = record(output.usage);
    const rawChoices = Array.isArray(output.choices) ? output.choices : [];
    const cost = positiveNumber(usage.cost);
    posthog.capture({
      // Un travail de fond (worker) n'a pas d'utilisateur : l'événement reste
      // anonyme plutôt que de créer une personne par contact ou par projet.
      distinctId: observation.distinctId ?? observation.traceId,
      event: "$ai_generation",
      properties: {
        ...(observation.distinctId ? {} : { $process_person_profile: false }),
        $ai_trace_id: observation.traceId,
        $ai_session_id: observation.sessionId,
        $ai_span_id: randomUUID(),
        $ai_span_name: observation.spanName,
        $ai_model:
          typeof output.model === "string" && output.model.trim()
            ? output.model
            : generation.model,
        $ai_provider: "openrouter",
        // Ni $ai_input ni $ai_output_choices : jetons, coût et latence suffisent.
        $ai_input_tokens: positiveNumber(usage.prompt_tokens ?? usage.input_tokens),
        $ai_output_tokens: positiveNumber(usage.completion_tokens ?? usage.output_tokens),
        $ai_cache_read_input_tokens: positiveNumber(
          record(usage.prompt_tokens_details).cached_tokens,
        ),
        $ai_latency: generation.latencyMs / 1000,
        $ai_http_status: generation.status,
        $ai_is_error: !!generation.error || (generation.status !== undefined && generation.status >= 400),
        $ai_error: generation.error,
        $ai_stop_reason: record(rawChoices[0]).finish_reason,
        $ai_total_cost_usd: cost,
        $ai_cost_passthrough: cost === undefined ? undefined : true,
      },
    });
    if (observation.flush) await posthog.flush().catch(() => undefined);
  } catch {
    // Observability must never interrupt an already-completed model request.
  }
}

export async function shutdownAiObservability() {
  await posthog?.shutdown(3000).catch(() => undefined);
}
