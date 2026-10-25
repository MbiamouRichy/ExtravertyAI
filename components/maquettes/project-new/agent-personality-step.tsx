"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Bot, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

import { TONE_OPTIONS } from "./data";
import { KnowledgeBaseUpload } from "./knowledge-base-upload";
import type { ProjectWizardValues } from "./schema";

const BEHAVIOURS = [
  {
    name: "humanHandover",
    label: "Orienter vers un humain",
    description:
      "Quand le client le demande ou que l’agent ne sait pas, il invite à joindre un conseiller.",
  },
  {
    name: "useEmojis",
    label: "Emojis",
    description: "Un emoji pertinent au plus par réponse.",
  },
] as const;

export function AgentPersonalityStep() {
  const { control } = useFormContext<ProjectWizardValues>();

  return (
    <div className="space-y-12">
      <FieldGroup className="gap-8">
        <Controller
          name="agentName"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="agent-name">Nom de l’agent</FieldLabel>
              <InputGroup className="h-11 sm:max-w-sm">
                <InputGroupAddon>
                  <Bot aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  {...field}
                  id="agent-name"
                  type="text"
                  autoComplete="off"
                  maxLength={60}
                  required
                  placeholder="Ex. Léa"
                  aria-invalid={fieldState.invalid}
                  aria-describedby="agent-name-help"
                  className="text-base sm:text-sm"
                />
              </InputGroup>
              {fieldState.invalid ? (
                <FieldError id="agent-name-help" errors={[fieldState.error]} />
              ) : (
                <FieldDescription id="agent-name-help">
                  L’agent se présente toujours honnêtement comme un assistant IA.
                </FieldDescription>
              )}
            </Field>
          )}
        />

        <Controller
          name="tone"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldTitle id="agent-tone-label">Ton des réponses</FieldTitle>
              <RadioGroup
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                aria-labelledby="agent-tone-label"
                aria-invalid={fieldState.invalid}
                className="grid gap-3 md:grid-cols-3"
              >
                {TONE_OPTIONS.map((tone) => {
                  const checked = field.value === tone.value;
                  const Icon = tone.icon;
                  return (
                    <div
                      key={tone.value}
                      className={cn(
                        "relative flex min-w-0 rounded-xl border bg-card transition-[border-color,box-shadow,transform] duration-200",
                        "hover:border-foreground/30 motion-safe:hover:-translate-y-0.5",
                        checked && "border-foreground ring-1 ring-foreground",
                        "has-[[role=radio]:focus-visible]:outline-2 has-[[role=radio]:focus-visible]:outline-offset-2 has-[[role=radio]:focus-visible]:outline-ring",
                      )}
                    >
                      <RadioGroupItem
                        ref={checked ? field.ref : undefined}
                        id={`tone-${tone.value}`}
                        value={tone.value}
                        className="peer absolute! sr-only"
                      />
                      <FieldLabel
                        htmlFor={`tone-${tone.value}`}
                        className="flex w-full! cursor-pointer flex-col items-stretch gap-0 p-4 font-normal"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "flex size-8 items-center justify-center rounded-lg border transition-colors",
                              checked && "border-transparent bg-primary text-primary-foreground",
                            )}
                          >
                            <Icon aria-hidden="true" className="size-4" />
                          </span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-4.5 items-center justify-center rounded-full border transition-colors",
                              checked && "border-foreground bg-foreground text-background",
                            )}
                          >
                            {checked && <Check className="size-3" strokeWidth={3} />}
                          </span>
                        </span>
                        <span className="mt-3 text-sm font-medium">{tone.label}</span>
                        <span className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          {tone.description}
                        </span>
                        <span className="mt-3 border-t border-dashed pt-2.5 font-mono text-[11px] text-muted-foreground">
                          {tone.sample}
                        </span>
                      </FieldLabel>
                    </div>
                  );
                })}
              </RadioGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="divide-y rounded-xl border">
          {BEHAVIOURS.map((behaviour) => (
            <Controller
              key={behaviour.name}
              name={behaviour.name}
              control={control}
              render={({ field }) => (
                <Field orientation="horizontal" className="px-4 py-3.5">
                  <FieldContent>
                    <FieldLabel htmlFor={`agent-${behaviour.name}`}>
                      {behaviour.label}
                    </FieldLabel>
                    <FieldDescription id={`agent-${behaviour.name}-help`} className="text-xs">
                      {behaviour.description}
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id={`agent-${behaviour.name}`}
                    ref={field.ref}
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-describedby={`agent-${behaviour.name}-help`}
                  />
                </Field>
              )}
            />
          ))}
        </div>
      </FieldGroup>

      <section aria-labelledby="knowledge-title" className="space-y-5">
        <div>
          <h3 id="knowledge-title" className="text-lg tracking-normal">
            Base de connaissances
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            L’agent répond à partir de ces documents et n’invente ni prix, ni délai, ni
            disponibilité.
          </p>
        </div>
        <KnowledgeBaseUpload />
      </section>
    </div>
  );
}
