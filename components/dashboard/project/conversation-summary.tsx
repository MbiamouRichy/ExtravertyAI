"use client";

import { useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarizeConversation } from "@/app/actions/summarizeConversation";
import { AiResponseText, AiThinking } from "./ai-response";

type Result = Extract<
  Awaited<ReturnType<typeof summarizeConversation>>,
  { success: true }
>;

export function ConversationSummaryButton({
  projectId,
  contactId,
  contactName,
  enabled,
  container,
  onOpenChange,
}: {
  projectId: string;
  contactId: string;
  contactName: string;
  enabled: boolean;
  container: HTMLElement | null;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
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
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        onOpenChange?.(value);
        if (!value) setAnimateResult(false);
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={!enabled}
          className="shrink-0"
          title={
            enabled
              ? "Résumé IA de la conversation"
              : "Disponible après un message du client"
          }
          aria-label="Résumé IA de la conversation"
          onClick={() => {
            if (!result) void generate();
          }}
        >
          <FileText aria-hidden="true" className="size-4" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Content className="absolute inset-0 z-30 flex min-h-0 flex-col bg-background text-foreground outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
          <header className="chat-floating-header relative z-10 flex shrink-0 items-start justify-between gap-3 bg-background p-4 sm:p-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">
                Résumé IA
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Conversation avec {contactName}. Analyse à vérifier, visible
                uniquement dans votre espace.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Revenir à la conversation"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {pending && (
              <AiThinking generation={{ id: contactId, state: "thinking" }} />
            )}
            {error && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                {error}
              </p>
            )}
            {result && !pending && (
              <div
                key={result.generatedAt}
                className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
              >
                {result.partial && (
                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    Analyse partielle : jusqu’à 200 messages récents, texte
                    limité et pièces jointes exclues.
                  </p>
                )}
                <p role="status" className="sr-only">
                  Le résumé de la conversation est prêt.
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Résumé ponctuel : actualisez-le après de nouveaux échanges.
                </p>
              </div>
            )}
          </div>
          <footer className="chat-floating-composer relative z-10 flex shrink-0 justify-end gap-2 bg-background p-4">
            <DialogPrimitive.Close asChild>
              <Button variant="ghost">Retour au chat</Button>
            </DialogPrimitive.Close>
            <Button
              disabled={pending || !enabled}
              onClick={() => void generate()}
            >
              {result ? "Actualiser" : "Réessayer"}
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
