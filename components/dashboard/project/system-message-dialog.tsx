"use client";
import { useRef, useState } from "react";
import { Expand, Loader2, Sparkles, Wand2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { assistSystemMessage } from "@/app/actions/assist-system-message";
import type { AgentConfig } from "@/lib/agent-config";
import type { AutosaveStatus as SaveStatus } from "@/lib/autosave-queue";
import { AutosaveStatus } from "./autosave-status";

export function SystemMessageDialog({
  projectId,
  config,
  onChange,
  onClose,
  status,
  saveError,
  error,
  onboarding,
}: {
  projectId: string;
  config: AgentConfig;
  onChange: (value: string) => void;
  onClose: () => void;
  status: SaveStatus;
  saveError?: string;
  error?: { message?: string };
  onboarding: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"generate" | "rewrite" | null>(null);
  const busyRef = useRef(false);
  const [availableAt, setAvailableAt] = useState(0);
  const [previous, setPrevious] = useState<string | null>(null);
  async function assist(mode: "generate" | "rewrite") {
    if (busyRef.current) return;
    if (Date.now() < availableAt) {
      toast.info("Patientez 30 secondes entre deux demandes IA.");
      return;
    }
    busyRef.current = true;
    setPending(mode);
    setAvailableAt(Date.now() + 30000);
    const draft = config.agentSystemMessage;
    try {
      const result = await assistSystemMessage({ projectId, config, mode });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setPrevious(draft);
      onChange(result.systemMessage);
      toast.success(
        "Message préparé. Relisez les informations avant de quitter l’éditeur.",
      );
    } catch {
      toast.error("L’IA est indisponible. Votre texte est conservé.");
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  }
  function changeOpen(value: boolean) {
    if (!value && busyRef.current) return;
    if (!value) onClose();
    setOpen(value);
  }
  return (
    <>
      <Button
        ref={trigger}
        id="agent-system"
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        aria-invalid={!!error}
        aria-describedby="agent-system-description agent-system-error"
        className="h-auto min-h-32 w-full items-start justify-between gap-4 whitespace-normal rounded-xl p-4 text-left font-normal"
        onClick={() => setOpen(true)}
      >
        <span className="line-clamp-5 min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
          {config.agentSystemMessage ||
            "Cliquez pour écrire la mission et les connaissances de votre agent…"}
        </span>
        <Expand
          aria-hidden
          className="mt-1 size-4 shrink-0 text-muted-foreground"
        />
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
          className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-4xl"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Message système de votre agent</DialogTitle>
            <DialogDescription>
              Décrivez votre entreprise, ses offres et les règles de l’agent.{" "}
              {onboarding
                ? "Le brouillon sera enregistré à la fin de la configuration."
                : "Vos modifications sont enregistrées automatiquement."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!!pending}
              onClick={() => void assist("generate")}
            >
              {pending === "generate" ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <Sparkles aria-hidden />
              )}
              Générer par IA
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !!pending || config.agentSystemMessage.trim().length < 40
              }
              onClick={() => void assist("rewrite")}
            >
              {pending === "rewrite" ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <Wand2 aria-hidden />
              )}
              Reformuler
            </Button>
            {previous !== null && (
              <Button
                type="button"
                variant="ghost"
                disabled={!!pending}
                onClick={() => {
                  onChange(previous);
                  setPrevious(null);
                }}
              >
                <Undo2 aria-hidden />
                Annuler la proposition
              </Button>
            )}
          </div>
          <Field
            data-invalid={!!error}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <FieldLabel htmlFor="agent-system-editor" className="sr-only">
              Instructions et connaissances de l’agent
            </FieldLabel>
            <Textarea
              id="agent-system-editor"
              value={config.agentSystemMessage}
              onChange={(event) => onChange(event.target.value)}
              disabled={!!pending}
              maxLength={12000}
              autoComplete="off"
              spellCheck
              rows={18}
              aria-invalid={!!error}
              aria-describedby="system-editor-help system-editor-error"
              className="min-h-56 resize-none font-mono text-sm leading-relaxed"
            />
            <FieldDescription
              id="system-editor-help"
              className="flex justify-between gap-3"
            >
              <span>40 à 12 000 caractères · Ne partagez aucun secret.</span>
              <span className="shrink-0 tabular-nums">
                {config.agentSystemMessage.length.toLocaleString("fr-FR")} / 12
                000
              </span>
            </FieldDescription>
            <FieldError id="system-editor-error" errors={[error]} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="space-y-1">
              {!onboarding && (
                <AutosaveStatus status={status} error={saveError} />
              )}
              <p className="text-xs text-muted-foreground">
                IA : 30 s entre les demandes · 10 par projet / 24 h.
              </p>
            </div>
            <Button
              type="button"
              disabled={!!pending}
              onClick={() => changeOpen(false)}
            >
              Terminé
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
