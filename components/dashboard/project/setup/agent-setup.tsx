"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Loader2,
  Power,
  ShieldCheck,
  Undo2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  activateAgentSetup,
  saveAgentDraft,
} from "@/app/actions/project-settings";
import { assistSystemMessage } from "@/app/actions/assist-system-message";
import {
  AGENT_DEFAULTS,
  AgentConfigSchema,
  systemMessageTemplate,
  type AgentConfig,
} from "@/lib/agent-config";
import { cn } from "@/lib/utils";
import {
  AgentBehaviorFields,
  AgentLanguageField,
  AgentLengthField,
  AgentNameField,
  AgentToneField,
  type AgentFieldUpdate,
} from "../agent-fields";
import { SandboxChat } from "../knowledge/agent-sandbox";

type StepId = "profile" | "mission" | "knowledge" | "test";

const STEP_COPY: Record<
  StepId,
  { label: string; title: string; description: string }
> = {
  profile: {
    label: "Profil",
    title: "Présentez votre assistant",
    description: "Son nom et sa façon de parler à vos clients sur WhatsApp.",
  },
  mission: {
    label: "Mission",
    title: "Que doit-il faire ?",
    description:
      "Votre activité, ce qu’il doit faire pour vos clients et ce qu’il ne doit jamais promettre.",
  },
  knowledge: {
    label: "Connaissances",
    title: "Ce qu’il doit savoir",
    description:
      "Horaires, prix, conditions, catalogue : il s’en sert pour répondre juste. Vous pourrez compléter plus tard.",
  },
  test: {
    label: "Test",
    title: "Testez-le comme un client",
    description:
      "Il répond avec votre configuration, sans rien envoyer sur WhatsApp. Activez-le quand ses réponses vous conviennent.",
  },
};

/** Champs validés avant de quitter chaque étape du formulaire. */
const STEP_FIELDS = {
  profile: [
    "agentName",
    "agentTone",
    "agentResponseLength",
    "agentLanguage",
    "agentUseEmojis",
  ],
  mission: [
    "agentSystemMessage",
    "agentAskOneQuestion",
    "agentQualifyLeads",
    "agentHumanHandover",
  ],
} as const satisfies Record<string, readonly (keyof AgentConfig)[]>;

const MAX_INSTRUCTIONS = 12000;
const REWRITE_COOLDOWN_MS = 30_000;

/** Configuration validée et sérialisée : sert à éviter les enregistrements inutiles. */
function snapshot(value: unknown) {
  const parsed = AgentConfigSchema.safeParse(value);
  return parsed.success ? JSON.stringify(parsed.data) : null;
}

function greeting(config: AgentConfig, projectName: string) {
  const name = config.agentName.trim() || "votre assistant";
  if (config.agentLanguage === "en")
    return `Hello, I'm ${name}, the AI assistant for ${projectName}. How can I help you?`;
  if (config.agentTone === "direct")
    return `Bonjour, je suis ${name}. Quel est votre besoin ?`;
  if (config.agentTone === "professional")
    return `Bonjour, je suis ${name}, l’assistant IA de ${projectName}. Comment puis-je vous renseigner ?`;
  return `Bonjour et bienvenue chez ${projectName} ! Je suis ${name}, votre assistant IA. Comment puis-je vous aider ?`;
}

function Progress({
  steps,
  step,
  reached,
  disabled,
  onSelect,
}: {
  steps: StepId[];
  step: number;
  reached: number;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Étapes de configuration">
      <ol className={cn("grid gap-2", steps.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
        {steps.map((id, index) => {
          const current = index === step;
          const done = index < step;
          const label = STEP_COPY[id].label;
          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "block h-1 rounded-full transition-colors motion-reduce:transition-none",
                  index <= step ? "bg-primary" : "bg-border",
                )}
              />
              <span
                className={cn(
                  // Téléphone : barres seules, l’étape est écrite sous la progression.
                  "mt-2 flex min-w-0 items-center gap-1 text-xs max-sm:sr-only",
                  current ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {done && <Check aria-hidden="true" className="size-3 shrink-0" />}
                <span className="truncate">{label}</span>
              </span>
            </>
          );
          return (
            <li key={id} aria-current={current ? "step" : undefined} className="min-w-0">
              {index <= reached && !current ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(index)}
                  className="block w-full rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
                >
                  {content}
                  <span className="sr-only">
                    {done ? " (terminée)" : ""}, revenir à cette étape
                  </span>
                </button>
              ) : (
                <div>
                  {content}
                  {!current && <span className="sr-only"> (à venir)</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AgentSetup({
  projectId,
  projectName,
  initial,
  version,
  knowledge,
  sandbox,
  instinctAvailable,
}: {
  projectId: string;
  projectName: string;
  initial: AgentConfig;
  version: number;
  /** Étape facultative : outils de la base de connaissances. */
  knowledge: ReactNode | null;
  sandbox: { remaining: number; suggestions: readonly string[] };
  /** L’offre inclut Instinct IA (lu côté serveur dans `PLAN_FEATURES`). */
  instinctAvailable: boolean;
}) {
  const formId = useId();
  const steps: StepId[] = knowledge
    ? ["profile", "mission", "knowledge", "test"]
    : ["profile", "mission", "test"];
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [savedVersion, setSavedVersion] = useState(version);
  const [saving, setSaving] = useState(false);
  const [activating, startActivation] = useTransition();
  const [error, setError] = useState("");
  const [tested, setTested] = useState(false);
  const lastSaved = useRef<string | null>(snapshot(initial));
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const form = useForm<AgentConfig>({
    resolver: zodResolver(AgentConfigSchema),
    defaultValues: {
      ...AGENT_DEFAULTS,
      ...initial,
      agentSystemMessage:
        initial.agentSystemMessage || systemMessageTemplate(projectName),
    },
  });
  const config = useWatch({ control: form.control }) as AgentConfig;
  const update: AgentFieldUpdate = (key, value) => {
    setError("");
    form.setValue(key, value, { shouldDirty: true, shouldValidate: true });
  };
  const fields = { control: form.control, onChange: update };

  const current = steps[step];
  const busy = saving || activating;

  // Nouvelle étape : le titre reçoit le focus (lecteurs d’écran, clavier).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    heading.current?.focus({ preventScroll: true });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [step]);

  /** Brouillon enregistré côté serveur : l’agent reste silencieux sur WhatsApp. */
  async function saveDraft() {
    const parsed = AgentConfigSchema.safeParse(form.getValues());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Vérifiez la configuration.");
      return false;
    }
    const next = JSON.stringify(parsed.data);
    if (next === lastSaved.current) return true;
    setSaving(true);
    try {
      const result = await saveAgentDraft({
        projectId,
        expectedVersion: savedVersion,
        config: parsed.data,
      });
      if (!result.success) {
        setError(result.error);
        return false;
      }
      setSavedVersion(result.version);
      lastSaved.current = next;
      return true;
    } catch {
      setError("La connexion a été interrompue. Réessayez.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function go(target: number) {
    if (busy || target === step || target < 0 || target >= steps.length) return;
    setError("");
    if (target > step) {
      // Chaque étape de formulaire franchie est validée, puis le brouillon enregistré.
      for (const [index, id] of steps.entries()) {
        if (index >= target) break;
        if (id !== "profile" && id !== "mission") continue;
        if (!(await form.trigger([...STEP_FIELDS[id]], { shouldFocus: index === step }))) {
          if (index !== step) setStep(index);
          return;
        }
      }
      if (!(await saveDraft())) return;
    }
    setStep(target);
    setReached((value) => Math.max(value, target));
  }

  function activate() {
    setError("");
    startActivation(async () => {
      if (!(await saveDraft())) return;
      // En cas de succès, le serveur redirige vers la messagerie.
      const result = await activateAgentSetup({ projectId });
      if (result?.success === false) setError(result.error);
    });
  }

  const copy = STEP_COPY[current];
  const formStep = current === "profile" || current === "mission";

  return (
    <div className="flex flex-col">
      <header className="space-y-8">
        <Progress
          steps={steps}
          step={step}
          reached={reached}
          disabled={busy}
          onSelect={(index) => void go(index)}
        />
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            Étape {step + 1} sur {steps.length}
            {current === "knowledge" && " · facultative"}
          </p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-2 text-3xl leading-tight outline-none sm:text-4xl"
          >
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
            {copy.description}
          </p>
        </div>
      </header>

      <div className="mt-8 min-w-0">
        {formStep && (
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void go(step + 1);
            }}
          >
            <fieldset disabled={busy} className="min-w-0 space-y-8">
              {current === "profile" && (
                <>
                  <AgentNameField {...fields} length={config.agentName.length} />
                  <div className="space-y-3">
                    <AgentToneField {...fields} />
                    <figure className="flex items-end gap-2 rounded-xl border bg-muted/30 p-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Bot aria-hidden="true" className="size-3.5" />
                      </span>
                      <blockquote
                        aria-live="polite"
                        className="min-w-0 rounded-2xl rounded-bl-sm bg-background px-3 py-2 text-sm leading-relaxed shadow-xs"
                      >
                        {greeting(config, projectName)}
                        {config.agentUseEmojis && " 👋"}
                      </blockquote>
                      <figcaption className="sr-only">
                        Aperçu du premier message de votre assistant
                      </figcaption>
                    </figure>
                  </div>
                  <AgentLengthField {...fields} />
                  <AgentLanguageField {...fields} />
                  <AgentBehaviorFields
                    {...fields}
                    only={["agentUseEmojis"]}
                    legend="Emojis"
                  />
                </>
              )}

              {current === "mission" && (
                <>
                  <InstructionsField
                    projectId={projectId}
                    control={form.control}
                    config={config}
                    onChange={(value) => update("agentSystemMessage", value)}
                  />
                  <AgentBehaviorFields
                    {...fields}
                    only={[
                      "agentAskOneQuestion",
                      "agentQualifyLeads",
                      "agentHumanHandover",
                    ]}
                    legend="Règles de conversation"
                    instinctAvailable={instinctAvailable}
                  />
                </>
              )}
            </fieldset>
          </form>
        )}

        {current === "knowledge" && knowledge}

        {current === "test" && (
          <div className="space-y-3">
            <SandboxChat
              projectId={projectId}
              initialRemaining={sandbox.remaining}
              suggestions={sandbox.suggestions}
              onReply={() => setTested(true)}
            />
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              Les tests ne consomment pas votre quota de messages WhatsApp.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* Mobile : barre d’actions collée en bas, toujours à portée de pouce. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t bg-background/90 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/75 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void go(step - 1)}
              className="shrink-0 max-sm:px-2.5"
            >
              <ArrowLeft data-icon="inline-start" className="max-sm:m-0" />
              {/* Téléphone : icône seule, la place revient à l’action principale. */}
              <span className="max-sm:sr-only">Retour</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex min-w-0 items-center gap-4 max-sm:flex-1 max-sm:justify-end">
            {current === "test" && (
              <p className="hidden min-w-0 text-right text-xs text-muted-foreground md:block">
                {tested
                  ? "Il répondra ainsi à vos clients sur WhatsApp."
                  : "Envoyez au moins un message pour voir sa réponse."}
              </p>
            )}
            {current === "test" ? (
              <Button type="button" disabled={busy} onClick={activate} className="min-w-0 max-sm:flex-1">
                {activating ? (
                  <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Power data-icon="inline-start" />
                )}
                {activating ? "Activation…" : "Activer l’assistant"}
              </Button>
            ) : (
              <Button
                type={formStep ? "submit" : "button"}
                form={formStep ? formId : undefined}
                disabled={busy}
                onClick={formStep ? undefined : () => void go(step + 1)}
                className="min-w-0 max-sm:flex-1"
              >
                {saving && (
                  <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
                )}
                {saving ? "Enregistrement…" : "Continuer"}
                {!saving && <ArrowRight data-icon="inline-end" />}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Instructions de l’agent, éditées sur place. « Améliorer » passe par la même
 * action serveur que la page Assistant IA (droits, quota et délai vérifiés).
 */
function InstructionsField({
  projectId,
  control,
  config,
  onChange,
}: {
  projectId: string;
  control: Control<AgentConfig>;
  config: AgentConfig;
  onChange: (value: string) => void;
}) {
  const [rewriting, setRewriting] = useState(false);
  const [previous, setPrevious] = useState<string | null>(null);
  const availableAt = useRef(0);
  const length = config.agentSystemMessage.length;

  async function rewrite() {
    if (rewriting) return;
    if (Date.now() < availableAt.current) {
      toast.info("Patientez 30 secondes entre deux demandes à l’IA.");
      return;
    }
    availableAt.current = Date.now() + REWRITE_COOLDOWN_MS;
    setRewriting(true);
    const draft = config.agentSystemMessage;
    try {
      const result = await assistSystemMessage({
        projectId,
        config,
        mode: "rewrite",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setPrevious(draft);
      onChange(result.systemMessage);
      toast.success("Instructions améliorées. Relisez-les avant de continuer.");
    } catch {
      toast.error("L’IA est indisponible. Votre texte est conservé.");
    } finally {
      setRewriting(false);
    }
  }

  return (
    <Controller
      name="agentSystemMessage"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <FieldLabel htmlFor="agent-instructions">Instructions</FieldLabel>
            <div className="flex items-center gap-1">
              {previous !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rewriting}
                  onClick={() => {
                    onChange(previous);
                    setPrevious(null);
                  }}
                >
                  <Undo2 data-icon="inline-start" />
                  Annuler
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={rewriting || config.agentSystemMessage.trim().length < 40}
                onClick={() => void rewrite()}
              >
                {rewriting ? (
                  <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Wand2 data-icon="inline-start" />
                )}
                {rewriting ? "Amélioration…" : "Améliorer avec l’IA"}
              </Button>
            </div>
          </div>
          <FieldDescription id="agent-instructions-description">
            Remplacez les exemples par votre activité, vos offres et vos
            limites. Ne promettez rien qui ne soit pas vérifié.
          </FieldDescription>
          <Textarea
            {...field}
            id="agent-instructions"
            value={field.value}
            onChange={(event) => onChange(event.target.value)}
            disabled={rewriting}
            maxLength={MAX_INSTRUCTIONS}
            spellCheck
            autoComplete="off"
            aria-invalid={fieldState.invalid}
            aria-describedby="agent-instructions-description agent-instructions-count agent-instructions-error"
            className="min-h-72 max-h-[60dvh] resize-y text-base leading-relaxed sm:text-sm"
          />
          <div className="flex items-start justify-between gap-3">
            <FieldError id="agent-instructions-error" errors={[fieldState.error]} />
            <p
              id="agent-instructions-count"
              className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
            >
              {length.toLocaleString("fr-FR")} / 12 000
            </p>
          </div>
        </Field>
      )}
    />
  );
}
