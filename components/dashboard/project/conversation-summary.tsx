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

/** Sections du résumé, écrites l’une après l’autre. */
function SummarySections({ result, footer }: { result: Result; footer?: string }) {
  const sections = [
    { title: "L’essentiel", content: result.summary.summary },
    { title: "Analyse", content: result.summary.assessment },
    ...(result.summary.nextSteps.length
      ? [
          {
            title: "Prochaines actions",
            content: result.summary.nextSteps.map((step) => `• ${step}`).join("\n"),
          },
        ]
      : []),
  ];
  const [written, setWritten] = useState(0);
  const caveat = result.partial
    ? "Basé sur les 200 derniers messages. À vérifier avant d’agir."
    : "Analyse ponctuelle, à vérifier avant d’agir.";

  return (
    <>
      {sections.slice(0, written + 1).map((section, index) => (
        <section
          key={section.title}
          className="space-y-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
        >
          <h3 className="font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground">
            {section.title}
          </h3>
          <AiResponseText
            animate
            content={section.content}
            onDone={() => setWritten((count) => Math.max(count, index + 1))}
          />
        </section>
      ))}
      {written >= sections.length && (
        <p className="text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
          {footer ? `${footer} · ` : ""}
          {caveat}
        </p>
      )}
    </>
  );
}

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

  return (
    <section aria-labelledby={`summary-${contactId}`} className="py-5">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h2
          id={`summary-${contactId}`}
          className="font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
        >
          Résumé IA
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={pending || !enabled}
          onClick={() => void generate()}
          title={enabled ? undefined : "Disponible après un premier message du client."}
          className="-mr-2"
        >
          {pending ? (
            <Loader2
              data-icon="inline-start"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : result ? (
            <RefreshCw data-icon="inline-start" />
          ) : (
            <Sparkles data-icon="inline-start" />
          )}
          {result ? "Actualiser" : "Générer"}
        </Button>
      </div>

      <div aria-live="polite" aria-busy={pending}>
        {pending ? (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
            <span className="sr-only">Génération du résumé…</span>
          </div>
        ) : (
          result && (
            <div className="space-y-3 pt-2 [&_.leading-7]:leading-5 [&_p]:text-xs">
              <SummarySections key={result.generatedAt} result={result} />
            </div>
          )
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
    const timer = setTimeout(() => void generate());
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-labelledby={`summary-view-${contactId}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="absolute inset-0 z-20 flex flex-col bg-background motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
    >
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2
            id={`summary-view-${contactId}`}
            className="font-heading text-base font-semibold tracking-tight"
          >
            Résumé IA
          </h2>
          <p className="truncate text-xs text-muted-foreground">
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
        >
          <X aria-hidden="true" />
        </Button>
      </header>

      <div aria-live="polite" aria-busy={pending} className="min-h-0 flex-1">
        {!enabled ? (
          <p className="px-4 py-8 text-sm text-muted-foreground sm:px-6">
            Le résumé sera disponible après un premier message du client.
          </p>
        ) : pending && !result ? (
          <div className="mx-auto max-w-2xl space-y-3 px-4 py-6 sm:px-6">
            <p className="ai-thinking-shimmer text-sm">Lecture de la conversation…</p>
            {["w-full", "w-11/12", "w-4/5"].map((width) => (
              <Skeleton key={width} className={`h-3 ${width}`} />
            ))}
          </div>
        ) : result ? (
          <ScrollFadeArea
            label="Résumé IA de la conversation"
            surface="background"
            className="h-full"
          >
            <div className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
              <SummarySections
                key={result.generatedAt}
                result={result}
                footer={`Généré à ${new Date(result.generatedAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
              />
            </div>
          </ScrollFadeArea>
        ) : null}
        {error && (
          <div className="space-y-3 px-4 py-6 sm:px-6">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
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
