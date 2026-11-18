"use client";
import { useRef, useState } from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, Loader2, Pencil, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel, FieldTitle } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { generateSystemMessageFromProfile } from "@/app/actions/business-profile";
import {
  AGENT_INSTRUCTIONS_MAX,
  AgentConfigInputSchema,
  type AgentConfig,
} from "@/lib/agent-config";
import { cn } from "@/lib/utils";

const MAX_INSTRUCTIONS = AGENT_INSTRUCTIONS_MAX;
const MAX_LABEL = MAX_INSTRUCTIONS.toLocaleString("fr-FR");
const GENERATE_COOLDOWN_MS = 30_000;
const LINKS_NOTE = "Site web et réseaux sociaux : enregistrés à part, inutile de les ajouter.";

/**
 * Instructions de l’agent : aperçu, rédaction par l’IA à partir de la fiche
 * enregistrée, ou modification à la main (boîte de dialogue sur ordinateur,
 * tiroir sur mobile). Chaque changement est enregistré en brouillon.
 */
export function InstructionsField({
  projectId,
  control,
  value,
  disabled,
  onChange,
  onPersist,
  onGeneratingChange,
}: {
  projectId: string;
  control: Control<AgentConfig>;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  /** Enregistre le brouillon ; renvoie un message d’erreur ou null. */
  onPersist: () => Promise<string | null>;
  /** Le parcours se fige pendant la rédaction (navigation, « Continuer »). */
  onGeneratingChange: (generating: boolean) => void;
}) {
  const [generating, setGeneratingState] = useState(false);
  const setGenerating = (value: boolean) => {
    setGeneratingState(value);
    onGeneratingChange(value);
  };
  const [editing, setEditing] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);
  const availableAt = useRef(0);
  // Le focus suit le texte : le bouton cliqué se désactive ou disparaît.
  const region = useRef<HTMLDivElement | null>(null);
  const generateButton = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const empty = !value.trim();
  const locked = disabled || generating;

  async function replace(next: string) {
    onChange(next);
    return onPersist();
  }

  async function generate() {
    if (locked) return;
    if (Date.now() < availableAt.current) {
      toast.info("Patientez 30 secondes entre deux demandes à l’IA.");
      return;
    }
    availableAt.current = Date.now() + GENERATE_COOLDOWN_MS;
    const hadFocus = document.activeElement === generateButton.current;
    let written = false;
    setGenerating(true);
    const draft = value;
    try {
      const result = await generateSystemMessageFromProfile({ projectId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setPrevious(draft.trim() ? draft : null);
      written = true;
      const error = await replace(result.systemMessage);
      if (error) toast.error(error);
      else toast.success("Instructions rédigées. Relisez-les avant de continuer.");
    } catch {
      toast.error("L’IA est indisponible. Votre texte est conservé.");
    } finally {
      setGenerating(false);
      if (hadFocus && written) region.current?.focus();
    }
  }

  async function undo() {
    if (previous === null || locked) return;
    const error = await replace(previous);
    if (error) {
      toast.error(error);
      return;
    }
    setPrevious(null);
    region.current?.focus();
  }

  return (
    <Controller
      name="agentSystemMessage"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="gap-3">
          {/* Actions en tête du bloc : à droite du titre sur ordinateur ; sur
              téléphone, sur leur propre ligne, à parts égales. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <FieldTitle id="agent-instructions-label">Instructions</FieldTitle>
              {!empty && (
                <span
                  className={cn(
                    "font-mono text-xs tabular-nums text-muted-foreground",
                    value.length > MAX_INSTRUCTIONS && "text-destructive",
                  )}
                >
                  {value.length.toLocaleString("fr-FR")} / {MAX_LABEL}
                </span>
              )}
              {previous !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={locked}
                  onClick={() => void undo()}
                >
                  <Undo2 data-icon="inline-start" />
                  Rétablir<span className="sr-only"> l’ancien texte</span>
                </Button>
              )}
            </div>
            <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
              <Button
                ref={editButton}
                type="button"
                variant="outline"
                disabled={locked}
                onClick={() => setEditing(true)}
                className="min-w-0 flex-1 sm:flex-none"
              >
                <Pencil data-icon="inline-start" />
                Modifier
              </Button>
              <Button
                ref={generateButton}
                type="button"
                variant={empty ? "default" : "outline"}
                disabled={locked}
                onClick={() => void generate()}
                className="min-w-0 flex-1 sm:flex-none"
              >
                {generating ? (
                  <Loader2
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <Sparkles data-icon="inline-start" />
                )}
                {generating ? (
                  "Rédaction…"
                ) : (
                  <>
                    Générer
                    {/* Très petits écrans : libellé court, nom complet lu. */}
                    <span className="max-[400px]:sr-only">&nbsp;avec l’IA</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Cible du focus quand la validation échoue ; lisible au clavier. */}
          <div
            id="agent-instructions"
            ref={(node) => {
              field.ref(node);
              region.current = node;
            }}
            tabIndex={0}
            role="region"
            aria-labelledby="agent-instructions-label"
            aria-describedby="agent-instructions-note agent-instructions-error"
            aria-busy={generating}
            className={cn(
              "rounded-xl border outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              fieldState.invalid && "border-destructive",
              empty && !generating && "border-dashed",
            )}
          >
            {generating ? (
              <div role="status" className="space-y-3 p-4">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                  Rédaction à partir de votre entreprise…
                </span>
                {["w-1/3", "w-full", "w-11/12", "w-4/5", "w-1/4", "w-full", "w-2/3"].map(
                  (width, index) => (
                    <Skeleton key={index} className={cn("h-3.5", width)} />
                  ),
                )}
              </div>
            ) : empty ? (
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Sparkles aria-hidden="true" className="size-4" />
                </span>
                <p className="mt-3 text-sm font-medium">Aucune instruction</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  L’IA les rédige à partir de votre entreprise et de vos objectifs.
                </p>
              </div>
            ) : (
              <p className="max-h-[min(15rem,40dvh)] overflow-y-auto p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {value}
              </p>
            )}
          </div>
          <FieldError id="agent-instructions-error" errors={[fieldState.error]} />

          <p
            id="agent-instructions-note"
            className="flex items-start gap-1.5 text-xs text-muted-foreground"
          >
            <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {LINKS_NOTE}
          </p>

          <InstructionsEditor
            open={editing}
            onOpenChange={setEditing}
            value={value}
            returnFocus={() => editButton.current?.focus()}
            onSave={async (next) => {
              const error = await replace(next);
              if (!error) setPrevious(null);
              return error;
            }}
          />
        </Field>
      )}
    />
  );
}

/** Même règle que l’enregistrement de l’agent : 40 à 2 000 caractères. */
const EditorSchema = z.object({
  instructions: AgentConfigInputSchema.shape.agentSystemMessage,
});
type EditorValues = z.infer<typeof EditorSchema>;

function InstructionsEditor({
  open,
  onOpenChange,
  value,
  returnFocus,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  returnFocus: () => void;
  onSave: (value: string) => Promise<string | null>;
}) {
  const isMobile = useIsMobile();
  // Sans DialogTrigger, Radix ne sait pas où rendre le focus à la fermeture.
  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    returnFocus();
  };
  const title = "Modifier les instructions";
  const description = "Activité, mission, limites. " + LINKS_NOTE;
  // Remonté à chaque ouverture : le formulaire repart du texte actuel.
  const form = open ? (
    <InstructionsForm
      value={value}
      onSave={onSave}
      onDone={() => onOpenChange(false)}
      // Sur téléphone, le clavier ne s’ouvre qu’au toucher du texte.
      autoFocus={!isMobile}
      fill={isMobile}
    />
  ) : null;

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl" onCloseAutoFocus={onCloseAutoFocus}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* Hauteur fixe : le texte occupe l’espace libre. Clavier ouvert, vaul
          ramène le tiroir au-dessus de lui et l’en-tête se fait discret. */}
      <DrawerContent
        className="h-[92dvh] data-[vaul-drawer-direction=bottom]:max-h-[92dvh]"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DrawerHeader className="shrink-0 text-left group-has-[textarea:focus]/drawer-content:pb-2">
          <DrawerTitle className="text-lg leading-snug tracking-normal">{title}</DrawerTitle>
          {/* Toujours lue par les lecteurs d’écran, masquée pendant la saisie. */}
          <DrawerDescription className="group-has-[textarea:focus]/drawer-content:sr-only">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        {form}
      </DrawerContent>
    </Drawer>
  );
}

function InstructionsForm({
  value,
  onSave,
  onDone,
  autoFocus,
  fill,
}: {
  value: string;
  onSave: (value: string) => Promise<string | null>;
  onDone: () => void;
  autoFocus: boolean;
  /** Tiroir mobile : le texte prend toute la hauteur restante. */
  fill: boolean;
}) {
  const form = useForm<EditorValues>({
    resolver: zodResolver(EditorSchema),
    defaultValues: { instructions: value },
  });
  const saving = form.formState.isSubmitting;

  async function submit({ instructions }: EditorValues) {
    try {
      const error = await onSave(instructions);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Instructions enregistrées.");
      onDone();
    } catch {
      toast.error("La connexion a été interrompue. Réessayez.");
    }
  }

  return (
    <form
      noValidate
      className={cn(
        "flex min-h-0 flex-col gap-4",
        fill && "flex-1 gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
      )}
      onSubmit={(event) => {
        // Le formulaire du parcours est un ancêtre React (portail) : il ne doit
        // pas recevoir cette soumission.
        event.stopPropagation();
        void form.handleSubmit(submit)(event);
      }}
    >
      <Controller
        name="instructions"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className={cn("min-h-0", fill && "flex-1 gap-2")}>
            <FieldLabel htmlFor="agent-instructions-editor" className="sr-only">
              Instructions
            </FieldLabel>
            <Textarea
              {...field}
              id="agent-instructions-editor"
              data-vaul-no-drag
              autoFocus={autoFocus}
              disabled={saving}
              maxLength={MAX_INSTRUCTIONS}
              spellCheck
              autoComplete="off"
              aria-invalid={fieldState.invalid}
              aria-describedby="agent-instructions-editor-count agent-instructions-editor-error"
              className={cn(
                "field-sizing-fixed resize-none text-base leading-relaxed sm:text-sm",
                fill ? "min-h-24 flex-1" : "h-[min(22rem,45dvh)]",
              )}
            />
            <div className="flex shrink-0 items-start justify-between gap-3">
              <FieldError id="agent-instructions-editor-error" errors={[fieldState.error]} />
              <p
                id="agent-instructions-editor-count"
                className={cn(
                  "ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground",
                  // Texte enregistré avant la limite : à raccourcir.
                  field.value.length > MAX_INSTRUCTIONS && "text-destructive",
                )}
              >
                {field.value.length.toLocaleString("fr-FR")} / {MAX_LABEL}
              </p>
            </div>
          </Field>
        )}
      />
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button type="button" variant="outline" disabled={saving} onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && (
            <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
          )}
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
