"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Loader2,
  Power,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  activateAgentSetup,
  saveAgentDraft,
} from "@/app/actions/project-settings";
import { saveBusinessProfile } from "@/app/actions/business-profile";
import {
  AGENT_DEFAULTS,
  AgentConfigSchema,
  AgentDraftSchema,
  type AgentConfig,
} from "@/lib/agent-config";
import {
  BUSINESS_STEP_FIELDS,
  BusinessProfileFormSchema,
  BusinessProfileSchema,
  normalizeLinks,
  type BusinessProfile,
  type BusinessProfileInput,
} from "@/lib/business-profile";
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
import { CompanyFields, GoalsFields } from "./business-fields";
import { InstructionsField } from "./instructions-field";

type StepId = "company" | "goals" | "profile" | "mission" | "knowledge" | "test";

const STEP_COPY: Record<
  StepId,
  { label: string; title: string; description: string }
> = {
  company: {
    label: "Entreprise",
    title: "Votre entreprise",
    description: "L’essentiel pour que votre assistant la présente avec justesse.",
  },
  goals: {
    label: "Objectifs",
    title: "Qu’attendez-vous de WhatsApp ?",
    description: "Ce que votre assistant doit prendre en charge.",
  },
  profile: {
    label: "Profil",
    title: "Présentez votre assistant",
    description: "Son nom et sa façon de parler à vos clients sur WhatsApp.",
  },
  mission: {
    label: "Mission",
    title: "Que doit-il faire ?",
    description: "Ses instructions, rédigées à partir de votre entreprise.",
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

/** Champs de l’agent validés avant de quitter chaque étape. */
const AGENT_STEP_FIELDS = {
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

const noopSubscribe = () => () => {};

const isBusinessStep = (id: StepId): id is "company" | "goals" =>
  id === "company" || id === "goals";
const isAgentStep = (id: StepId): id is "profile" | "mission" =>
  id === "profile" || id === "mission";

/** Brouillon validé et sérialisé : évite les enregistrements inutiles. */
function agentSnapshot(value: unknown) {
  const parsed = AgentDraftSchema.safeParse(value);
  return parsed.success ? JSON.stringify(parsed.data) : null;
}

/** Fiche telle que le serveur l’enregistrera (liens vides ou en double ignorés). */
function businessSnapshot(value: unknown) {
  const parsed = BusinessProfileSchema.safeParse(value);
  if (!parsed.success) return null;
  const { website, socials, ...rest } = parsed.data;
  const links = normalizeLinks({ website, socials: socials.map((social) => social.url) });
  return JSON.stringify({ ...rest, links });
}

function greeting(config: AgentConfig, companyName: string) {
  const name = config.agentName.trim() || "votre assistant";
  if (config.agentLanguage === "en")
    return `Hello, I'm ${name}, the AI assistant for ${companyName}. How can I help you?`;
  if (config.agentTone === "direct")
    return `Bonjour, je suis ${name}. Quel est votre besoin ?`;
  if (config.agentTone === "professional")
    return `Bonjour, je suis ${name}, l’assistant IA de ${companyName}. Comment puis-je vous renseigner ?`;
  return `Bonjour et bienvenue chez ${companyName} ! Je suis ${name}, votre assistant IA. Comment puis-je vous aider ?`;
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
      <ol
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
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
                  // Téléphone et tablette : barres seules, l’étape est écrite sous la progression.
                  "mt-2 flex min-w-0 items-center gap-1 text-xs max-md:sr-only",
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
                  className="block w-full rounded-sm py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
                >
                  {content}
                  <span className="sr-only">
                    {done ? " (terminée)" : ""}, revenir à cette étape
                  </span>
                </button>
              ) : (
                <div className="py-1">
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
  business,
  businessReady,
  logoUrl,
  knowledge,
  sandbox,
  instinctAvailable,
}: {
  projectId: string;
  projectName: string;
  /** Logo actuel du projet (`projectLogoUrl`), ou null. */
  logoUrl: string | null;
  initial: AgentConfig;
  version: number;
  /** Fiche enregistrée, ou nom du projet seul au premier passage. */
  business: BusinessProfileInput;
  /** Fiche complète : les étapes suivantes sont accessibles d’emblée. */
  businessReady: boolean;
  /** Étape facultative : outils de la base de connaissances. */
  knowledge: ReactNode | null;
  sandbox: { remaining: number; suggestions: readonly string[] };
  /** L’offre inclut Instinct IA (lu côté serveur dans `PLAN_FEATURES`). */
  instinctAvailable: boolean;
}) {
  const businessFormId = useId();
  const agentFormId = useId();
  const steps: StepId[] = knowledge
    ? ["company", "goals", "profile", "mission", "knowledge", "test"]
    : ["company", "goals", "profile", "mission", "test"];
  const [step, setStep] = useState(0);
  // Retour dans le parcours : les étapes déjà remplies restent accessibles.
  const [reached, setReached] = useState(() =>
    !businessReady
      ? 0
      : AgentConfigSchema.safeParse(initial).success
        ? steps.length - 1
        : steps.indexOf("mission"),
  );
  const [savedVersion, setSavedVersion] = useState(version);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activating, startActivation] = useTransition();
  const [error, setError] = useState("");
  const [tested, setTested] = useState(false);
  const lastAgent = useRef<string | null>(agentSnapshot(initial));
  const lastBusiness = useRef<string | null>(businessSnapshot(business));
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const businessForm = useForm<BusinessProfileInput, unknown, BusinessProfile>({
    resolver: zodResolver(BusinessProfileFormSchema),
    defaultValues: {
      ...business,
      // Un champ de réseau social prêt à remplir.
      socials: business.socials.length ? business.socials : [{ url: "" }],
    },
  });
  const form = useForm<AgentConfig>({
    resolver: zodResolver(AgentConfigSchema),
    defaultValues: { ...AGENT_DEFAULTS, ...initial },
  });
  const config = useWatch({ control: form.control }) as AgentConfig;
  const companyName =
    useWatch({ control: businessForm.control, name: "companyName" }).trim() || projectName;
  const update: AgentFieldUpdate = (key, value) => {
    setError("");
    form.setValue(key, value, { shouldDirty: true, shouldValidate: true });
  };
  const fields = { control: form.control, onChange: update };

  const current = steps[step];
  // Avant l’hydratation, « Continuer » soumettrait le formulaire en GET natif et
  // placerait la fiche dans l’URL : tout reste désactivé jusque-là.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const busy = saving || activating || generating || !hydrated;

  // Un champ signalé à « Continuer » se revalide à chaque saisie : l’erreur
  // disparaît dès qu’elle est corrigée, sans alerte prématurée ailleurs.
  useEffect(() => {
    const subscription = businessForm.watch((_values, { name }) => {
      if (name && businessForm.getFieldState(name).invalid) void businessForm.trigger(name);
    });
    return () => subscription.unsubscribe();
  }, [businessForm]);

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

  /** Fiche enregistrée côté serveur ; les liens rejoignent les connaissances. */
  async function saveBusiness() {
    const values = businessForm.getValues();
    const next = businessSnapshot(values);
    if (next === null) {
      setError("Vérifiez les informations de votre entreprise.");
      return false;
    }
    if (next === lastBusiness.current) return true;
    setSaving(true);
    try {
      const result = await saveBusinessProfile({ projectId, profile: values });
      if (!result.success) {
        setError(result.error);
        return false;
      }
      lastBusiness.current = next;
      // Un nouveau nom fait avancer la version de l’agent, comme dans les réglages.
      // Une modification d’un autre membre reste détectée au prochain brouillon.
      if (result.renamed) setSavedVersion((value) => value + 1);
      if (result.linksChanged) toast.success("Liens enregistrés dans vos connaissances.");
      return true;
    } catch {
      setError("La connexion a été interrompue. Réessayez.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Brouillon de l’agent : il reste silencieux sur WhatsApp. Renvoie l’erreur éventuelle. */
  async function saveDraft(): Promise<string | null> {
    const parsed = AgentDraftSchema.safeParse(form.getValues());
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Vérifiez la configuration.";
      setError(message);
      return message;
    }
    const next = JSON.stringify(parsed.data);
    if (next === lastAgent.current) return null;
    setSaving(true);
    try {
      const result = await saveAgentDraft({
        projectId,
        expectedVersion: savedVersion,
        config: parsed.data,
      });
      if (!result.success) {
        setError(result.error);
        return result.error;
      }
      setSavedVersion(result.version);
      lastAgent.current = next;
      return null;
    } catch {
      const message = "La connexion a été interrompue. Réessayez.";
      setError(message);
      return message;
    } finally {
      setSaving(false);
    }
  }

  async function go(target: number) {
    if (busy || target === step || target < 0 || target >= steps.length) return;
    setError("");
    if (target > step) {
      // Chaque étape de formulaire franchie est validée, puis enregistrée.
      for (const [index, id] of steps.entries()) {
        if (index >= target) break;
        const focus = { shouldFocus: index === step };
        const valid = isBusinessStep(id)
          ? await businessForm.trigger([...BUSINESS_STEP_FIELDS[id]], focus)
          : isAgentStep(id)
            ? await form.trigger([...AGENT_STEP_FIELDS[id]], focus)
            : true;
        if (!valid) {
          if (index !== step) setStep(index);
          return;
        }
      }
      if (!(await saveBusiness())) return;
      if ((await saveDraft()) !== null) return;
    }
    setStep(target);
    setReached((value) => Math.max(value, target));
  }

  function activate() {
    setError("");
    startActivation(async () => {
      if ((await saveDraft()) !== null) return;
      // En cas de succès, le serveur redirige vers la messagerie.
      const result = await activateAgentSetup({ projectId });
      if (result?.success === false) setError(result.error);
    });
  }

  const copy = STEP_COPY[current];
  const formId = isBusinessStep(current)
    ? businessFormId
    : isAgentStep(current)
      ? agentFormId
      : undefined;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void go(step + 1);
  };

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
            className="mt-2 text-3xl leading-tight text-balance outline-none sm:text-4xl"
          >
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
            {copy.description}
          </p>
        </div>
      </header>

      <div className="mt-8 min-w-0">
        {isBusinessStep(current) && (
          <form id={businessFormId} noValidate onSubmit={submit}>
            <fieldset disabled={busy} className="min-w-0 space-y-8">
              {current === "company" ? (
                <CompanyFields
                  control={businessForm.control}
                  projectId={projectId}
                  companyName={companyName}
                  logoUrl={logoUrl}
                />
              ) : (
                <GoalsFields control={businessForm.control} />
              )}
            </fieldset>
          </form>
        )}

        {isAgentStep(current) && (
          <form id={agentFormId} noValidate onSubmit={submit}>
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
                        {greeting(config, companyName)}
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
                    value={config.agentSystemMessage}
                    disabled={busy}
                    onChange={(value) => update("agentSystemMessage", value)}
                    onPersist={saveDraft}
                    onGeneratingChange={setGenerating}
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
                type={formId ? "submit" : "button"}
                form={formId}
                disabled={busy}
                onClick={formId ? undefined : () => void go(step + 1)}
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
