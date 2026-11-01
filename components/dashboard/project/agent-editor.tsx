"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type FieldPathValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCheck,
  Languages,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { SystemMessageDialog } from "./system-message-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { useAutosave } from "@/hooks/use-autosave";
import { AutosaveStatus } from "./autosave-status";
import {
  AutosaveFieldIcon,
  AutosaveFieldProgress,
  autosaveFieldClassName,
} from "./autosave-field-indicator";
import { cn } from "@/lib/utils";
import { saveAgentConfiguration } from "@/app/actions/project-settings";
import {
  AGENT_DEFAULTS,
  AGENT_TONES,
  AgentConfigSchema,
  systemMessageTemplate,
  type AgentConfig,
} from "@/lib/agent-config";

const lengths = [
  { value: "concise", label: "Concis", hint: "Recommandé sur WhatsApp" },
  { value: "balanced", label: "Équilibré", hint: "Réponses structurées" },
  { value: "detailed", label: "Détaillé", hint: "Explications complètes" },
] as const;
const behaviors = [
  {
    key: "agentAskOneQuestion" as const,
    title: "Une question à la fois",
    text: "Faire avancer la conversation sans submerger le prospect.",
    recommended: true,
  },
  {
    key: "agentQualifyLeads" as const,
    title: "Comprendre le besoin",
    text: "Identifier la demande et son échéance. Active aussi Instinct IA.",
    recommended: true,
  },
  {
    key: "agentHumanHandover" as const,
    title: "Proposer un conseiller",
    text: "Orienter vers un humain quand une réponse fiable manque. Pas de transfert automatique.",
    recommended: true,
  },
  {
    key: "agentUseEmojis" as const,
    title: "Une touche d’emoji",
    text: "Un emoji au maximum, seulement s’il est pertinent.",
    recommended: false,
  },
];

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-base! font-semibold! tracking-tight!">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function AgentEditor({
  projectId,
  projectName,
  initial,
  version,
  onboarding = false,
  onSavingChange,
  dataStep,
}: {
  projectId: string;
  projectName: string;
  initial: AgentConfig;
  version: number;
  onboarding?: boolean;
  onSavingChange?: (saving: boolean) => void;
  /** Onboarding : étape facultative affichée après les comportements, hors du formulaire. */
  dataStep?: ReactNode;
}) {
  const router = useRouter();
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
  const autosave = useAutosave<AgentConfig>(
    version,
    (config, expectedVersion) =>
      saveAgentConfiguration({ projectId, expectedVersion, config }),
  );
  const saving = autosave.status === "waiting" || autosave.status === "saving";
  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);
  const { reset } = form;
  useEffect(() => {
    // Onboarding : rien n’est enregistré avant la fin, une actualisation
    // (ajout de données) ne doit pas effacer la saisie en cours.
    if (onboarding) return;
    if (!autosave.queue.unsaved)
      reset({
        ...initial,
        agentSystemMessage:
          initial.agentSystemMessage || systemMessageTemplate(projectName),
      });
  }, [initial, version, projectName, reset, autosave.queue, onboarding]);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [savedVersion, setSavedVersion] = useState(version);
  // Dernier champ modifié : seul le champ concerné affiche l’enregistrement.
  const [lastEdited, setLastEdited] = useState<keyof AgentConfig | null>(null);
  const nameStatus = lastEdited === "agentName" ? autosave.status : "idle";
  const update = <K extends keyof AgentConfig>(
    key: K,
    value: FieldPathValue<AgentConfig, K>,
  ) => {
    setLastEdited(key);
    form.setValue(key, value, { shouldDirty: true, shouldValidate: true });
    if (onboarding) return;
    const parsed = AgentConfigSchema.safeParse(form.getValues());
    if (!parsed.success) {
      autosave.queue.invalidate();
      void form.trigger();
      return;
    }
    autosave.queue.schedule(
      parsed.data,
      key === "agentName" || key === "agentSystemMessage" ? 600 : 0,
    );
  };
  const steps = [
    "Identité",
    "Mission & consignes",
    "Comportements",
    ...(onboarding && dataStep ? ["Vos données"] : []),
  ];
  const last = steps.length - 1;
  const dataActive = onboarding && !!dataStep && step === 3;
  async function submit() {
    setError("");
    if (
      !(await form.trigger(
        step === 0 && onboarding
          ? "agentName"
          : step === 1 && onboarding
            ? "agentSystemMessage"
            : undefined,
      ))
    )
      return;
    if (onboarding && step < last) {
      if (step === 0 && config.agentName.trim().length < 2) {
        setError("Donnez un nom à votre agent (au moins deux caractères).");
        return;
      }
      if (step === 1 && config.agentSystemMessage.trim().length < 40) {
        setError(
          "Décrivez la mission de votre agent en au moins 40 caractères.",
        );
        return;
      }
      setStep(step + 1);
      return;
    }
    const parsed = AgentConfigSchema.safeParse(config);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setPending(true);
    try {
      const result = await saveAgentConfiguration({
        projectId,
        expectedVersion: savedVersion,
        config: parsed.data,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSavedVersion(result.version);
      toast.success("La configuration de votre agent est enregistrée.");
      if (onboarding) router.push(`/projects/${projectId}/chat`);
      router.refresh();
    } catch {
      setError(
        "La connexion a été interrompue. Actualisez pour vérifier l’enregistrement.",
      );
    } finally {
      setPending(false);
    }
  }
  const show = (index: number) => !onboarding || step === index;
  const preview =
    config.agentLanguage === "en"
      ? `Hello, I'm ${config.agentName || "your assistant"}, the AI assistant for ${projectName}. How can I help you?`
      : config.agentTone === "direct"
        ? `Bonjour, je suis ${config.agentName || "votre assistant"}. Quel est votre besoin ?`
        : config.agentTone === "professional"
          ? `Bonjour, je suis ${config.agentName || "votre assistant"}, l’assistant IA de ${projectName}. Comment puis-je vous renseigner ?`
          : `Bonjour et bienvenue chez ${projectName} ! Je suis ${config.agentName || "votre assistant"}, votre assistant IA. Comment puis-je vous aider ?`;
  return (
    <div className="space-y-6">
      {onboarding && (
        <nav aria-label="Étapes de configuration" className="space-y-3">
          <p className="sr-only" role="status" aria-atomic="true">
            Étape {step + 1} sur {steps.length} : {steps[step]}
          </p>
          <ol className="flex items-center gap-2">
            {steps.map((label, index) => {
              const active = step === index;
              const completed = index < step;
              return (
                <li
                  key={label}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2",
                    index < steps.length - 1 ? "min-w-0 flex-1" : "shrink-0",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors",
                      active &&
                        "border-primary bg-primary text-primary-foreground",
                      completed &&
                        "border-primary bg-background text-foreground",
                      !active && !completed && "text-muted-foreground",
                    )}
                  >
                    {completed ? (
                      <Check aria-hidden="true" className="size-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      active
                        ? "shrink-0 whitespace-nowrap font-medium"
                        : "hidden truncate text-muted-foreground sm:inline",
                    )}
                  >
                    {label}
                  </span>
                  {index < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-px min-w-4 flex-1 transition-colors",
                        completed ? "bg-foreground" : "bg-border",
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div
        className={cn(
          "grid gap-6",
          dataActive
            ? ""
            : onboarding
              ? "lg:grid-cols-[minmax(0,1fr)_320px]"
              : "",
        )}
      >
        <div className="min-w-0 space-y-6">
          {/* Hors du formulaire : les dialogues d’ajout ont leurs propres formulaires. */}
          {dataActive && dataStep}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (onboarding) void submit();
              else void autosave.queue.flush();
            }}
            className="min-w-0 space-y-6"
            noValidate
          >
            <fieldset
              disabled={onboarding && pending}
              className="min-w-0 space-y-6"
            >
              {show(0) && (
                <section className="rounded-xl border p-4 sm:p-5">
                  <SectionHeader
                    title="Identité"
                    description="Le nom vu par vos clients."
                  />
                  <Controller
                    name="agentName"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="agent-name">
                          Nom de votre agent
                        </FieldLabel>
                        <InputGroup
                          className={cn(
                            "relative h-11 overflow-hidden",
                            autosaveFieldClassName(nameStatus),
                          )}
                        >
                          <InputGroupInput
                            {...field}
                            id="agent-name"
                            autoComplete="off"
                            maxLength={60}
                            aria-invalid={fieldState.invalid}
                            aria-describedby="agent-name-error"
                            onChange={(event) =>
                              update("agentName", event.target.value)
                            }
                            placeholder="Ex. Nova"
                          />
                          <InputGroupAddon align="inline-start">
                            <Bot />
                          </InputGroupAddon>
                          <InputGroupAddon align="inline-end">
                            <span className="font-mono text-xs tabular-nums">
                              {config.agentName.length}/60
                            </span>
                            {/* Coche ou spinner à l’extrémité droite du champ. */}
                            {!onboarding && (
                              <AutosaveFieldIcon status={nameStatus} />
                            )}
                          </InputGroupAddon>
                          <AutosaveFieldProgress status={nameStatus} />
                        </InputGroup>
                        <FieldError
                          id="agent-name-error"
                          errors={[fieldState.error]}
                        />
                      </Field>
                    )}
                  />
                </section>
              )}

              {show(1) && (
                <section className="rounded-xl border p-4 sm:p-5">
                  <SectionHeader
                    title="Mission"
                    description="Ce que l’agent doit faire et ne jamais promettre."
                  />
                  <Controller
                    name="agentSystemMessage"
                    control={form.control}
                    render={({ fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="agent-system" className="sr-only">
                          Message système
                        </FieldLabel>
                        <SystemMessageDialog
                          projectId={projectId}
                          config={config}
                          onChange={(value) =>
                            update("agentSystemMessage", value)
                          }
                          onClose={() => {
                            if (!onboarding) void autosave.queue.flush();
                          }}
                          status={autosave.status}
                          saveError={autosave.error}
                          error={fieldState.error}
                          onboarding={onboarding}
                        />
                        <p id="agent-system-description" className="sr-only">
                          {config.agentSystemMessage.length} caractères sur 12 000
                        </p>
                        <FieldError
                          id="agent-system-error"
                          errors={[fieldState.error]}
                        />
                      </Field>
                    )}
                  />
                </section>
              )}

              {show(2) && (
                <section className="rounded-xl border p-4 sm:p-5">
                  <SectionHeader
                    title="Style"
                    description="Sa façon de répondre sur WhatsApp."
                  />
                  <div className="space-y-7">
                    <Controller
                      name="agentTone"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <FieldSet data-invalid={fieldState.invalid}>
                          <FieldLegend variant="label">
                            Ton de l’agent
                          </FieldLegend>
                          <RadioGroup
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value}
                            onValueChange={(value) =>
                              update(
                                "agentTone",
                                value as AgentConfig["agentTone"],
                              )
                            }
                            aria-invalid={fieldState.invalid}
                            aria-describedby="agent-tone-error"
                            className="grid gap-2 sm:grid-cols-3"
                          >
                            {AGENT_TONES.map((tone) => {
                              return (
                                <FieldLabel
                                  key={tone.value}
                                  htmlFor={`agent-tone-${tone.value}`}
                                  className="w-full! cursor-pointer items-stretch rounded-xl border p-3 font-normal transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50"
                                >
                                  <span className="flex h-full w-full flex-col gap-2.5">
                                    <span className="flex items-start justify-between gap-2">
                                      <RadioGroupItem
                                        id={`agent-tone-${tone.value}`}
                                        value={tone.value}
                                        aria-describedby={`agent-tone-${tone.value}-description`}
                                      />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block text-sm font-medium">
                                        {tone.label}
                                      </span>
                                      <span
                                        id={`agent-tone-${tone.value}-description`}
                                        className="mt-0.5 block text-xs leading-relaxed text-muted-foreground"
                                      >
                                        {tone.description}
                                      </span>
                                    </span>
                                  </span>
                                </FieldLabel>
                              );
                            })}
                          </RadioGroup>
                          <FieldError
                            id="agent-tone-error"
                            errors={[fieldState.error]}
                          />
                        </FieldSet>
                      )}
                    />

                    <Controller
                      name="agentResponseLength"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <FieldSet data-invalid={fieldState.invalid}>
                          <FieldLegend variant="label">
                            Longueur des réponses
                          </FieldLegend>
                          <RadioGroup
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value}
                            onValueChange={(value) =>
                              update(
                                "agentResponseLength",
                                value as AgentConfig["agentResponseLength"],
                              )
                            }
                            aria-invalid={fieldState.invalid}
                            aria-describedby="agent-length-error"
                            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                          >
                            {lengths.map((option) => (
                              <FieldLabel
                                key={option.value}
                                htmlFor={`agent-length-${option.value}`}
                                className="w-full! min-w-0 cursor-pointer rounded-xl border p-3 font-normal transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50"
                              >
                                {/* Mobile : ligne (illustration, texte) ; à partir de sm : carte verticale. */}
                                <span className="flex w-full min-w-0 items-center gap-3 sm:flex-col sm:items-stretch sm:gap-2">
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium">
                                      {option.label}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                      {option.hint}
                                    </span>
                                  </span>
                                  <RadioGroupItem
                                    id={`agent-length-${option.value}`}
                                    value={option.value}
                                    className="sr-only"
                                  />
                                </span>
                              </FieldLabel>
                            ))}
                          </RadioGroup>
                          <FieldError
                            id="agent-length-error"
                            errors={[fieldState.error]}
                          />
                        </FieldSet>
                      )}
                    />

                    <Controller
                      name="agentLanguage"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="agent-language">
                            Langue des réponses
                          </FieldLabel>
                          <Select
                            name={field.name}
                            value={field.value}
                            onValueChange={(value) =>
                              update(
                                "agentLanguage",
                                value as AgentConfig["agentLanguage"],
                              )
                            }
                          >
                            <SelectTrigger
                              id="agent-language"
                              ref={field.ref}
                              onBlur={field.onBlur}
                              aria-invalid={fieldState.invalid}
                              aria-describedby="agent-language-error"
                              className="w-full sm:max-w-xs"
                            >
                              <Languages
                                aria-hidden="true"
                                className="text-muted-foreground"
                              />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">
                                S’adapter au prospect
                              </SelectItem>
                              <SelectItem value="fr">
                                Toujours en français
                              </SelectItem>
                              <SelectItem value="en">
                                Toujours en anglais
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldError
                            id="agent-language-error"
                            errors={[fieldState.error]}
                          />
                        </Field>
                      )}
                    />

                    <FieldSet>
                      <FieldLegend variant="label">Comportements</FieldLegend>
                      <div className="divide-y rounded-xl border">
                        {behaviors.map((item) => (
                          <Controller
                            key={item.key}
                            name={item.key}
                            control={form.control}
                            render={({ field, fieldState }) => (
                              <Field
                                orientation="horizontal"
                                data-invalid={fieldState.invalid}
                                className="items-start justify-between gap-4 p-4"
                              >
                                <div className="min-w-0">
                                  <FieldLabel
                                    htmlFor={`agent-${item.key}`}
                                    className="flex flex-wrap items-center gap-2 text-sm font-medium"
                                  >
                                    {item.title}
                                    {item.recommended && (
                                      <span className="rounded-full border px-1.5 text-[10px] font-normal text-muted-foreground">
                                        Recommandé
                                      </span>
                                    )}
                                  </FieldLabel>
                                  <FieldDescription
                                    id={`agent-${item.key}-description`}
                                    className="mt-1 text-xs leading-relaxed"
                                  >
                                    {item.text}
                                  </FieldDescription>
                                  <FieldError
                                    id={`agent-${item.key}-error`}
                                    errors={[fieldState.error]}
                                  />
                                </div>
                                <Switch
                                  id={`agent-${item.key}`}
                                  name={field.name}
                                  ref={field.ref}
                                  onBlur={field.onBlur}
                                  checked={field.value}
                                  onCheckedChange={(checked) =>
                                    update(item.key, checked === true)
                                  }
                                  aria-invalid={fieldState.invalid}
                                  aria-describedby={`agent-${item.key}-description agent-${item.key}-error`}
                                  className="mt-0.5"
                                />
                              </Field>
                            )}
                          />
                        ))}
                      </div>
                    </FieldSet>
                  </div>
                </section>
              )}
            </fieldset>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <div
              className={cn(
                "flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center",
                onboarding
                  ? "sticky bottom-0 z-10 -mx-4 border-t bg-background/90 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/75 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-5 sm:backdrop-blur-none"
                  : "border-t pt-5",
              )}
            >
              {onboarding && step > 0 ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError("");
                    setStep(step - 1);
                  }}
                  variant="outline"
                  size="lg"
                >
                  <ArrowLeft data-icon="inline-start" /> Précédent
                </Button>
              ) : (
                <span />
              )}
              {onboarding ? (
                <Button disabled={pending} type="submit" size="lg">
                  {pending ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : step < last ? null : (
                    <Check aria-hidden="true" />
                  )}
                  {pending
                    ? "Enregistrement…"
                    : step < last
                      ? `Continuer · ${steps[step + 1]}`
                      : "Valider et ouvrir le chat"}
                  {!pending && step < last && (
                    <ArrowRight data-icon="inline-end" />
                  )}
                </Button>
              ) : autosave.status === "error" ||
                autosave.status === "invalid" ? (
                // Plus de texte de progression : seuls les échecs restent écrits.
                <AutosaveStatus
                  status={autosave.status}
                  error={autosave.error}
                />
              ) : lastEdited && lastEdited !== "agentName" ? (
                // Autres réglages (interrupteurs, choix) : indicateur sans texte.
                <AutosaveFieldIcon status={autosave.status} />
              ) : null}
            </div>
          </form>
        </div>

        {onboarding && !dataActive && (
          <aside
            aria-label="Aperçu du style"
            className={cn(
              // Masqué sur mobile : il repoussait les réglages sous un long aperçu.
              "self-start rounded-2xl border bg-muted/40 p-4 max-md:hidden",
              "lg:sticky lg:top-6",
            )}
          >
            <p className="mb-3 text-xs text-muted-foreground">Aperçu</p>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {config.agentName || "Votre agent"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {projectName} · en ligne
                  </p>
                </div>
              </div>
              <div className="space-y-2 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] p-4">
                <div className="mr-10 w-fit rounded-2xl rounded-bl-sm border bg-background px-3 py-2 text-sm">
                  Bonjour !
                </div>
                <div className="ml-6 rounded-2xl rounded-br-sm bg-primary px-3 py-2.5 text-sm leading-relaxed text-primary-foreground">
                  {preview}
                  {config.agentUseEmojis && " 👋"}
                  <CheckCheck
                    aria-hidden="true"
                    className="ml-auto mt-1.5 size-3.5 opacity-70"
                  />
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
