"use client";

import { useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { summarizeConversation } from "@/app/actions/summarizeConversation";
import { AiResponseText } from "./ai-response";
import { ScrollFadeArea } from "./scroll-fade-area";

type Result = Extract<
  Awaited<ReturnType<typeof summarizeConversation>>,
  { success: true }
>;

/**
 * Inline AI summary for the contact panel. Generated on demand only:
 * the summary is a paid AI call and is never triggered automatically.
 */
export function ConversationSummaryCard({
  projectId,
  contactId,
  enabled,
}: {
  projectId: string;
  contactId: string;
  enabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [animateResult, setAnimateResult] = useState(false);
  const lock = useRef(false);

  async function generate() {
    if (lock.current || !enabled) return;
    lock.current = true;
    setPending(true);
    setAnimateResult(false);
    setError("");
    try {
      const response = await summarizeConversation({ projectId, contactId });
      if (response.success) {
        setResult(response);
        setAnimateResult(true);
      } else setError(response.error);
    } catch {
      setError(
        "Impossible de générer le résumé. Vérifiez votre connexion et réessayez.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby={`summary-${contactId}`}
      className="rounded-xl border bg-muted/40 p-4"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2
          id={`summary-${contactId}`}
          className="flex items-center gap-1.5 font-heading text-sm font-semibold tracking-normal"
        >
          <Sparkles aria-hidden="true" className="size-3.5" />
          Résumé IA
        </h2>
        {result && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={pending || !enabled}
            onClick={() => void generate()}
            aria-label="Actualiser le résumé"
          >
            <RefreshCw
              aria-hidden="true"
              className={
                pending ? "animate-spin motion-reduce:animate-none" : undefined
              }
            />
          </Button>
        )}
      </div>

      <div aria-live="polite" aria-busy={pending}>
        {pending ? (
          <div className="h-56 space-y-2 py-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
            <span className="sr-only">Génération du résumé…</span>
          </div>
        ) : result ? (
          <ScrollFadeArea label="Résumé IA de la conversation" className="h-56">
            <div className="space-y-3 pb-2 text-xs [&_p]:text-xs">
              <AiResponseText
                key={result.generatedAt}
                animate={animateResult}
                content={[
                  `L’essentiel\n${result.summary.summary}`,
                  `Analyse\n${result.summary.assessment}`,
                  ...(result.summary.nextSteps.length
                    ? [
                        `Prochaines actions\n${result.summary.nextSteps.map((step) => `• ${step}`).join("\n")}`,
                      ]
                    : []),
                ].join("\n\n")}
              />
              <p className="text-muted-foreground">
                {result.partial
                  ? "Basé sur les 200 derniers messages. À vérifier avant d’agir."
                  : "Analyse ponctuelle, à vérifier avant d’agir."}
              </p>
            </div>
          </ScrollFadeArea>
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {enabled
                ? "Comprenez la conversation en quelques lignes avant de répondre."
                : "Disponible après un premier message du client."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!enabled}
              onClick={() => void generate()}
            >
              <Sparkles data-icon="inline-start" />
              Générer le résumé
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
