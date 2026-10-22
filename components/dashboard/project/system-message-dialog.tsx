"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  CloudUpload,
  Loader2,
  Pencil,
  Sparkles,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { assistSystemMessage } from "@/app/actions/assist-system-message";
import type { AgentConfig } from "@/lib/agent-config";
import type { AutosaveStatus as SaveStatus } from "@/lib/autosave-queue";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 12000;

/** Statut compact, toujours visible : l’éditeur n’a plus de bouton « Terminé ». */
function SaveIndicator({
  status,
  error,
  onboarding,
}: {
  status: SaveStatus;
  error?: string;
  onboarding: boolean;
}) {
  const failed = status === "error" || status === "invalid";
  const label = onboarding
    ? "Brouillon conservé"
    : status === "saving"
      ? "Enregistrement…"
      : status === "waiting"
        ? "Modifications en cours…"
        : status === "saved"
          ? "Enregistré"
          : status === "invalid"
            ? "Texte incomplet"
            : status === "error"
              ? "Échec de l’enregistrement"
              : "Enregistrement automatique";
  const Icon = onboarding
    ? Check
    : status === "saving" || status === "waiting"
      ? Loader2
      : status === "saved"
        ? Check
        : failed
          ? CircleAlert
          : CloudUpload;

  return (
    <p
      role="status"
      aria-live="polite"
      title={status === "error" ? error : undefined}
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-xs",
        failed ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0",
          (status === "saving" || status === "waiting") &&
            !onboarding &&
            "animate-spin motion-reduce:animate-none",
        )}
      />
      <span className="truncate">{label}</span>
    </p>
  );
}

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
  const editor = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"generate" | "rewrite" | null>(null);
  const busyRef = useRef(false);
  const [availableAt, setAvailableAt] = useState(0);
  const [previous, setPrevious] = useState<string | null>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  const length = config.agentSystemMessage.length;

  // Fondus haut/bas : visibles seulement s’il reste du texte dans ce sens.
  function measureEdges() {
    const element = editor.current;
    if (!element) return;
    const top = element.scrollTop > 2;
    const bottom =
      element.scrollHeight - element.clientHeight - element.scrollTop > 2;
    setEdges((current) =>
      current.top === top && current.bottom === bottom
        ? current
        : { top, bottom },
    );
  }
  const measureRef = useRef(measureEdges);
  measureRef.current = measureEdges;

  useEffect(() => {
    if (!open) return;
    let observer: ResizeObserver | null = null;
    // Le contenu de la dialog est monté dans un portail après l’ouverture.
    const frame = requestAnimationFrame(() => {
      const element = editor.current;
      if (!element) return;
      observer = new ResizeObserver(() => measureRef.current());
      observer.observe(element);
      measureRef.current();
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [open]);

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
      requestAnimationFrame(measureEdges);
      toast.success("Message préparé. Relisez-le : il est déjà enregistré.");
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
          className="flex h-dvh max-h-dvh max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[85dvh] sm:max-w-4xl sm:rounded-2xl"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          {/* En-tête : titre, statut d’enregistrement, fermeture */}
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg">
                Message système
              </DialogTitle>
              <DialogDescription className="sr-only">
                Modifiez les instructions de votre agent.{" "}
                {onboarding
                  ? "Le brouillon sera enregistré à la fin de la configuration."
                  : "Chaque modification est enregistrée automatiquement."}
              </DialogDescription>
              <div className="flex min-w-0 items-center gap-2">
                <SaveIndicator
                  status={status}
                  error={saveError}
                  onboarding={onboarding}
                />
                {/* Sur mobile, la longueur rejoint le statut pour libérer la barre d’outils. */}
                <span
                  className="shrink-0 text-xs tabular-nums text-muted-foreground sm:hidden"
                  aria-label={`${length} caractères sur ${MAX_LENGTH}`}
                >
                  · {length.toLocaleString("fr-FR")} / 12 000
                </span>
              </div>
            </div>
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

          {/* Barre d’outils : actions IA à gauche, longueur à droite */}
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5 sm:px-6 sm:py-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="max-sm:h-9 max-sm:flex-1"
              disabled={!!pending}
              onClick={() => void assist("generate")}
            >
              {pending === "generate" ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              <span className="hidden sm:inline">Générer par IA</span>
              <span className="sm:hidden">Générer</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-sm:h-9 max-sm:flex-1 sm:border-transparent sm:shadow-none"
              disabled={!!pending || config.agentSystemMessage.trim().length < 40}
              onClick={() => void assist("rewrite")}
            >
              {pending === "rewrite" ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Wand2 data-icon="inline-start" />
              )}
              Reformuler
            </Button>
            {previous !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Annuler la proposition IA"
                    disabled={!!pending}
                    onClick={() => {
                      onChange(previous);
                      setPrevious(null);
                    }}
                  >
                    <Undo2 aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Revenir au texte précédent</TooltipContent>
              </Tooltip>
            )}
            <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
              <div
                aria-hidden="true"
                className="hidden h-1 w-16 overflow-hidden rounded-full bg-muted sm:block"
              >
                <div
                  className="h-full rounded-full bg-foreground/60"
                  style={{ width: `${Math.min(100, (length / MAX_LENGTH) * 100)}%` }}
                />
              </div>
              <span
                className="text-xs tabular-nums text-muted-foreground"
                aria-label={`${length} caractères sur ${MAX_LENGTH}`}
              >
                {length.toLocaleString("fr-FR")} / 12 000
              </span>
            </div>
          </div>

          {/* Éditeur avec fondus selon le défilement */}
          <Field
            data-invalid={!!error}
            className="min-h-0 flex-1 gap-0 overflow-hidden"
          >
            <FieldLabel htmlFor="agent-system-editor" className="sr-only">
              Instructions et connaissances de l’agent
            </FieldLabel>
            <div className="relative min-h-0 flex-1">
              <Textarea
                ref={editor}
                id="agent-system-editor"
                value={config.agentSystemMessage}
                onChange={(event) => {
                  onChange(event.target.value);
                  requestAnimationFrame(measureEdges);
                }}
                onScroll={measureEdges}
                disabled={!!pending}
                maxLength={MAX_LENGTH}
                autoComplete="off"
                spellCheck
                rows={1}
                aria-invalid={!!error}
                aria-describedby={error ? "system-editor-error" : undefined}
                placeholder="Décrivez votre entreprise, vos offres, vos règles et ce que l’agent ne doit jamais promettre…"
                className="h-full min-h-0 resize-none field-sizing-fixed overflow-y-auto overscroll-contain rounded-none border-0 bg-background px-4 py-5 font-mono text-base leading-relaxed shadow-none focus-visible:ring-0 sm:px-6 sm:text-sm"
              />
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b from-background to-transparent backdrop-blur-[2px] transition-opacity duration-200 mask-[linear-gradient(to_bottom,black,transparent)] motion-reduce:transition-none",
                  edges.top ? "opacity-100" : "opacity-0",
                )}
              />
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-background to-transparent backdrop-blur-[2px] transition-opacity duration-200 mask-[linear-gradient(to_top,black,transparent)] motion-reduce:transition-none",
                  edges.bottom ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
            {error && (
              <FieldError
                id="system-editor-error"
                className="shrink-0 border-t px-4 py-2 sm:px-6"
                errors={[error]}
              />
            )}
          </Field>
        </DialogContent>
      </Dialog>
    </>
  );
}
