"use client";
import { useRef, useState } from "react";
import { Pencil, Loader2, Sparkles, Wand2, Undo2, X } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
        <Pencil
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
          showCloseButton={false}
          className="flex h-dvh max-h-dvh max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[85dvh] sm:max-w-4xl sm:rounded-xl"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
            <DialogHeader className="min-w-0 gap-1">
              <DialogTitle className="text-base sm:text-lg">
                Message système
              </DialogTitle>
              <DialogDescription className="sr-only">
                Modifiez les instructions de votre agent.
                {onboarding
                  ? "Le brouillon sera enregistré à la fin de la configuration."
                  : "Les modifications sont enregistrées automatiquement."}
              </DialogDescription>
              <p className="text-xs text-muted-foreground">
                Instructions de l’agent
              </p>
            </DialogHeader>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!!pending}
              aria-label="Fermer l’éditeur"
              onClick={() => changeOpen(false)}
            >
              <X aria-hidden />
            </Button>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3 sm:px-6">
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
                size="icon"
                aria-label="Annuler la proposition IA"
                title="Annuler la proposition IA"
                disabled={!!pending}
                onClick={() => {
                  onChange(previous);
                  setPrevious(null);
                }}
              >
                <Undo2 aria-hidden />
              </Button>
            )}
          </div>
          <Field
            data-invalid={!!error}
            className="min-h-0 flex-1 gap-0 overflow-hidden p-3 sm:p-5"
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
              rows={1}
              aria-invalid={!!error}
              aria-describedby={error ? "system-editor-error" : undefined}
              className="h-full min-h-0 flex-1 resize-none field-sizing-fixed overflow-y-auto overscroll-contain rounded-lg border-0 bg-background p-3 font-mono text-base leading-relaxed shadow-none focus-visible:ring-1 sm:p-4 sm:text-sm"
            />
            <FieldError
              id="system-editor-error"
              className="shrink-0 px-3 pt-2"
              errors={[error]}
            />
          </Field>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="min-w-0 space-y-1">
              <span
                className="text-xs tabular-nums text-muted-foreground"
                aria-label={`${config.agentSystemMessage.length} caractères sur 12000`}
              >
                {config.agentSystemMessage.length.toLocaleString("fr-FR")} / 12
                000
              </span>
              {!onboarding && status !== "idle" && (
                <AutosaveStatus status={status} error={saveError} />
              )}
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
