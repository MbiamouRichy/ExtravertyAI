"use client";
import { useEffect, useState } from "react";
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
  BriefcaseBusiness,
  Check,
  CheckCheck,
  FileText,
  Heart,
  Languages,
  Loader2,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
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
import { cn } from "@/lib/utils";
import { saveAgentConfiguration } from "@/app/actions/project-settings";
import {
  AGENT_DEFAULTS,
  AGENT_TONES,
  AgentConfigSchema,
  systemMessageTemplate,
  type AgentConfig,
} from "@/lib/agent-config";

const toneIcons = { warm: Heart, professional: BriefcaseBusiness, direct: Zap } as const;
const lengths = [
  { value: "concise", label: "Concis", hint: "Recommandé sur WhatsApp" },
  { value: "balanced", label: "Équilibré", hint: "Réponses structurées" },
  { value: "detailed", label: "Détaillé", hint: "Explications complètes" },
] as const;
const missionTips = [
  "Votre activité et vos offres",
  "Vos prix et conditions vérifiés",
  "Vos horaires et zones de service",
  "Ce que l’agent ne doit jamais promettre",
];
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
  eyebrow,
  icon: Icon,
  title,
  description,
}: {
  eyebrow?: string;
  icon: typeof Bot;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
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
}: {
  projectId: string;
  projectName: string;
  initial: AgentConfig;
  version: number;
  onboarding?: boolean;
  onSavingChange?: (saving: boolean) => void;
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
    if (!autosave.queue.unsaved)
      reset({
        ...initial,
        agentSystemMessage:
          initial.agentSystemMessage || systemMessageTemplate(projectName),
      });
  }, [initial, version, projectName, reset, autosave.queue]);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [savedVersion, setSavedVersion] = useState(version);
  const update = <K extends keyof AgentConfig>(
    key: K,
    value: FieldPathValue<AgentConfig, K>,
  ) => {
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
  const steps = ["Identité", "Mission & connaissances", "Comportements"];
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
    if (onboarding && step < 2) {
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
                      active && "border-primary bg-primary text-primary-foreground",
                      completed && "border-primary bg-background text-foreground",
                      !active && !completed && "text-muted-foreground",
                    )}
                  >
                    {completed ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
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
          onboarding
            ? "lg:grid-cols-[minmax(0,1fr)_320px]"
            : "2xl:grid-cols-[minmax(0,1fr)_300px]",
        )}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (onboarding) void submit();
            else void autosave.queue.flush();
          }}
          className="min-w-0 space-y-6"
          noValidate
        >
          <fieldset disabled={onboarding && pending} className="min-w-0 space-y-6">
            {show(0) && (
              <section className="rounded-2xl border bg-card p-5 sm:p-6">
                <SectionHeader
                  eyebrow={onboarding ? undefined : `01 · ${steps[0]}`}
                  icon={Bot}
                  title="Donnez-lui une identité"
                  description="Un nom que vos clients reconnaîtront."
                />
                <Controller
                  name="agentName"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="agent-name">Nom de votre agent</FieldLabel>
                      <InputGroup className="h-11">
                        <InputGroupInput
                          {...field}
                          id="agent-name"
                          autoComplete="off"
                          maxLength={60}
                          aria-invalid={fieldState.invalid}
                          aria-describedby="agent-name-description agent-name-error"
                          onChange={(event) => update("agentName", event.target.value)}
                          placeholder="Ex. Nova"
                        />
                        <InputGroupAddon align="inline-start">
                          <Bot />
                        </InputGroupAddon>
                        <InputGroupAddon align="inline-end">
                          <span className="font-mono text-xs tabular-nums">
                            {config.agentName.length}/60
                          </span>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldDescription id="agent-name-description">
                        L’agent se présente comme un assistant IA. Choisissez un nom
                        simple, sans usurper l’identité d’un membre de votre équipe.
                      </FieldDescription>
                      <FieldError id="agent-name-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </section>
            )}

            {show(1) && (
              <section className="rounded-2xl border bg-card p-5 sm:p-6">
                <SectionHeader
                  eyebrow={onboarding ? undefined : `02 · ${steps[1]}`}
                  icon={FileText}
                  title="Sa mission, avec vos mots"
                  description="Le message système guide chaque réponse de l’agent."
                />
                <div className="mb-5 rounded-xl border border-dashed p-4">
                  <p className="text-sm font-medium">Un bon message système contient</p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {missionTips.map((tip) => (
                      <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-foreground" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Uniquement des informations vérifiées, sans identifiants ni secrets.
                  </p>
                </div>
                <Controller
                  name="agentSystemMessage"
                  control={form.control}
                  render={({ fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="agent-system">
                        Message système de votre entreprise
                      </FieldLabel>
                      <SystemMessageDialog
                        projectId={projectId}
                        config={config}
                        onChange={(value) => update("agentSystemMessage", value)}
                        onClose={() => {
                          if (!onboarding) void autosave.queue.flush();
                        }}
                        status={autosave.status}
                        saveError={autosave.error}
                        error={fieldState.error}
                        onboarding={onboarding}
                      />
                      <div className="space-y-1.5">
                        <div
                          aria-hidden="true"
                          className="h-1 overflow-hidden rounded-full bg-muted"
                        >
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width]",
                              config.agentSystemMessage.trim().length >= 40
                                ? "bg-foreground"
                                : "bg-muted-foreground/50",
                            )}
                            style={{
                              width: `${Math.min(100, (config.agentSystemMessage.length / 12000) * 100)}%`,
                            }}
                          />
                        </div>
                        <FieldDescription
                          id="agent-system-description"
                          className="flex flex-wrap justify-between gap-2"
                        >
                          <span className="ml-auto tabular-nums">
                            {config.agentSystemMessage.length.toLocaleString("fr-FR")} / 12 000
                          </span>
                        </FieldDescription>
                      </div>
                      <FieldError id="agent-system-error" errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </section>
            )}

            {show(2) && (
              <section className="rounded-2xl border bg-card p-5 sm:p-6">
                <SectionHeader
                  eyebrow={onboarding ? undefined : `03 · ${steps[2]}`}
                  icon={SlidersHorizontal}
                  title="La bonne façon de répondre"
                  description="Des comportements adaptés aux conversations WhatsApp."
                />
                <div className="space-y-7">
                  <Controller
                    name="agentTone"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <FieldSet data-invalid={fieldState.invalid}>
                        <FieldLegend variant="label">Ton de l’agent</FieldLegend>
                        <FieldDescription id="agent-tone-help" className="-mt-1.5">
                          Ajoute une consigne de ton aux réponses de l’agent, appliquée
                          dès l’enregistrement. Votre message système reste la référence.
                        </FieldDescription>
                        <RadioGroup
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={field.value}
                          onValueChange={(value) =>
                            update("agentTone", value as AgentConfig["agentTone"])
                          }
                          aria-invalid={fieldState.invalid}
                          aria-describedby="agent-tone-help agent-tone-error"
                          className="grid gap-2 sm:grid-cols-3"
                        >
                          {AGENT_TONES.map((tone) => {
                            const Icon = toneIcons[tone.value];
                            return (
                              <FieldLabel
                                key={tone.value}
                                htmlFor={`agent-tone-${tone.value}`}
                                className="w-full! cursor-pointer items-stretch rounded-xl border p-3 font-normal transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50"
                              >
                                <span className="flex h-full w-full flex-col gap-2.5">
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                                      <Icon aria-hidden="true" className="size-4" />
                                    </span>
                                    <RadioGroupItem
                                      id={`agent-tone-${tone.value}`}
                                      value={tone.value}
                                      aria-describedby={`agent-tone-${tone.value}-description`}
                                    />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium">{tone.label}</span>
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
                        <FieldError id="agent-tone-error" errors={[fieldState.error]} />
                      </FieldSet>
                    )}
                  />

                  <Controller
                    name="agentResponseLength"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <FieldSet data-invalid={fieldState.invalid}>
                        <FieldLegend variant="label">Longueur des réponses</FieldLegend>
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
                          className="grid grid-cols-3 gap-2"
                        >
                          {lengths.map((option, index) => (
                            <FieldLabel
                              key={option.value}
                              htmlFor={`agent-length-${option.value}`}
                              className="w-full! cursor-pointer rounded-xl border p-3 font-normal transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50"
                            >
                              <span className="flex w-full flex-col gap-2">
                                <span aria-hidden="true" className="flex flex-col gap-1">
                                  {Array.from({ length: index + 1 }, (_, line) => (
                                    <span
                                      key={line}
                                      className="h-1 rounded-full bg-foreground/60"
                                      style={{ width: `${100 - line * 18}%` }}
                                    />
                                  ))}
                                </span>
                                <span className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium">{option.label}</span>
                                  <RadioGroupItem
                                    id={`agent-length-${option.value}`}
                                    value={option.value}
                                    className="sr-only"
                                  />
                                </span>
                                <span className="hidden text-xs text-muted-foreground sm:block">
                                  {option.hint}
                                </span>
                              </span>
                            </FieldLabel>
                          ))}
                        </RadioGroup>
                        <FieldError id="agent-length-error" errors={[fieldState.error]} />
                      </FieldSet>
                    )}
                  />

                  <Controller
                    name="agentLanguage"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="agent-language">Langue des réponses</FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={(value) =>
                            update("agentLanguage", value as AgentConfig["agentLanguage"])
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
                            <Languages aria-hidden="true" className="text-muted-foreground" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">S’adapter au prospect</SelectItem>
                            <SelectItem value="fr">Toujours en français</SelectItem>
                            <SelectItem value="en">Toujours en anglais</SelectItem>
                          </SelectContent>
                        </Select>
                        <FieldError id="agent-language-error" errors={[fieldState.error]} />
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
                                onCheckedChange={(checked) => update(item.key, checked === true)}
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
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck aria-hidden="true" className="size-4" /> Réglages réservés à votre
                équipe
              </span>
            )}
            {onboarding ? (
              <Button disabled={pending} type="submit" size="lg">
                {pending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : step < 2 ? null : (
                  <Check aria-hidden="true" />
                )}
                {pending
                  ? "Enregistrement…"
                  : step < 2
                    ? `Continuer · ${steps[step + 1]}`
                    : "Valider et ouvrir le chat"}
                {!pending && step < 2 && <ArrowRight data-icon="inline-end" />}
              </Button>
            ) : (
              <AutosaveStatus status={autosave.status} error={autosave.error} />
            )}
          </div>
        </form>

        <aside
          aria-label="Aperçu du style"
          className={cn(
            "self-start rounded-2xl border bg-muted/40 p-4",
            onboarding ? "lg:sticky lg:top-6" : "2xl:sticky 2xl:top-24",
          )}
        >
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <MessageSquare aria-hidden="true" className="size-3.5" /> Aperçu en direct
          </p>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{config.agentName || "Votre agent"}</p>
                <p className="truncate text-xs text-muted-foreground">{projectName} · en ligne</p>
              </div>
            </div>
            <div className="space-y-2 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] p-4">
              <div className="mr-10 w-fit rounded-2xl rounded-bl-sm border bg-background px-3 py-2 text-sm">
                Bonjour !
              </div>
              <div className="ml-6 rounded-2xl rounded-br-sm bg-primary px-3 py-2.5 text-sm leading-relaxed text-primary-foreground">
                {preview}
                {config.agentUseEmojis && " 👋"}
                <CheckCheck aria-hidden="true" className="ml-auto mt-1.5 size-3.5 opacity-70" />
              </div>
            </div>
          </div>
          <ul aria-label="Réglages actifs" className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <li className="rounded-full border bg-background px-2 py-0.5">
              {AGENT_TONES.find((tone) => tone.value === config.agentTone)?.label}
            </li>
            <li className="rounded-full border bg-background px-2 py-0.5">
              {lengths.find((option) => option.value === config.agentResponseLength)?.label}
            </li>
            {behaviors
              .filter((item) => config[item.key])
              .map((item) => (
                <li key={item.key} className="rounded-full border bg-background px-2 py-0.5">
                  {item.title}
                </li>
              ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Exemple illustratif : les réponses réelles dépendent de votre message système et de
            la conversation.
          </p>
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-sm font-medium">Toujours dans le cadre</p>
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              {[
                "Ne pas inventer d’informations commerciales.",
                "Ne pas demander de mot de passe ni de carte bancaire.",
                "Permettre à votre équipe de reprendre la main.",
              ].map((text) => (
                <li key={text} className="flex gap-2">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-foreground" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
