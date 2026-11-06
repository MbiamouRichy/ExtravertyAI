"use client";
import {
  Controller,
  type Control,
  type FieldPathValue,
} from "react-hook-form";
import { Bot, Languages } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { AutosaveStatus } from "@/lib/autosave-queue";
import { AGENT_TONES, type AgentConfig } from "@/lib/agent-config";
import { cn } from "@/lib/utils";
import {
  AutosaveFieldIcon,
  AutosaveFieldProgress,
  autosaveFieldClassName,
} from "./autosave-field-indicator";

/**
 * Champs de l’agent partagés par la configuration initiale et la page
 * Assistant IA : même formulaire react-hook-form, enregistrement propre à
 * chaque écran (`onChange`).
 */
export type AgentFieldUpdate = <K extends keyof AgentConfig>(
  key: K,
  value: FieldPathValue<AgentConfig, K>,
) => void;

type FieldProps = {
  control: Control<AgentConfig>;
  onChange: AgentFieldUpdate;
};

const LENGTHS = [
  { value: "concise", label: "Concis", hint: "Recommandé sur WhatsApp" },
  { value: "balanced", label: "Équilibré", hint: "Réponses structurées" },
  { value: "detailed", label: "Détaillé", hint: "Explications complètes" },
] as const;

export const AGENT_BEHAVIORS = [
  {
    key: "agentAskOneQuestion",
    title: "Une question à la fois",
    text: "Faire avancer la conversation sans submerger le prospect.",
    recommended: true,
  },
  {
    key: "agentQualifyLeads",
    title: "Comprendre le besoin",
    text: "Identifier la demande et son échéance. Active aussi Instinct IA.",
    recommended: true,
  },
  {
    key: "agentHumanHandover",
    title: "Proposer un conseiller",
    text: "Orienter vers un humain quand une réponse fiable manque. Pas de transfert automatique.",
    recommended: true,
  },
  {
    key: "agentUseEmojis",
    title: "Une touche d’emoji",
    text: "Un emoji au maximum, seulement s’il est pertinent.",
    recommended: false,
  },
] as const;

type BehaviorKey = (typeof AGENT_BEHAVIORS)[number]["key"];

const OPTION_CARD =
  "w-full! min-w-0 cursor-pointer rounded-xl border p-3 font-normal transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50";

export function AgentNameField({
  control,
  onChange,
  length,
  status = "idle",
  showStatus = false,
}: FieldProps & {
  length: number;
  status?: AutosaveStatus;
  /** Page Assistant IA : coche ou indicateur d’enregistrement dans le champ. */
  showStatus?: boolean;
}) {
  return (
    <Controller
      name="agentName"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="agent-name">Nom de votre agent</FieldLabel>
          <InputGroup
            className={cn(
              "relative h-11 overflow-hidden",
              showStatus && autosaveFieldClassName(status),
            )}
          >
            <InputGroupInput
              {...field}
              id="agent-name"
              autoComplete="off"
              maxLength={60}
              aria-invalid={fieldState.invalid}
              aria-describedby="agent-name-error"
              onChange={(event) => onChange("agentName", event.target.value)}
              placeholder="Ex. Nova"
            />
            <InputGroupAddon align="inline-start">
              <Bot />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <span className="font-mono text-xs tabular-nums">{length}/60</span>
              {showStatus && <AutosaveFieldIcon status={status} />}
            </InputGroupAddon>
            {showStatus && <AutosaveFieldProgress status={status} />}
          </InputGroup>
          <FieldError id="agent-name-error" errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function AgentToneField({ control, onChange }: FieldProps) {
  return (
    <Controller
      name="agentTone"
      control={control}
      render={({ field, fieldState }) => (
        <FieldSet data-invalid={fieldState.invalid}>
          <FieldLegend variant="label">Ton de l’agent</FieldLegend>
          <RadioGroup
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={field.value}
            onValueChange={(value) =>
              onChange("agentTone", value as AgentConfig["agentTone"])
            }
            aria-invalid={fieldState.invalid}
            aria-describedby="agent-tone-error"
            className="grid gap-2 sm:grid-cols-3"
          >
            {AGENT_TONES.map((tone) => (
              <FieldLabel
                key={tone.value}
                htmlFor={`agent-tone-${tone.value}`}
                className={cn(OPTION_CARD, "items-stretch")}
              >
                <span className="flex w-full min-w-0 items-start gap-3 sm:flex-col sm:gap-2.5">
                  <RadioGroupItem
                    id={`agent-tone-${tone.value}`}
                    value={tone.value}
                    aria-describedby={`agent-tone-${tone.value}-description`}
                    className="mt-0.5 sm:mt-0"
                  />
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
            ))}
          </RadioGroup>
          <FieldError id="agent-tone-error" errors={[fieldState.error]} />
        </FieldSet>
      )}
    />
  );
}

export function AgentLengthField({ control, onChange }: FieldProps) {
  return (
    <Controller
      name="agentResponseLength"
      control={control}
      render={({ field, fieldState }) => (
        <FieldSet data-invalid={fieldState.invalid}>
          <FieldLegend variant="label">Longueur des réponses</FieldLegend>
          <RadioGroup
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            value={field.value}
            onValueChange={(value) =>
              onChange(
                "agentResponseLength",
                value as AgentConfig["agentResponseLength"],
              )
            }
            aria-invalid={fieldState.invalid}
            aria-describedby="agent-length-error"
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            {LENGTHS.map((option) => (
              <FieldLabel
                key={option.value}
                htmlFor={`agent-length-${option.value}`}
                className={OPTION_CARD}
              >
                <span className="flex w-full min-w-0 items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{option.label}</span>
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
          <FieldError id="agent-length-error" errors={[fieldState.error]} />
        </FieldSet>
      )}
    />
  );
}

export function AgentLanguageField({ control, onChange }: FieldProps) {
  return (
    <Controller
      name="agentLanguage"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="agent-language">Langue des réponses</FieldLabel>
          <Select
            name={field.name}
            value={field.value}
            onValueChange={(value) =>
              onChange("agentLanguage", value as AgentConfig["agentLanguage"])
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
  );
}

export function AgentBehaviorFields({
  control,
  onChange,
  only,
  legend = "Comportements",
}: FieldProps & { only?: readonly BehaviorKey[]; legend?: string }) {
  const items = only
    ? AGENT_BEHAVIORS.filter((item) => only.includes(item.key))
    : AGENT_BEHAVIORS;
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <div className="divide-y rounded-xl border">
        {items.map((item) => (
          <Controller
            key={item.key}
            name={item.key}
            control={control}
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
                  onCheckedChange={(checked) => onChange(item.key, checked === true)}
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
  );
}
