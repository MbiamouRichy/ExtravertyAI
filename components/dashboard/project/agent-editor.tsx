"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCheck,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { saveAgentConfiguration } from "@/app/actions/project-settings";
import {
  AGENT_DEFAULTS,
  AGENT_TONES,
  AgentConfigSchema,
  systemMessageTemplate,
  type AgentConfig,
} from "@/lib/agent-config";

const inputClass =
  "w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-border focus:ring-2 focus:ring-ring/20 disabled:opacity-60";
export function AgentEditor({
  projectId,
  projectName,
  initial,
  version,
  onboarding = false,
}: {
  projectId: string;
  projectName: string;
  initial: AgentConfig;
  version: number;
  onboarding?: boolean;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<AgentConfig>({
    ...AGENT_DEFAULTS,
    ...initial,
    agentSystemMessage:
      initial.agentSystemMessage || systemMessageTemplate(projectName),
  });
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [savedVersion, setSavedVersion] = useState(version);
  const update = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) =>
    setConfig((previous) => ({ ...previous, [key]: value }));
  const steps = ["Identité", "Mission & connaissances", "Comportements"];
  async function submit() {
    setError("");
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
    <div className="space-y-7">
      {onboarding && (
        <ol
          aria-label="Étapes de configuration"
          className="grid grid-cols-3 gap-2 sm:gap-4"
        >
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? "step" : undefined}
              className={`border-t-2 pt-3 ${index <= step ? "border-border" : "border-border"}`}
            >
              <span
                className={`mb-1 block text-xs font-medium ${index <= step ? "text-foreground dark:text-foreground" : "text-muted-foreground"}`}
              >
                0{index + 1}
                {index < step && " · Terminé"}
              </span>
              <span className="text-xs font-medium sm:text-sm">{label}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="min-w-0 space-y-6"
        >
          <fieldset disabled={pending} className="space-y-6">
            {show(0) && (
              <section className="rounded-2xl border bg-card p-5 sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <span className="rounded-xl bg-muted p-2.5 text-foreground dark:bg-muted dark:text-foreground">
                    <Bot className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">
                      Donnez-lui une identité
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Un nom que vos clients reconnaîtront.
                    </p>
                  </div>
                </div>
                <label
                  htmlFor="agent-name"
                  className="mb-2 block text-sm font-medium"
                >
                  Nom de votre agent
                </label>
                <input
                  id="agent-name"
                  value={config.agentName}
                  onChange={(e) => update("agentName", e.target.value)}
                  maxLength={60}
                  required
                  className={inputClass}
                  placeholder="Ex. Nova, l’assistant de votre entreprise"
                />
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  L’agent se présente comme un assistant IA. Choisissez un nom
                  simple, sans usurper l’identité d’un membre de votre équipe.
                </p>
              </section>
            )}
            {show(1) && (
              <section className="rounded-2xl border bg-card p-5 sm:p-7">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Sa mission, avec vos mots
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Le message système guide chaque réponse de l’agent.
                    </p>
                  </div>
                </div>
                <div className="mb-5 rounded-xl bg-muted/60 p-4 text-sm leading-relaxed">
                  <p className="font-medium">Un bon point de départ</p>
                  <p className="mt-1 text-muted-foreground">
                    Présentez votre activité, vos offres, vos horaires et les
                    limites à respecter. Ajoutez uniquement des informations
                    vérifiées, sans identifiants ni secrets.
                  </p>
                </div>
                <label
                  htmlFor="agent-system"
                  className="mb-2 block text-sm font-medium"
                >
                  Message système de votre entreprise
                </label>
                <textarea
                  id="agent-system"
                  rows={15}
                  value={config.agentSystemMessage}
                  onChange={(e) => update("agentSystemMessage", e.target.value)}
                  maxLength={12000}
                  required
                  className={`${inputClass} resize-y font-mono text-[13px] leading-6`}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>40 à 12 000 caractères</span>
                  <span>
                    {config.agentSystemMessage.length.toLocaleString("fr-FR")} /
                    12 000
                  </span>
                </div>
                <button
                  type="button"
                  disabled={config.agentSystemMessage.length > 11880}
                  onClick={() =>
                    update(
                      "agentSystemMessage",
                      `${config.agentSystemMessage}\n\nHORAIRES ET CONTACT HUMAIN\n\nOFFRES ET TARIFS VÉRIFIÉS\n\nQUESTIONS FRÉQUENTES\n`,
                    )
                  }
                  className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-foreground disabled:opacity-40 dark:text-foreground"
                >
                  <Sparkles className="size-4" /> Ajouter des rubriques à
                  compléter
                </button>
              </section>
            )}
            {show(2) && (
              <section className="space-y-7 rounded-2xl border bg-card p-5 sm:p-7">
                <div>
                  <h2 className="text-lg font-semibold">
                    La bonne façon de répondre
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Des comportements adaptés aux conversations WhatsApp.
                  </p>
                </div>
                <fieldset>
                  <legend className="mb-3 text-sm font-medium">
                    Ton de l’agent
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {AGENT_TONES.map((tone) => (
                      <label
                        key={tone.value}
                        className={`cursor-pointer rounded-xl border p-4 focus-within:ring-2 focus-within:ring-ring ${config.agentTone === tone.value ? "border-border bg-muted/60 dark:bg-muted/30" : "hover:bg-muted/40"}`}
                      >
                        <input
                          type="radio"
                          name="agent-tone"
                          checked={config.agentTone === tone.value}
                          onChange={() => update("agentTone", tone.value)}
                          className="sr-only"
                        />
                        <span className="mb-2 flex items-center justify-between text-sm font-medium">
                          {tone.label}
                          {config.agentTone === tone.value && (
                            <Check className="size-4 text-foreground" />
                          )}
                        </span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          {tone.description}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="agent-length"
                      className="mb-2 block text-sm font-medium"
                    >
                      Longueur des réponses
                    </label>
                    <select
                      id="agent-length"
                      value={config.agentResponseLength}
                      onChange={(e) =>
                        update(
                          "agentResponseLength",
                          e.target.value as AgentConfig["agentResponseLength"],
                        )
                      }
                      className={inputClass}
                    >
                      <option value="concise">
                        Concis · recommandé sur WhatsApp
                      </option>
                      <option value="balanced">Équilibré</option>
                      <option value="detailed">Détaillé</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="agent-language"
                      className="mb-2 block text-sm font-medium"
                    >
                      Langue
                    </label>
                    <select
                      id="agent-language"
                      value={config.agentLanguage}
                      onChange={(e) =>
                        update(
                          "agentLanguage",
                          e.target.value as AgentConfig["agentLanguage"],
                        )
                      }
                      className={inputClass}
                    >
                      <option value="auto">S’adapter au prospect</option>
                      <option value="fr">Toujours en français</option>
                      <option value="en">Toujours en anglais</option>
                    </select>
                  </div>
                </div>
                <div className="divide-y">
                  {[
                    {
                      key: "agentAskOneQuestion" as const,
                      title: "Une question à la fois",
                      text: "Faire avancer la conversation sans submerger le prospect.",
                      recommended: true,
                    },
                    {
                      key: "agentQualifyLeads" as const,
                      title: "Comprendre le besoin",
                      text: "Identifier progressivement la demande et son échéance.",
                      recommended: true,
                    },
                    {
                      key: "agentHumanHandover" as const,
                      title: "Proposer un conseiller",
                      text: "Orienter vers un humain quand une réponse fiable manque. Cela ne déclenche pas un transfert automatique.",
                      recommended: true,
                    },
                    {
                      key: "agentUseEmojis" as const,
                      title: "Une touche d’emoji",
                      text: "Un emoji au maximum, seulement s’il est pertinent.",
                      recommended: false,
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-start justify-between gap-5 py-5"
                    >
                      <div>
                        <span className="block text-sm font-medium">
                          {item.title}{" "}
                          {item.recommended && (
                            <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                              Par défaut
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {item.text}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config[item.key]}
                        onChange={(e) => update(item.key, e.target.checked)}
                        className="mt-1 size-5 shrink-0 accent-primary"
                      />
                    </label>
                  ))}
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
          <div className="flex flex-col-reverse justify-between gap-3 border-t pt-5 sm:flex-row sm:items-center">
            {onboarding && step > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError("");
                  setStep(step - 1);
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-medium"
              >
                <ArrowLeft className="size-4" /> Précédent
              </button>
            ) : (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4" /> Réglages réservés à votre
                équipe
              </span>
            )}
            <button
              disabled={pending}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : onboarding && step < 2 ? (
                <ArrowRight className="size-4" />
              ) : (
                <Check className="size-4" />
              )}
              {pending
                ? "Enregistrement…"
                : onboarding
                  ? step < 2
                    ? "Continuer"
                    : "Valider et ouvrir le chat"
                  : "Enregistrer la configuration"}
            </button>
          </div>
        </form>
        <aside className="self-start rounded-2xl bg-muted/50 p-5 xl:sticky xl:top-6">
          <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <MessageSquare className="size-4" /> Aperçu du style
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-5 flex items-center gap-3 border-b pb-4">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground dark:bg-muted dark:text-foreground">
                <Bot className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {config.agentName || "Votre agent"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {projectName}
                </p>
              </div>
            </div>
            <div className="mb-4 mr-7 rounded-xl rounded-bl-sm bg-muted p-3 text-sm">
              Bonjour !
            </div>
            <div className="ml-4 rounded-xl rounded-br-sm bg-primary p-4 text-sm leading-relaxed text-primary-foreground">
              {preview}
              {config.agentUseEmojis && " 👋"}
              <CheckCheck className="ml-auto mt-2 size-4 text-primary-foreground" />
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Exemple illustratif. Les réponses réelles dépendent de votre message
            système et de la conversation.
          </p>
          <div className="mt-6 border-t pt-5">
            <h3 className="mb-3 text-sm font-medium">Toujours dans le cadre</h3>
            <ul className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              {[
                "Ne pas inventer d’informations commerciales.",
                "Ne pas demander de mot de passe ni de carte bancaire.",
                "Permettre à votre équipe de reprendre la main.",
              ].map((text) => (
                <li key={text} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-foreground dark:text-foreground" />
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
