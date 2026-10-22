"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
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

/**
 * Résumé IA affiché à la place des messages (écrans sans fiche contact).
 * Ouvert explicitement par l'utilisateur : la génération démarre à l'ouverture.
 */
export function ConversationSummaryView({
  projectId,
  contactId,
  contactName,
  enabled,
  onClose,
}: {
  projectId: string;
  contactId: string;
  contactName: string;
  enabled: boolean;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function generate() {
    if (lock.current || !enabled) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const response = await summarizeConversation({ projectId, contactId });
      if (response.success) setResult(response);
      else setError(response.error);
    } catch {
      setError(
        "Impossible de générer le résumé. Vérifiez votre connexion et réessayez.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  useEffect(() => {
    // Génération lancée hors du rendu ; l’annulation évite un double appel
    // quand React rejoue l’effet en développement.
    const frame = requestAnimationFrame(() => void generate());
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-labelledby={`summary-view-${contactId}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="absolute inset-0 z-20 flex flex-col bg-primary text-primary-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-primary-foreground/15 px-4 py-3 sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/10">
          <Sparkles aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={`summary-view-${contactId}`}
            className="font-heading text-base font-semibold tracking-tight"
          >
            Résumé IA
          </h2>
          <p className="truncate text-xs text-primary-foreground/70">
            Conversation avec {contactName}
          </p>
        </div>
        {result && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending || !enabled}
            onClick={() => void generate()}
            aria-label="Régénérer le résumé"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <RefreshCw
              aria-hidden="true"
              className={
                pending ? "animate-spin motion-reduce:animate-none" : undefined
              }
            />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Fermer le résumé et revenir aux messages"
          autoFocus
          className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <X aria-hidden="true" />
        </Button>
      </header>

      <div aria-live="polite" aria-busy={pending} className="min-h-0 flex-1">
        {!enabled ? (
          <p className="px-4 py-8 text-sm text-primary-foreground/80 sm:px-6">
            Le résumé sera disponible après un premier message du client.
          </p>
        ) : pending && !result ? (
          <div className="space-y-3 px-4 py-6 sm:px-6">
            <p className="flex items-center gap-2 text-xs text-primary-foreground/70">
              <Loader2
                aria-hidden="true"
                className="size-3.5 animate-spin motion-reduce:animate-none"
              />
              Génération du résumé…
            </p>
            {["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"].map(
              (width, index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className={`h-3 animate-pulse rounded-full bg-primary-foreground/15 motion-reduce:animate-none ${width}`}
                />
              ),
            )}
          </div>
        ) : result ? (
          <ScrollFadeArea
            label="Résumé IA de la conversation"
            surface="primary"
            className="h-full"
          >
            <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
              <AiResponseText
                key={result.generatedAt}
                inverse
                animate
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
              <p className="text-xs text-primary-foreground/60">
                {result.partial
                  ? "Basé sur les 200 derniers messages. À vérifier avant d’agir."
                  : "Analyse ponctuelle, à vérifier avant d’agir."}
              </p>
            </div>
          </ScrollFadeArea>
        ) : null}
        {error && (
          <div className="space-y-3 px-4 py-6 sm:px-6">
            <p role="alert" className="text-sm text-primary-foreground">
              {error}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => void generate()}
            >
              <RefreshCw data-icon="inline-start" />
              Réessayer
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
